# Spec: print and PDF (paginated screenplay pages)

Roadmap items **P3-03, P3-04, P3-05, P3-06** (and new **P3-11, P3-12**). Decisions **D-021**, **D-022**. Status:
**P3-03 to P3-06 implemented 2026-09-25** with the recommended answers to §10. Two changes from this plan, both in
D-022: printing lives in the **Export** dialog rather than on a button of its own, and a page may break at **any
sentence end** (the rest is re-wrapped), not only where a sentence ends a wrapped line. P3-11 and P3-12 are not built.

---

## 1. What we are building

A writer presses **Print / PDF** and gets pages that look like a screenplay from any professional tool: Courier 12pt,
standard margins, about 55 lines a page, numbered pages, dialogue that carries across a page break with `(MORE)` and
`(CONT'D)`, and a title page of its own. From there they save a PDF, or print on paper.

The hard part is not the stylesheet. It is **pagination**: deciding where each page ends, and splitting speeches and
action at those points the way the industry expects. Browsers cannot do that for us. CSS page breaks know nothing
about `(MORE)`, and page-number support in print CSS differs from browser to browser. So the plan is:

1. **A pure pagination module** (`src/paginate.js`) that turns parser tokens into pages of fixed-pitch lines. It is
   the core, and it is unit-tested under Node like the other modules.
2. **The print path**: draw those pages as real 8.5 × 11 in (or A4) sheets and hand them to the browser's print
   dialog, where "Save as PDF" makes the file.
3. **Optional: a direct `.pdf` download** (`src/pdf.js`), a small hand-written PDF writer fed by the same pages. No
   print dialog, and the same file in every browser.

No runtime dependencies (D-001) in any of it.

## 2. Why this works: screenplays live on a grid

Courier 12pt is exactly **10 characters per inch**, and screenplay lines are **6 per inch** (12pt line height).
Courier Prime, the app's font, is drawn to the same metrics. So a page is a grid: every element's position and width is
a whole number of characters, every line is 1/6 inch tall, and counting lines in JavaScript gives exactly what prints.
That is how every screenwriting program paginates, and why a pure module can do it with no DOM measuring.

## 3. The page

| | US Letter (default) | A4 |
| --- | --- | --- |
| Sheet | 8.5 × 11 in | 210 × 297 mm (8.27 × 11.69 in) |
| Margins | top 1 in, bottom 1 in, left 1.5 in, right 1 in | same top/left; the text block stays 6 in wide |
| Text width | 60 characters | 60 characters |
| Body lines | **54** (9 in × 6) | **58** (9.69 in × 6, rounded down) |
| Page number | top right, 0.5 in from the top, flush with the right margin, as `2.` | same |

The first page of the script carries no number; the title page is not counted. Page 2 shows `2.`.

## 4. Element geometry (characters from the left margin)

| Element | Indent | Width | Notes |
| --- | --- | --- | --- |
| Scene heading | 0 | 60 | uppercase; bold or not: see §10 |
| Scene number (`#12#`) | printed in both margins | | left at −6, right just past column 60; only when written in the script |
| Action | 0 | 60 | leading spaces kept (the parser already keeps them) |
| Character cue | 22 | 38 | uppercase, extensions as written: `JOHN (V.O.)` |
| Parenthetical | 16 | 20 | wraps inside its own width |
| Dialogue | 10 | 35 | |
| Transition | right-aligned to column 60 | 60 | so a long one (`SMASH CUT TO BLACK:`) never overflows |
| Centered (`> text <`) | centered in 60 | 60 | |
| Lyrics (`~`) | 0 | 60 | italic |
| Dual dialogue | two columns, 28 wide each, 4 apart | | each side: cue indent 6, paren indent 3, dialogue 0 |

These match the preview's CSS variables (`--ind-char` 22ch, `--ind-dialogue` 10ch, `--w-dialogue` 35ch), except
the parenthetical width (preview 15ch, print 20) and the transition (preview indents 40ch). The preview will change to
match, so screen and paper agree.

**Spacing:** one blank line before every element (two before a scene heading is a common house style: §10). No blank
line between a cue, its parentheticals and its dialogue. A page never starts with a blank line.

**Not printed** (the Fountain spec says so): `[[notes]]`, `/* boneyard */`, `# sections`, `= synopses`. A line that
held only a note disappears. `===` forces a new page.

