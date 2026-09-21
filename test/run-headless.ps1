# Runs both browser suites (unit + app e2e) in headless Edge or Chrome, using a throwaway browser profile so
# nothing touches your real browser data. Needs no Node or Python.
#
#   powershell -ExecutionPolicy Bypass -File test\run-headless.ps1
#
# Exit code is 0 when everything passes.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$browser = @(
    "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { Write-Error 'No Edge or Chrome found.'; exit 2 }

$work = Join-Path ([IO.Path]::GetTempPath()) ('nf-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $work | Out-Null

function Invoke-Page([string]$relativePage) {
    $url = ([Uri](Join-Path $root $relativePage)).AbsoluteUri
    $dump = Join-Path $work ([IO.Path]::GetFileName($relativePage) + '.dom.html')
    $args = @('--headless=new', '--disable-gpu', '--allow-file-access-from-files', "--user-data-dir=`"$work\profile`"",
              '--virtual-time-budget=30000', '--dump-dom', $url)
    Start-Process -FilePath $browser -ArgumentList $args -RedirectStandardOutput $dump `
        -RedirectStandardError (Join-Path $work 'err.txt') -Wait -NoNewWindow
    Get-Content $dump -Raw
}

$failed = 0

$unit = Invoke-Page 'test\index.html'
if ($unit -match 'id="banner" class="(pass|fail)">([^<]*)') {
    Write-Host ("unit  : " + $Matches[2])
    if ($Matches[1] -ne 'pass') {
        $failed++
        [regex]::Matches($unit, '<li class="fail">(.*?)<span class="err">(.*?)</span>') |
            ForEach-Object { Write-Host ("  FAIL " + $_.Groups[1].Value + " -> " + [Net.WebUtility]::HtmlDecode($_.Groups[2].Value)) }
    }
} else { Write-Host 'unit  : no result (page did not run)'; $failed++ }

$e2e = Invoke-Page 'test\app.e2e.html'
if ($e2e -match '(?s)<pre id="out">(.*?)</pre>') {
    $lines = [Net.WebUtility]::HtmlDecode($Matches[1]) -split "`n"
    $bad = @($lines | Where-Object { $_ -like 'FAIL*' })
    $good = @($lines | Where-Object { $_ -like 'PASS*' })
    $finished = $lines[0].Trim() -eq 'DONE'
    Write-Host ("e2e   : " + $good.Count + " passed, " + $bad.Count + " failed" + $(if ($finished) { '' } else { '  (the page never finished: a script error or a hung wait; try test/app.e2e.html in a browser and read its console)' }))
    if ($bad.Count -or -not $finished) { $failed++; $bad | ForEach-Object { Write-Host "  $_" } }
} else { Write-Host 'e2e   : no result (page did not run)'; $failed++ }

Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
exit $(if ($failed) { 1 } else { 0 })
