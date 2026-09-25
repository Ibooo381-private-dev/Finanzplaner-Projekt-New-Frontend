# ============================================================
#  Finance OS - lokaler Release (PowerShell-Helfer, M16)
#  Wird von release.bat aufgerufen. Erzeugt einen reproduzierbaren
#  Release-Ordner mit produktivem Build, Doku, Manifest und ZIP.
#  Keine Pushes, keine Tags, keine Quell-/Nutzerdaten im Release.
# ============================================================
param(
  [Parameter(Mandatory = $true)][string]$ProjectRoot,
  [Parameter(Mandatory = $true)][int]$AllowDirty,
  # Ehrlicher Smoke-Test-Status fuer das Manifest: Standard ist die
  # wahrheitsgemaesse Aussage, dass DIESER Lauf keinen Smoke-Test enthielt.
  [string]$SmokeTestStatus = 'nicht Teil dieses Laufs - letzter dokumentierter Stand siehe progress.md'
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $ProjectRoot

function Invoke-Step([string]$Title, [scriptblock]$Body) {
  Write-Host ''
  Write-Host ('--- ' + $Title + ' ---')
  & $Body
  if ($LASTEXITCODE -ne 0) {
    Write-Host ("[ABBRUCH] Schritt fehlgeschlagen: {0} (Exitcode {1})" -f $Title, $LASTEXITCODE)
    exit $LASTEXITCODE
  }
}

# 1) Git-Zustand pruefen (kein stiller Dirty-Release). Bewusst auf das
#    Projektverzeichnis gescopet: die Repo-Wurzel enthaelt weitere private
#    Ordner ausserhalb der App (z. B. Notiz-Ordner), die den Release-Status
#    des Projekts nicht beeinflussen.
$gitStatus = & git.exe status --porcelain -- .
if ($LASTEXITCODE -ne 0) {
  Write-Host '[FEHLER] git status konnte nicht ausgefuehrt werden.'
  exit 1
}
$isDirty = -not [string]::IsNullOrWhiteSpace(($gitStatus -join "`n"))
if ($isDirty) {
  Write-Host '[HINWEIS] Die Arbeitskopie enthaelt uncommittete Aenderungen:'
  $gitStatus | ForEach-Object { Write-Host ('  ' + $_) }
  if ($AllowDirty -ne 1) {
    Write-Host '[ABBRUCH] Release abgebrochen. Erst committen - oder bewusst mit "release.bat --allow-dirty" freigeben.'
    exit 1
  }
  Write-Host '[HINWEIS] --allow-dirty gesetzt: Der Release wird im Manifest deutlich als DIRTY gekennzeichnet.'
}

# 2) Version aus package.json.
$package = Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version
if ([string]::IsNullOrWhiteSpace($version)) {
  Write-Host '[FEHLER] Keine Version in package.json gefunden.'
  exit 1
}
Write-Host ("Projekt: {0}  Version: {1}" -f $package.name, $version)

# 2b) Schutz bestehender Release-Artefakte derselben Version: nur nach
#     ausdruecklicher Bestaetigung ersetzen (und auch dann erst NACH
#     erfolgreichem Build + Validierung, siehe Staging-Swap unten).
$releaseRoot = Join-Path $ProjectRoot 'releases'
$releaseName = "finance-os-v$version"
$releaseDir = Join-Path $releaseRoot $releaseName
$zipPath = Join-Path $releaseRoot ($releaseName + '.zip')
if ((Test-Path -LiteralPath $releaseDir) -or (Test-Path -LiteralPath $zipPath)) {
  Write-Host ("[HINWEIS] Fuer Version {0} existieren bereits Release-Artefakte in releases\." -f $version)
  Write-Host '          Sie werden erst nach erfolgreichem Build + Validierung ersetzt.'
  $answer = Read-Host 'Bestehenden Release dieser Version ersetzen? [J/N]'
  if ($answer -ne 'J' -and $answer -ne 'j') {
    Write-Host '[ABBRUCH] Bestehender Release bleibt unveraendert.'
    exit 1
  }
}

# 3-6) clean (nur dist) -> lint -> Tests -> Build.
Invoke-Step 'Aufraeumen (dist entfernen)' {
  if (Test-Path -LiteralPath 'dist') { Remove-Item -LiteralPath 'dist' -Recurse -Force }
  $global:LASTEXITCODE = 0
  Write-Host 'dist\ entfernt bzw. nicht vorhanden.'
}
$testSummary = ''
Invoke-Step 'Lint' { & npm.cmd run lint }
Invoke-Step 'Tests (vollstaendig, einmalig)' {
  & npm.cmd test | Tee-Object -Variable testOut
  $script:testOutAll = $testOut
  $summaryLine = $testOut | Where-Object { $_ -match 'Tests\s+\d+ passed' } | Select-Object -Last 1
  if ($null -ne $summaryLine) { $script:testSummary = $summaryLine.Trim() }
}
Invoke-Step 'Build (Typpruefung + Vite)' { & npm.cmd run build }
if (-not (Test-Path -LiteralPath 'dist\index.html')) {
  Write-Host '[FEHLER] Build-Ausgabe dist\index.html fehlt.'
  exit 1
}

# 7) Release in einen Staging-Ordner bauen; der bestehende Release wird
#    erst NACH vollstaendiger Validierung ersetzt (kein Restfenster, in dem
#    der alte Ordner weg und der neue unvollstaendig ist).
if (-not (Test-Path -LiteralPath $releaseRoot)) {
  New-Item -ItemType Directory -Path $releaseRoot | Out-Null
}
$stagingDir = Join-Path $releaseRoot ('.staging-' + [guid]::NewGuid().ToString('n'))
$zipTmp = Join-Path $releaseRoot ($releaseName + '.neu.zip')
try {
  New-Item -ItemType Directory -Path $stagingDir | Out-Null

  # 8) Dateien kopieren: produktiver Build + Doku (keine Quell-/Nutzerdaten).
  Copy-Item -LiteralPath 'dist' -Destination (Join-Path $stagingDir 'app') -Recurse
  foreach ($doc in @('README.md', 'CHANGELOG.md', 'LICENSE', 'RELEASE_NOTES.md')) {
    if (Test-Path -LiteralPath $doc -PathType Leaf) {
      Copy-Item -LiteralPath $doc -Destination $stagingDir
    }
  }
  if (Test-Path -LiteralPath 'docs\USER_GUIDE.md' -PathType Leaf) {
    New-Item -ItemType Directory -Path (Join-Path $stagingDir 'docs') | Out-Null
    Copy-Item -LiteralPath 'docs\USER_GUIDE.md' -Destination (Join-Path $stagingDir 'docs\USER_GUIDE.md')
  }

$startHints = @"
# Finance OS $version - Start- und Nutzungshinweise

Dieser Ordner enthaelt den produktiven Build (app\) der lokalen
Finanzanwendung Finance OS. Es gibt keine Cloud, keinen Server und
keine Netzwerkzugriffe; alle Finanzdaten liegen in einer JSON-Datei,
die der Nutzer selbst oeffnet und speichert.

Start:
- Der Build ist eine statische Single-Page-App (ES-Module). Ein
  Doppelklick auf app\index.html funktioniert in vielen Browsern
  NICHT (file://-Beschraenkung fuer Module).
- Empfohlen: den Ordner app\ mit einem beliebigen statischen
  Webserver bereitstellen, z. B. aus dem Projekt heraus mit
  "npm run preview" oder mit einem lokalen Webserver eigener Wahl.
- Danach im Browser die angezeigte lokale URL oeffnen und ueber
  "Daten & Backups" die eigene JSON-Finanzdatei laden
  (Startvorlage: user-data\finance-data.example.json im Quellprojekt).

Details zur Bedienung: README.md und docs\USER_GUIDE.md (im selben Ordner).
Version und Pruefstatus: release-manifest.json.
Privates persoenliches Projekt - keine Veroeffentlichung, alles bleibt lokal.
"@
  $startHints | Out-File -LiteralPath (Join-Path $stagingDir 'RELEASE-HINWEISE.md') -Encoding utf8

  # 9) Manifest (nur echte, in diesem Lauf ermittelte Werte).
  $nodeVersion = (& node.exe --version).Trim()
  if ($LASTEXITCODE -ne 0) { Write-Host '[FEHLER] node --version fehlgeschlagen.'; exit 1 }
  $npmVersion = (& npm.cmd --version).Trim()
  if ($LASTEXITCODE -ne 0) { Write-Host '[FEHLER] npm --version fehlgeschlagen.'; exit 1 }
  $gitCommit = (& git.exe rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { Write-Host '[FEHLER] git rev-parse HEAD fehlgeschlagen.'; exit 1 }
  $gitBranch = (& git.exe rev-parse --abbrev-ref HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { Write-Host '[FEHLER] git rev-parse --abbrev-ref fehlgeschlagen.'; exit 1 }
  # Lokaler Tag auf HEAD (nur echte Werte: leer, wenn kein Tag existiert).
  $tagLines = @(& git.exe tag --points-at HEAD)
  if ($LASTEXITCODE -ne 0) { Write-Host '[FEHLER] git tag --points-at fehlgeschlagen.'; exit 1 }
  $gitTag = $null
  $tagScope = $null
  if ($tagLines.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($tagLines[0])) {
    $gitTag = $tagLines[0].Trim()
    $tagScope = 'local-only'
  }
  # Wurde HEAD zu einem Remote gepusht? (Reine Lese-Pruefung; bei Git-Fehler
  # ehrlich null statt eines behaupteten false.)
  $remoteContains = @(& git.exe branch -r --contains HEAD)
  $isPushed = $null
  if ($LASTEXITCODE -eq 0) { $isPushed = ($remoteContains.Count -gt 0) }

  # Testzahlen aus dem realen Lauf parsen.
  $testFiles = $null
  $testsPassed = $null
  $testsFailed = 0
  $fileLine = $script:testOutAll | Where-Object { $_ -match 'Test Files' } | Select-Object -Last 1
  if ($fileLine -match '(\d+)\s+passed') { $testFiles = [int]$Matches[1] }
  if ($testSummary -match '(\d+)\s+passed') { $testsPassed = [int]$Matches[1] }
  if ($testSummary -match '(\d+)\s+failed') { $testsFailed = [int]$Matches[1] }

  $appFiles = Get-ChildItem -LiteralPath (Join-Path $stagingDir 'app') -Recurse -File
  $appPrefixLength = (Join-Path $stagingDir 'app').Length + 1
  $dirtyWarning = $null
  if ($isDirty) { $dirtyWarning = 'ACHTUNG: Release aus einer Arbeitskopie mit uncommitteten Aenderungen (--allow-dirty).' }
  $mainFiles = @()
  $mainFiles += Get-ChildItem -LiteralPath $stagingDir -File | ForEach-Object { $_.Name }
  $mainFiles += 'release-manifest.json'
  if (Test-Path -LiteralPath (Join-Path $stagingDir 'docs\USER_GUIDE.md')) { $mainFiles += 'docs\USER_GUIDE.md' }
  $mainFiles += $appFiles | ForEach-Object { 'app\' + $_.FullName.Substring($appPrefixLength) }
  $manifest = [ordered]@{
    productName               = 'Finance OS'
    version                   = $version
    releaseType               = 'local-final'
    privacyMode               = 'private-local-only'
    createdAt                 = (Get-Date).ToString('o')
    gitCommit                 = $gitCommit
    gitBranch                 = $gitBranch
    gitTag                    = $gitTag
    tagScope                  = $tagScope
    pushed                    = $isPushed
    published                 = $false
    dirty                     = $isDirty
    dirtyWarning              = $dirtyWarning
    nodeVersion               = $nodeVersion
    npmVersion                = $npmVersion
    testFiles                 = $testFiles
    testsPassed               = $testsPassed
    testsFailed               = $testsFailed
    buildStatus               = 'passed (dieser Lauf)'
    lintStatus                = 'passed (dieser Lauf)'
    checkAllStatus            = 'passed (Lint + Tests + Build in diesem Lauf; identische Schritte wie scripts\check-all.bat)'
    smokeTestStatus           = $SmokeTestStatus
    includedArtifacts         = $mainFiles
    excludedPrivatePaths      = @('reference/', 'backups/', 'user-data/ (echte Dateien; nur *.example.json waere zulaessig, ist aber nicht Teil des Release)', 'wie starte ich im daily use.txt', 'src/', 'tests/', 'node_modules/', '.git/', '.claude/', '.runtime/', 'project-backups/', 'releases/ (aeltere Artefakte)')
    knownLimitationsReference = 'README.md (Bekannte Einschraenkungen V1); progress.md (V1.x - Offene Punkte); docs/V1_X_ROADMAP.md'
    license                   = 'Alle Rechte vorbehalten - privates persoenliches Projekt (siehe LICENSE)'
    confidentialityNotice     = 'Privates persoenliches Projekt. Release, Backups, Commits und Tags bleiben ausschliesslich lokal; keine Veroeffentlichung, kein Push, kein Upload.'
    buildOutput               = 'app\ (Vite-Produktions-Build aus dist\)'
    appFileCount              = $appFiles.Count
  }
  ($manifest | ConvertTo-Json -Depth 4) | Out-File -LiteralPath (Join-Path $stagingDir 'release-manifest.json') -Encoding utf8

  # 10) Validierung im Staging, ZIP vorbereiten, dann atomar tauschen.
  foreach ($required in @('app\index.html', 'release-manifest.json', 'RELEASE-HINWEISE.md', 'README.md', 'CHANGELOG.md', 'LICENSE', 'RELEASE_NOTES.md', 'docs\USER_GUIDE.md')) {
    if (-not (Test-Path -LiteralPath (Join-Path $stagingDir $required))) {
      Write-Host ("[FEHLER] Release unvollstaendig - fehlt: {0}. Bestehende Artefakte bleiben unveraendert." -f $required)
      exit 1
    }
  }
  if (Test-Path -LiteralPath $zipTmp) { Remove-Item -LiteralPath $zipTmp -Force }
  Compress-Archive -Path (Join-Path $stagingDir '*') -DestinationPath $zipTmp -CompressionLevel Optimal

  # Tausch erst jetzt: alte Artefakte werden ausschliesslich durch einen
  # vollstaendig validierten neuen Stand ersetzt.
  if (Test-Path -LiteralPath $releaseDir) { Remove-Item -LiteralPath $releaseDir -Recurse -Force }
  Move-Item -LiteralPath $stagingDir -Destination $releaseDir
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  Move-Item -LiteralPath $zipTmp -Destination $zipPath
} finally {
  # Staging-Reste nur entfernen, wenn der Tausch sie nicht verbraucht hat
  # (Fehler-/Abbruchfall); ein fertiger Release wird hier nie angefasst.
  if (Test-Path -LiteralPath $stagingDir) { Remove-Item -LiteralPath $stagingDir -Recurse -Force }
  if (Test-Path -LiteralPath $zipTmp) { Remove-Item -LiteralPath $zipTmp -Force }
}

Write-Host ''
Write-Host ("[ERFOLG] Release erzeugt: {0}" -f $releaseDir)
Write-Host ("         ZIP:             {0}" -f $zipPath)
Write-Host ("         Version {0} | Commit {1} | Branch {2} | dirty={3}" -f $version, $gitCommit.Substring(0, 7), $gitBranch, $isDirty)
if ($testSummary -ne '') { Write-Host ("         Tests: {0}" -f $testSummary) }
exit 0
