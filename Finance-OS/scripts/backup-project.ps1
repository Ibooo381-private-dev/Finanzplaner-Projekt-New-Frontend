# ============================================================
#  Finance OS - Quellcode-Backup (PowerShell-Helfer, M16)
#
#  Enthalten (explizite Positivliste - nichts anderes):
#    src\, tests\, docs\, scripts\, public\, index.html,
#    user-data\*.example.json (NUR Beispieldateien),
#    package.json, package-lock.json, tsconfig.json,
#    vite.config.ts, eslint.config.js, .prettierrc.json,
#    .prettierignore, .gitignore, README.md, CHANGELOG.md,
#    LICENSE, CLAUDE.md, progress.md
#
#  Bewusst NICHT enthalten:
#    node_modules, dist, coverage, .runtime, .git, .claude,
#    project-backups (bestehende Backups), releases,
#    backups\ (lokales Sicherungsziel der App - potenziell echte
#    Finanzdaten), reference\ (echte private Finanznotizen),
#    "wie starte ich im daily use.txt" (private Notiz),
#    OS-/Editor-Artefakte. Echte Nutzer-Finanzdateien in
#    user-data\ (alles ausser *.example.json) bleiben aussen vor.
#    Hinweis: public\ ist derzeit leer; leere Ordner nimmt
#    Compress-Archive nicht ins ZIP auf.
#
#  WICHTIG (Vertraulichkeit): docs\, tests\, progress.md und die
#  Beispieldatei basieren inhaltlich auf den REALEN, bestaetigten
#  Finanzwerten des Projektinhabers (Start-Snapshot, Netto,
#  Institute). Das Quellcode-Backup ist deshalb selbst vertraulich
#  zu behandeln und nicht zur Weitergabe gedacht.
# ============================================================
param(
  [Parameter(Mandatory = $true)][string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$backupDir = Join-Path $ProjectRoot 'project-backups'
$zipPath = Join-Path $backupDir ("Finance-OS-source-{0}.zip" -f $timestamp)
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("financeos-backup-" + [guid]::NewGuid().ToString('n'))

$includeDirs = @('src', 'tests', 'docs', 'scripts', 'public')
$includeFiles = @(
  'index.html', 'package.json', 'package-lock.json', 'tsconfig.json',
  'vite.config.ts', 'eslint.config.js', '.prettierrc.json', '.prettierignore',
  '.gitignore', 'README.md', 'CHANGELOG.md', 'LICENSE', 'CLAUDE.md', 'progress.md',
  'RELEASE_NOTES.md'
)

try {
  New-Item -ItemType Directory -Path $staging | Out-Null

  $copied = @()
  foreach ($dir in $includeDirs) {
    $sourcePath = Join-Path $ProjectRoot $dir
    if (Test-Path -LiteralPath $sourcePath -PathType Container) {
      Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $staging $dir) -Recurse
      $copied += "$dir\"
    }
  }
  foreach ($file in $includeFiles) {
    $sourcePath = Join-Path $ProjectRoot $file
    if (Test-Path -LiteralPath $sourcePath -PathType Leaf) {
      Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $staging $file)
      $copied += $file
    }
  }

  # user-data: AUSSCHLIESSLICH Beispieldateien (*.example.json).
  $userDataSource = Join-Path $ProjectRoot 'user-data'
  if (Test-Path -LiteralPath $userDataSource -PathType Container) {
    $examples = Get-ChildItem -LiteralPath $userDataSource -Filter '*.example.json' -File
    if ($examples.Count -gt 0) {
      $userDataTarget = Join-Path $staging 'user-data'
      New-Item -ItemType Directory -Path $userDataTarget | Out-Null
      foreach ($example in $examples) {
        Copy-Item -LiteralPath $example.FullName -Destination $userDataTarget
        $copied += "user-data\$($example.Name)"
      }
    }
  }

  if ($copied.Count -eq 0) {
    Write-Host '[FEHLER] Keine zu sichernden Dateien gefunden - falsches Projektverzeichnis?'
    exit 1
  }

  if (-not (Test-Path -LiteralPath $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
  }

  Write-Host ("Erzeuge Backup: {0}" -f $zipPath)
  try {
    Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath -CompressionLevel Optimal

    # Validierung: existiert, > 0 Byte, als ZIP lesbar, Eintragszahl.
    if (-not (Test-Path -LiteralPath $zipPath)) {
      Write-Host '[FEHLER] Die Backup-Datei wurde nicht erzeugt.'
      exit 1
    }
    $zipInfo = Get-Item -LiteralPath $zipPath
    if ($zipInfo.Length -le 0) {
      Write-Host '[FEHLER] Die Backup-Datei ist leer (0 Byte).'
      Remove-Item -LiteralPath $zipPath -Force
      exit 1
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
      $entryCount = $archive.Entries.Count
      $forbidden = $archive.Entries | Where-Object {
        $_.FullName -match '^(node_modules|dist|reference|backups|project-backups|releases|\.runtime|\.git)(/|\\|$)' -or
        ($_.FullName -like 'user-data/*' -and $_.FullName -notlike '*.example.json') -or
        ($_.FullName -like 'user-data\*' -and $_.FullName -notlike '*.example.json')
      }
    } finally {
      $archive.Dispose()
    }
    if ($entryCount -le 0) {
      Write-Host '[FEHLER] Das ZIP enthaelt keine Eintraege.'
      Remove-Item -LiteralPath $zipPath -Force
      exit 1
    }
    if ($forbidden.Count -gt 0) {
      Write-Host '[FEHLER] Das ZIP enthaelt unzulaessige Eintraege (private Daten/Artefakte):'
      $forbidden | ForEach-Object { Write-Host ("  - " + $_.FullName) }
      Remove-Item -LiteralPath $zipPath -Force
      exit 1
    }
  } catch {
    # Kein Teil-ZIP zuruecklassen, das spaeter fuer ein brauchbares
    # Backup gehalten werden koennte.
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    Write-Host ("[FEHLER] Backup fehlgeschlagen: {0}" -f $_.Exception.Message)
    exit 1
  }

  Write-Host ("[OK] Backup erzeugt und validiert: {0:N0} KB, {1} ZIP-Eintraege." -f ($zipInfo.Length / 1KB), $entryCount)
  Write-Host 'Enthaltene Bestandteile (oberste Ebene):'
  $copied | Sort-Object | ForEach-Object { Write-Host ("  - " + $_) }
  Write-Host 'Ausgeschlossen: node_modules, dist, .runtime, .git, backups\, reference\ (private Notizen), private Notiz-TXT, echte JSON-Finanzdateien, bestehende Backups/Releases.'
  Write-Host '[VERTRAULICH] docs\, tests\, progress.md und die Beispieldatei basieren auf den realen Finanzwerten des Projektinhabers - dieses Backup nicht weitergeben.'
  exit 0
} finally {
  if (Test-Path -LiteralPath $staging) {
    Remove-Item -LiteralPath $staging -Recurse -Force
  }
}
