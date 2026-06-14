# AURELIA local PostgreSQL — START (Этап 15C)
#
# Starts the ISOLATED AURELIA cluster on port 6700 only.
# NEVER touches dm-bot (port 5432 / C:\tmp\dm-bot-postgres-data).
# Does not print the password or DATABASE_URL.

$PORT = 6700
$DATA = 'C:\tmp\aurelia-postgres-data'
$BIN  = 'C:\tmp\postgresql-16.11\pgsql\bin'

# --- Safety guards: target MUST be the AURELIA cluster, never dm-bot ---
if ($DATA -notlike '*aurelia-postgres-data' -or $DATA -like '*dm-bot*') {
  Write-Error 'Refusing: data dir is not the AURELIA cluster.'; exit 1
}
if (-not (Test-Path (Join-Path $DATA 'PG_VERSION'))) {
  Write-Error "AURELIA data dir not initialised at $DATA"; exit 1
}

function Test-PortListening {
  [bool](Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue)
}

if (Test-PortListening) {
  Write-Host "AURELIA PostgreSQL already running on port $PORT."
  exit 0
}

Write-Host "Starting AURELIA PostgreSQL (port $PORT, data dir $DATA)..."
# Launch detached via Start-Process so the postgres server gets its OWN console
# and does not inherit the caller's stdout pipe handle (a plain `&` call would
# let postgres keep that pipe open, hanging any stdout-capturing parent). The
# port lives in postgresql.conf, so no space-containing -o argument is needed.
# -W = pg_ctl does not block. No -Wait here: Start-Process -Wait can block on the
# whole process tree (incl. the long-lived server). We just fire-and-detach, then
# poll readiness below.
Start-Process -FilePath "$BIN\pg_ctl.exe" `
  -ArgumentList '-D', $DATA, '-l', (Join-Path $DATA 'server.log'), '-W', 'start' `
  -WindowStyle Hidden | Out-Null

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  & "$BIN\pg_isready.exe" -h 127.0.0.1 -p $PORT -q
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Milliseconds 500
}

if ($ready) {
  Write-Host "AURELIA PostgreSQL is up and accepting connections on port $PORT."
  exit 0
} else {
  Write-Error "Server did not become ready in time. Check $(Join-Path $DATA 'server.log')."
  exit 1
}
