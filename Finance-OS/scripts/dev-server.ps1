# ============================================================
#  Finance OS - Dev-Server-Verwaltung (PowerShell-Helfer, M16)
#  Wird von start-dev.bat / stop-dev.bat aufgerufen.
#
#  PID-Konzept:
#  - Start-Process npm.cmd "run dev" liefert die PID des
#    Wrapper-Prozesses; die PID + Prozessname + Startzeit werden
#    in .runtime\dev-server.pid (JSON) gespeichert.
#  - Beim Stoppen wird die PID nur beendet, wenn Prozessname UND
#    Startzeit zum gespeicherten Stand passen (Schutz gegen
#    PID-Wiederverwendung durch Windows).
#  - Beendet wird der Prozessbaum dieser einen PID (taskkill /T),
#    also npm-Wrapper + der von ihm gestartete Vite-Node-Prozess.
#    NIE werden fremde node.exe-Prozesse beendet.
#
#  Ehrliche Grenze: Windows vergibt PIDs neu. Der Abgleich ueber
#  Prozessname + Startzeit macht eine Verwechslung praktisch
#  ausgeschlossen, ist aber keine kryptografische Garantie. Im
#  Zweifel beendet das Skript NICHTS und meldet das deutlich.
# ============================================================
param(
  [Parameter(Mandatory = $true)][ValidateSet('start', 'stop')][string]$Action,
  [Parameter(Mandatory = $true)][string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
$runtimeDir = Join-Path $ProjectRoot '.runtime'
$pidFile = Join-Path $runtimeDir 'dev-server.pid'

function Read-PidRecord {
  if (-not (Test-Path -LiteralPath $pidFile)) { return $null }
  try {
    $raw = Get-Content -LiteralPath $pidFile -Raw -Encoding UTF8
    $record = $raw | ConvertFrom-Json
    if ($null -eq $record.pid -or $null -eq $record.startTime) { return $null }
    return $record
  } catch {
    return $null
  }
}

function Get-MatchingProcess($record) {
  # Liefert den Prozess NUR, wenn PID existiert und Projektwurzel,
  # Name und Startzeit zum gespeicherten Stand passen
  # (PID-Wiederverwendungs- und Projektkopie-Schutz).
  if ([string]$record.projectRoot -ne $ProjectRoot) { return $null }
  try { $proc = Get-Process -Id ([int]$record.pid) -ErrorAction Stop } catch { return $null }
  if ($proc.ProcessName -ne [string]$record.processName) { return $null }
  try {
    $actualStart = $proc.StartTime
    $storedStart = [datetime]::Parse([string]$record.startTime, $null, [System.Globalization.DateTimeStyles]::RoundtripKind)
  } catch {
    return $null
  }
  if ([math]::Abs(($actualStart - $storedStart).TotalSeconds) -gt 2) { return $null }
  return $proc
}

function Remove-PidFile {
  if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile -Force }
}

if ($Action -eq 'start') {
  if (-not (Test-Path -LiteralPath $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
  }

  $record = Read-PidRecord
  if ($null -ne $record) {
    $running = Get-MatchingProcess $record
    if ($null -ne $running) {
      Write-Host "[HINWEIS] Der Entwicklungsserver laeuft bereits (PID $($running.Id), gestartet $($record.startedAt))."
      Write-Host "          Es wird KEINE zweite Instanz gestartet. Zum Beenden: scripts\stop-dev.bat"
      exit 1
    }
    Write-Host '[HINWEIS] Veraltete PID-Datei gefunden (Prozess laeuft nicht mehr) - wird entfernt.'
    Remove-PidFile
  }

  Write-Host 'Starte den Entwicklungsserver ("npm run dev") in einem eigenen Fenster ...'
  $proc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' -WorkingDirectory $ProjectRoot -PassThru
  Start-Sleep -Seconds 2
  if ($proc.HasExited) {
    Write-Host "[FEHLER] Der Entwicklungsserver hat sich sofort beendet (Exitcode $($proc.ExitCode)). Details im Serverfenster."
    exit 1
  }

  $payload = [ordered]@{
    pid         = $proc.Id
    processName = $proc.ProcessName
    startTime   = $proc.StartTime.ToString('o')
    startedAt   = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    projectRoot = $ProjectRoot
    command     = 'npm run dev'
  }
  ($payload | ConvertTo-Json) | Out-File -LiteralPath $pidFile -Encoding utf8
  Write-Host "[OK] Entwicklungsserver gestartet (PID $($proc.Id); gespeichert in .runtime\dev-server.pid)."
  Write-Host '     Lokale URL: http://localhost:5173 (Vite-Standardport; die tatsaechliche URL steht im Serverfenster).'
  Write-Host '     Beenden mit: scripts\stop-dev.bat'
  exit 0
}

if ($Action -eq 'stop') {
  $record = Read-PidRecord
  if ($null -eq $record) {
    Write-Host '[OK] Kein von start-dev.bat gestarteter Entwicklungsserver gefunden - nichts zu tun.'
    Remove-PidFile
    exit 0
  }

  $proc = Get-MatchingProcess $record
  if ($null -eq $proc) {
    Write-Host '[OK] Der gespeicherte Serverprozess laeuft nicht mehr (oder die PID gehoert inzwischen zu einem anderen Prozess).'
    Write-Host '     Aus Sicherheitsgruenden wird NICHTS beendet; die veraltete PID-Datei wird entfernt.'
    Remove-PidFile
    exit 0
  }

  Write-Host "Beende den Entwicklungsserver (PID $($proc.Id), Prozessbaum dieses einen Starts) ..."
  & taskkill.exe /PID $proc.Id /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[FEHLER] taskkill konnte den Prozessbaum nicht beenden (Exitcode $LASTEXITCODE). PID-Datei bleibt erhalten."
    exit 1
  }
  Remove-PidFile
  Write-Host '[OK] Entwicklungsserver beendet; PID-Datei entfernt. Fremde Node-Prozesse wurden nicht angefasst.'
  exit 0
}
