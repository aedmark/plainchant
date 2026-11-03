#!/usr/bin/env python3
"""Check the project docs for the mistakes that make a handoff lie.

    python3 tools/check_docs.py              # from the repo root
    python3 tools/check_docs.py --template   # the template itself: placeholders are expected

Errors (exit 1):
  - a {{placeholder}} left in a doc
  - a roadmap ID used twice, filed under the wrong phase, or with an unknown checkbox
  - a decision number used twice or out of order, or superseded by one that does not exist or comes earlier
  - an open question (Q-NNN) defined twice
  - a roadmap ID, decision number or question mentioned in active docs (CLAUDE.md, ROADMAP.md, docs/HANDOFF.md,
    docs/DECISIONS.md, README.md) that does not exist
  - two session-log entries with the same number in docs/SESSION-LOG.md
  - a relative link, or a path in CLAUDE.md's Layout / App scripts tables, that points at nothing
  - an on-disk src/app/*.js script omitted from CLAUDE.md's App scripts table
Warnings (exit 0):
  - HANDOFF's "Last updated" is missing, or older than the newest session-log entry in SESSION-LOG.md
  - HANDOFF's "Current state" has outgrown the limit below

Standard library only. HTML comments are ignored, so examples can live in them.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACTIVE_DOCS = [
    "CLAUDE.md", "README.md", "ROADMAP.md",
    "docs/HANDOFF.md", "docs/DECISIONS.md",
]
HISTORY_DOCS = [
    "docs/SESSION-LOG.md",
]
CURRENT_STATE_LINES = 80
# IDs retired by the owner in session 30 before SESSION-LOG.md was frozen, still mentioned in historical prose.
RETIRED_ITEMS = {"P2-09", "P2-13", "P2-22", "P6-03", "P6-04", "P7-02"}

ITEM_RE = re.compile(r"\bP(\d+)-(\d+)\b")
DECISION_RE = re.compile(r"\bD-(\d{3})\b")
QUESTION_RE = re.compile(r"\bQ-(\d{3})\b")
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
LINK_RE = re.compile(r"\]\(([^)\s]+)\)|\b(?:href|src)=\"([^\"]+)\"")

errors, warnings = [], []


def read(path):
    text = path.read_text(encoding="utf-8")
    return re.sub(r"<!--.*?-->", "", text, flags=re.S)


def where(path, text, pos):
    return f"{path.relative_to(ROOT)}:{text.count(chr(10), 0, pos) + 1}"


def section(text, heading):
    m = re.search(rf"^## {re.escape(heading)}(?:\s|$).*?(?=^## |\Z)", text, flags=re.M | re.S)
    return (m.group(0), m.start()) if m else ("", 0)


def main():
    template = "--template" in sys.argv[1:]
    active_paths = [ROOT / d for d in ACTIVE_DOCS if (ROOT / d).is_file()]
    history_paths = [ROOT / d for d in HISTORY_DOCS if (ROOT / d).is_file()]
    docs = active_paths + history_paths
    texts = {p: read(p) for p in docs}

    if not template:
        for path in active_paths:
            text = texts[path]
            for m in re.finditer(r"\{\{[^}]*\}\}", text):
                errors.append(f"{where(path, text, m.start())}: placeholder left: {m.group(0)[:60]}")

    roadmap = ROOT / "ROADMAP.md"
    items = set(RETIRED_ITEMS)
    if roadmap not in texts:
        errors.append("no ROADMAP.md in repo root")
    else:
        text, phase = texts[roadmap], None
        seen_in_roadmap = set()
        for m in re.finditer(r"^## Phase (\d+)|^- \[(.)\] (P(\d+)-(\d+))\b", text, flags=re.M):
            if m.group(1):
                phase = m.group(1)
                continue
            box, item, item_phase = m.group(2), m.group(3), m.group(4)
            if item in seen_in_roadmap:
                errors.append(f"{where(roadmap, text, m.start())}: {item} is used twice")
            seen_in_roadmap.add(item)
            items.add(item)
            if box not in " x~-":
                errors.append(f"{where(roadmap, text, m.start())}: {item} has checkbox [{box}]; use [ ], [~], [x] or [-]")
            if phase is not None and item_phase != phase:
                errors.append(f"{where(roadmap, text, m.start())}: {item} is filed under Phase {phase}")

    decisions_path = ROOT / "docs" / "DECISIONS.md"
    decisions, supersessions, questions = set(), [], set()
    if decisions_path in texts:
        text, last = texts[decisions_path], 0
        for m in re.finditer(r"^## D-(\d{3})\b([^\n]*)", text, flags=re.M):
            number = int(m.group(1))
            if f"D-{m.group(1)}" in decisions:
                errors.append(f"{where(decisions_path, text, m.start())}: D-{m.group(1)} is used twice")
            elif number < last:
                errors.append(f"{where(decisions_path, text, m.start())}: D-{m.group(1)} comes after D-{last:03d}")
            decisions.add(f"D-{m.group(1)}")
            last = max(last, number)
            by = re.search(r"superseded by D-(\d{3})", m.group(2))
            if by:
                supersessions.append((number, int(by.group(1)), m.start()))
        for number, by, pos in supersessions:
            if f"D-{by:03d}" in decisions and by <= number:
                errors.append(f"{where(decisions_path, text, pos)}: D-{number:03d} is superseded by an earlier "
                              f"decision, D-{by:03d}")
        for m in re.finditer(r"^- (?:~~)?(?:\*\*)?Q-(\d{3})\b", text, flags=re.M):
            if f"Q-{m.group(1)}" in questions:
                errors.append(f"{where(decisions_path, text, m.start())}: Q-{m.group(1)} is used twice")
            questions.add(f"Q-{m.group(1)}")

    for path in active_paths:
        text = texts[path]
        if roadmap in texts:
            for m in ITEM_RE.finditer(text):
                if m.group(0) not in items:
                    errors.append(f"{where(path, text, m.start())}: {m.group(0)} is not in ROADMAP.md")
        if decisions_path in texts:
            for m in DECISION_RE.finditer(text):
                if m.group(0) not in decisions:
                    errors.append(f"{where(path, text, m.start())}: {m.group(0)} is not in DECISIONS.md")
            for m in QUESTION_RE.finditer(text):
                if m.group(0) not in questions:
                    errors.append(f"{where(path, text, m.start())}: {m.group(0)} is not in DECISIONS.md's open questions")
        for m in LINK_RE.finditer(text):
            target = (m.group(1) or m.group(2)).split("#")[0]
            if not target or "{{" in target or re.match(r"[a-z][a-z0-9+.-]*:", target):
                continue
            if not (path.parent / target).exists():
                errors.append(f"{where(path, text, m.start())}: link to {target}, which does not exist")

    claude = ROOT / "CLAUDE.md"
    if claude in texts:
        layout, offset = section(texts[claude], "Layout")
        for row in re.finditer(r"^\| ([^|]+) \|", layout, flags=re.M):
            for code in re.finditer(r"`([^`]+)`", row.group(1)):
                rel = code.group(1)
                if "{{" in rel or "*" in rel:
                    continue
                if not (ROOT / rel).exists():
                    errors.append(f"{where(claude, texts[claude], offset + row.start())}: Layout lists {rel}, "
                                  f"which does not exist")
        app_sec, app_offset = section(texts[claude], "App scripts (`src/app/`)")
        listed_app = set()
        for row in re.finditer(r"^\| ([^|]+) \|", app_sec, flags=re.M):
            for code in re.finditer(r"`([^`]+\.js)`", row.group(1)):
                name = code.group(1)
                listed_app.add(name)
                if not (ROOT / "src" / "app" / name).exists():
                    errors.append(f"{where(claude, texts[claude], app_offset + row.start())}: App scripts lists "
                                  f"{name}, which does not exist in src/app/")
        on_disk_app = {p.name for p in (ROOT / "src" / "app").glob("*.js")}
        for missing in sorted(on_disk_app - listed_app):
            errors.append(f"CLAUDE.md: src/app/{missing} is on disk but missing from the App scripts table")

    session_log = ROOT / "docs" / "SESSION-LOG.md"
    newest_session_date = None
    if session_log in texts:
        s_text = texts[session_log]
        session_re = re.compile(r"^### Session (\d+)\b([^\n]*)", flags=re.M)
        seen = set()
        dates = []
        for m in session_re.finditer(s_text):
            num = m.group(1)
            if num in seen:
                errors.append(f"{where(session_log, s_text, m.start())}: a second entry for Session {num}")
            seen.add(num)
            d = DATE_RE.search(m.group(2))
            if d:
                dates.append(d.group(0))
        if dates:
            newest_session_date = max(dates)

    handoff = ROOT / "docs" / "HANDOFF.md"
    if handoff in texts:
        text = texts[handoff]
        updated = re.search(r"Last updated:\s*(\d{4}-\d{2}-\d{2})", text)
        if not updated:
            if not template:
                warnings.append("docs/HANDOFF.md: no 'Last updated: YYYY-MM-DD' line in Current state")
        elif newest_session_date and updated.group(1) < newest_session_date:
            warnings.append(f"docs/HANDOFF.md: Current state was last updated {updated.group(1)}, "
                            f"but SESSION-LOG.md has an entry from {newest_session_date}")
        current, _ = section(text, "Current state")
        if current.count("\n") > CURRENT_STATE_LINES:
            warnings.append(f"docs/HANDOFF.md: Current state is {current.count(chr(10))} lines (limit "
                            f"{CURRENT_STATE_LINES}); move history to SESSION-LOG.md")

    for line in errors:
        print(f"ERROR {line}")
    for line in warnings:
        print(f"WARN  {line}")
    print(f"{len(errors)} error(s), {len(warnings)} warning(s) in {len(texts)} file(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