**Emphasis:** `*italic*`, `**bold**`, `_underline_` print as styled text. Wrapping counts only the visible characters,
so the parser gains a small pure helper, `Fountain.runs(text)` → `[{ text, bold, italic, underline }]`, with notes
removed. `Fountain.toHTML` is untouched.

## 5. Where a page may break

The line-filler walks the elements in order, wraps each one to its width, and places whole elements while they fit.
When one does not fit, these rules decide, in this order:

1. **`===`** always starts a new page.
2. **A scene heading never ends a page.** It needs at least the first two lines of whatever follows on the same page
   (or all of it, if shorter); otherwise it moves to the next page.
3. **Dialogue** can split only **between sentences**, with at least **two lines of speech before the break** and
   **two after**. The page ends with `(MORE)` at the cue indent; the next page starts with the cue again plus
   `(CONT'D)`: `JOHN (V.O.) (CONT'D)`. A cue is never left alone at the foot of a page, and a parenthetical never ends
   a page. If no split qualifies, the whole speech moves to the next page.
4. **Action** splits between sentences with at least two lines on each side; otherwise it moves whole.
5. **A transition** does not start a page if it can be avoided: the element before it moves over with it, when that
   element fits on the next page.
6. **Dual dialogue** never splits: its height is the taller side, and it moves whole.
7. **Anything taller than a whole page** (a two-page speech) splits at the last line that fits, with `(MORE)` /
   `(CONT'D)` for dialogue. Words are never lost to a rule.

**Wrapping:** at spaces; after a hyphen; a word longer than the width is cut hard. Tabs become spaces.

## 6. The title page

When the script has a `Title:` block it prints on its own page, unnumbered and not counted:

- **Title**, uppercase, centred about a third of the way down (line 18 of 54); then a blank line, **Credit**
  (`Written by`), a blank line, **Author(s)**, a blank line, **Source**, all centred.
- **Contact** at the bottom left, ending on the last line. **Draft date** and **Copyright** at the bottom right.
- **Notes** above the contact block. Other keys (`Revision`, `Watermark`, `tl` / `br` and so on) are ignored for now.

## 7. Module shapes

```
Paginate.layout(tokens, { paper: 'letter' | 'a4' })
  -> { paper, linesPerPage,
       titlePage: [line] | null,
       pages: [ { number, lines: [line] } ] }        // number is null on page 1

line = { row, col, align: 'left' | 'center' | 'right', width, runs: [{ text, bold, italic, underline }],
         kind: 'scene' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'more' | 'transition' | ... }
```

A page is just a list of positioned lines (row 0 to linesPerPage − 1, column 0 to 59). Both outputs read the same
lines. HTML puts each line at `top = 1in + row × 12pt` and `left = 1.5in + col ch`. The PDF writer puts each line at
`x = 108pt + col × 7.2pt` and `y = pageHeight − 72pt − (row + 1) × 12pt`. Because the layout is plain data, the tests
can say "page 3 ends with `(MORE)`" without a browser.

## 8. Output

### 8a. Print (P3-03)

- **Print / PDF** button next to Export (on phones it goes in the ⋯ menu). It builds the pages into a hidden
  `#print-root` and calls `window.print()`. The writer picks "Save as PDF" or a printer in the browser's dialog.
- **Ctrl/Cmd+P works too:** a `beforeprint` handler builds the same pages, so the browser's own Print prints the
  screenplay, never the app's buttons and panes.
- CSS: `@media print` hides everything but `#print-root`. Each `.print-page` is a fixed-size sheet with
  `break-after: page`. `@page { margin: 0 }` sets the page margins, and the sheet size is set to match the chosen
  paper.
- The pages wait for the Courier Prime font to load (`document.fonts.load`). If it cannot load (offline), plain
  Courier takes over with the same metrics. Self-hosting the font (part of P4-02) would remove the network dependency.
- Help gains a short "Save as PDF" topic: Chrome, Firefox, Safari, iPad, and "turn off Headers and footers" where
  the browser adds its own.

### 8b. Direct PDF download (P3-11, optional)

- `src/pdf.js` (pure, UMD): `Pdf.write(layout, { title, author })` → `Uint8Array`, downloaded as `big-fish.pdf` the
  way Export saves `.fountain` (D-015). About 200 lines: catalog, pages, one content stream per page, an xref table.
