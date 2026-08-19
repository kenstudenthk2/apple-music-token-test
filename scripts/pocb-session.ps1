<#
.SYNOPSIS
    Bring up a complete POC-B test session: pairing server, HTTPS tunnel, and a
    matching APK.

.DESCRIPTION
    Run this yourself, in your own terminal. That is the point of the script.

    An agent cannot host this: background processes it starts are reaped when
    its turn ends, which kills the tunnel and leaves any APK built against that
    hostname pointing at a dead URL. Started from your shell, both processes
    live as long as the window stays open.

    Cloudflare quick tunnels get a fresh random hostname every start, and the
    harness URL is compiled into the APK, so a new tunnel always needs a new
    APK. This script does both in order so they cannot drift apart.

    Ctrl+C, or closing the window, stops everything.

.PARAMETER SkipApk
    Bring up the server and tunnel only, and print the URL. Use this when you
    already have a working APK and only need the backend up again — though note
    that a restarted tunnel has a different hostname, so an existing APK will
    not match.

.EXAMPLE
    .\scripts\pocb-session.ps1
#>

param(
    [switch]$SkipApk
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"

if (-not (Test-Path $cloudflared)) {
    throw "cloudflared not found at $cloudflared. Install it with: winget install --id Cloudflare.cloudflared"
}

$processes = @()

function Stop-Everything {
    foreach ($p in $script:processes) {
        if ($p -and -not $p.HasExited) {
            Write-Host "Stopping PID $($p.Id)…" -ForegroundColor DarkGray
            try { Stop-Process -Id $p.Id -Force -Confirm:$false } catch { }
        }
    }
}

try {
    # ---- 1. Pairing server -------------------------------------------------
    # Needs the Apple .p8, which is why this cannot run on a CI runner.
    Write-Host "Starting pairing server on :8787…" -ForegroundColor Cyan
    $server = Start-Process -FilePath "node" -ArgumentList "pairing-server.js" `
        -WorkingDirectory $repo -PassThru -NoNewWindow
    $processes += $server

    $up = $false
    foreach ($i in 1..20) {
        Start-Sleep -Milliseconds 500
        try {
            Invoke-WebRequest -Uri "http://localhost:8787/api/developer-token" -UseBasicParsing -TimeoutSec 3 | Out-Null
            $up = $true
            break
        } catch { }
    }
    if (-not $up) { throw "The pairing server did not come up. Is port 8787 already in use, and is secure/*.p8 present?" }
    Write-Host "  pairing server OK" -ForegroundColor Green

    # ---- 2. HTTPS tunnel ---------------------------------------------------
    # HTTPS is not optional: EME, and therefore Widevine, is blocked outside a
    # secure context, so plain LAN HTTP cannot work no matter how convenient.
    Write-Host "Opening HTTPS tunnel…" -ForegroundColor Cyan
    $log = Join-Path $env:TEMP "pocb-tunnel-$PID.log"
    if (Test-Path $log) { Remove-Item $log -Force }

    $tunnel = Start-Process -FilePath $cloudflared `
        -ArgumentList "tunnel","--url","http://localhost:8787","--no-autoupdate" `
        -PassThru -NoNewWindow -RedirectStandardError $log
    $processes += $tunnel

    $base = $null
    foreach ($i in 1..60) {
        Start-Sleep -Milliseconds 500
        if (Test-Path $log) {
            $match = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue |
                     Select-Object -First 1
            if ($match) {
                $base = $match.Matches[0].Value
                break
            }
        }
    }
    if (-not $base) { throw "The tunnel did not report a hostname. See $log" }

    $harness = "$base/pocb/"
    Write-Host ""
    Write-Host "  Harness : $harness" -ForegroundColor Green
    Write-Host "  Prototype pairing test also available at $base" -ForegroundColor DarkGray
    Write-Host ""

    # ---- 3. Matching APK ---------------------------------------------------
    if (-not $SkipApk) {
        Write-Host "Building an APK for this hostname (about 1 minute)…" -ForegroundColor Cyan
        Push-Location $repo
        try {
            gh workflow run pocb-apk.yml -f url=$harness | Out-Null
            Start-Sleep -Seconds 8
            $runId = (gh run list --workflow=pocb-apk.yml --limit 1 --json databaseId --jq ".[0].databaseId")
            gh run watch $runId --exit-status --interval 15 | Out-Null

            $out = Join-Path $repo "dist\apk"
            if (Test-Path $out) { Remove-Item $out -Recurse -Force }
            New-Item -ItemType Directory -Path $out -Force | Out-Null
            gh run download $runId -n pocb-apk -D $out | Out-Null

            $apk = Join-Path $out "pocb-playback-test.apk"
            Move-Item (Join-Path $out "app-debug.apk") $apk -Force
            Write-Host "  APK: $apk" -ForegroundColor Green
        } finally {
            Pop-Location
        }
    }

    Write-Host ""
    Write-Host "Session is up. Leave this window open for the whole test." -ForegroundColor Yellow
    Write-Host "Ctrl+C to stop the server and close the tunnel." -ForegroundColor Yellow
    Write-Host ""

    # Park here so the child processes stay alive and Ctrl+C reaches the finally.
    while ($true) {
        Start-Sleep -Seconds 5
        if ($server.HasExited) { throw "The pairing server exited unexpectedly." }
        if ($tunnel.HasExited) { throw "The tunnel exited unexpectedly." }
    }
}
finally {
    Stop-Everything
}
