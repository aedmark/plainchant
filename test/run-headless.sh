#!/usr/bin/env bash
# Linux / macOS twin of test/run-headless.ps1: runs both browser suites (unit + app e2e) in headless Chromium or
# Chrome with a throwaway profile, so nothing touches your real browser data.
#
#   bash test/run-headless.sh            (or set BROWSER=/path/to/chrome)
#
# Exit code is 0 when everything passes.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"

browser="${BROWSER:-}"
if [ -z "$browser" ]; then
    for b in /opt/pw-browsers/chromium-*/chrome-linux/chrome chromium chromium-browser google-chrome google-chrome-stable \
             "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
        if [ -x "$b" ] || command -v "$b" >/dev/null 2>&1; then browser="$b"; break; fi
    done
fi
[ -n "$browser" ] || { echo 'No Chromium or Chrome found (set BROWSER=...).'; exit 2; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Real time, not --virtual-time-budget: IndexedDB replies arrive in real time and virtual time races past them (D-019).
# --dump-dom waits for the page's load event, and the e2e page holds that event until its checks are done.
run_page() {
    "$browser" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --user-data-dir="$work/profile" \
        --dump-dom "file://$root/$1" 2>"$work/err.txt"
}

failed=0

unit="$(run_page test/index.html)"
banner="$(printf '%s' "$unit" | grep -o 'id="banner" class="[a-z]*">[^<]*' | head -1)"
if [ -n "$banner" ]; then
    echo "unit  : ${banner##*>}"
    case "$banner" in *'class="pass"'*) ;; *) failed=1; printf '%s' "$unit" | grep -o '<li class="fail">[^<]*<span class="err">[^<]*' | sed 's/<li class="fail">/  FAIL /; s/<span class="err">/ -> /' ;; esac
else echo 'unit  : no result (page did not run)'; failed=1; fi

e2e="$(run_page test/app.e2e.html)"
out="$(printf '%s' "$e2e" | sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/.*<pre id="out">//; s/<\/pre>.*//' \
    | sed 's/&lt;/</g; s/&gt;/>/g; s/&quot;/"/g; s/&#39;/'"'"'/g; s/&amp;/\&/g')"
if [ -n "$out" ]; then
    good=$(printf '%s\n' "$out" | grep -c '^PASS')
    bad=$(printf '%s\n' "$out" | grep -c '^FAIL')
    note=''
    [ "$(printf '%s\n' "$out" | head -1 | tr -d '[:space:]')" = 'DONE' ] || { note='  (the page never finished: a script error or a hung wait; try test/app.e2e.html in a browser and read its console)'; failed=1; }
    echo "e2e   : $good passed, $bad failed$note"
    [ "$bad" -eq 0 ] || { failed=1; printf '%s\n' "$out" | grep '^FAIL' | sed 's/^/  /'; }
else echo 'e2e   : no result (page did not run)'; failed=1; fi

exit $failed