- It uses PDF's **built-in Courier fonts** (Courier, -Bold, -Oblique, -BoldOblique). Every PDF reader has them, so
  nothing is embedded, and the file is small and exact. The cost: it is classic Courier, not Courier Prime. Text is
  limited to the Windows-1252 character set. That covers accents, curly quotes, em dashes and `…`. Anything else
  prints as `?`, and the download notice names those characters. Embedding Courier Prime (OFL-licensed) is possible
  later, but it means a font subsetter, so it is out of scope.
- Its strength: the same file in every browser, no print dialog, and on the iPad a plain download instead of the
  Share → Print → pinch-to-PDF route.

### 8c. Page view while writing (P3-12, optional)

A "Pages" switch in the preview that draws the same layout as sheets, with page numbers and breaks. It is not needed
for printing. It helps with "how long is this?" (and page count also feeds P4-04, stats).

## 9. Testing

- **Unit (Node), written first:** wrapping (spaces, hyphens, over-long words, leading spaces); each break rule in §5
  with a fixture that lands exactly on it; `(MORE)` / `(CONT'D)` with and without extensions; dual dialogue kept
  whole; `===`; title page positions; A4 vs Letter line counts; `Fountain.runs`.
- **A no-words-lost property test:** for many generated scripts, every visible character of every printed element
  appears in the pages exactly once and in order, apart from the added `(MORE)` / `(CONT'D)` lines. This is "never
  lose words" for paper.
- **Speed:** a 120-page script lays out in well under 50 ms (a unit test guards it, like autocomplete's).
- **e2e:** the Print button and `beforeprint` build the right number of `.print-page` sheets; each sheet has the paper's
  exact size; the app UI is `display: none` under print (checked via a print-media class the test can switch on);
  user text in the pages is escaped (no markup).
- **Real output:** headless Chromium's `--print-to-pdf` on a fixture page, then check the PDF's page count. The Linux
  runner can do this, and `pdftotext` / `qpdf --check` (on Arch: `poppler`, `qpdf`) can inspect it when installed. The
  PDF writer (8b) is also checked structurally in Node (xref offsets, page count, text present).
- **By eye, by the owner:** the example script and one real script, printed from Chrome, Firefox and Safari, and on
  the iPad.

## 10. Questions for the owner (my recommendation first)

1. **Paper.** US Letter by default, with an A4 choice remembered per browser? *(Recommended.)* Or pick by the
   browser's language (en-US / en-CA → Letter, else A4)?
2. **Output.** (a) the print dialog first, direct PDF later if the dialog annoys; (b) direct PDF first; (c) both
   together. *I recommend (a)*: it prints in Courier Prime, like the preview, and is the smaller first step. But if the
   iPad is where you will export most, (b) is the better first step.
3. **Scene headings bold?** The preview shows them bold; the industry default is plain. *Recommend: plain on paper, and
   the preview follows.*
4. **Blank lines before a scene heading:** one *(recommended; Final Draft's default)* or two (airier, more pages)?
5. **Automatic `(CONT'D)`** when the same character speaks again after only action, within a scene? Final Draft does
   this by default; many spec writers turn it off. *Recommend: off for now* (page-break `(CONT'D)` is always on).
6. **Scene numbers:** print only those written in the script (`#12#`) *(recommended)*; auto-numbering is a production
   feature for later.
7. **Page view in the preview (P3-12):** wanted now, later, or never?

## 11. Order of work, once approved

1. **P3-04 pagination:** `Fountain.runs` and `src/paginate.js`, tests first. It includes **P3-05** (title page) and
   **P3-06** (dual dialogue), which are layout rules inside it. No UI yet.
2. **P3-03 print path:** the button, `beforeprint`, the print stylesheet, the paper setting, Help, e2e.
3. **P3-11 direct PDF**, if chosen in §10.2.
4. **P3-12 page view**, if wanted.

Each step is shippable on its own. Step 1 changes nothing visible, so it can land without the owner checking anything.

## 12. Risks

- **Browser print dialogs differ.** Some add their own headers and footers (date, URL) unless turned off. Chrome drops
  them when the page margin is 0; Firefox and Safari may not. That is the main argument for 8b.
- **Safari and `@page size`:** support is recent. If an older iPad ignores it, the sheet size comes from the
  dialog's paper choice instead. Check it on the device.
- **Page count won't match Final Draft exactly.** Break rules differ between programs. Aim for within a page or two
  on a feature, and say so in Help rather than promise parity.
- **Courier Prime from Google Fonts** needs a connection the first time. Offline, the fallback is plain Courier, with
  the same metrics.
