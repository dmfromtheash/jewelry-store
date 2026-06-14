# AURELIA local PostgreSQL — STOP (Этап 15C)
#
# Stops ONLY the AURELIA cluster (data dir C:\tmp\aurelia-postgres-data).
# Multiple safety guards ensure dm-bot (5432 / dm-bot-postgres-data) is never
# affected. Does not print secrets.

$PORT = 6700
$DATA = 'C:\tmp\aurelia-postgres-data'
$BIN  = 'C:\tmp\postgresql-16.11\pgsql\bin'

# --- Safety guards ---
if ($DATA -notlike '*aurelia-postgres-data' -or $DATA -like '*dm-bot*') {
  Write-Error 'Refusing: target is not the AURELIA cluster.'; exit 1
}

$pidfile = Join-Path $DATA 'postmaster.pid'
if (-not (Test-Path $pidfile)) {
  Write-Host "AURELIA PostgreSQL is not running (no postmaster.pid in $DATA)."
  exit 0
}

# Extra guard: if something is listening on 6700, verify it is OUR cluster
# (data dir contains 'aurelia-postgres-data', not 'dm-bot') before stopping.
$conn = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  $opid = ($conn | Select-Object -First 1).OwningProcess
  $cmd  = (Get-CimInstance Win32_Process -Filter "ProcessId=$opid").CommandLine
  if ($cmd -notlike '*aurelia-postgres-data*' -or $cmd -like '*dm-bot*') {
    Write-Error "Refusing to stop: process on port $PORT is NOT the AURELIA cluster."
    exit 1
  }
}

Write-Host "Stopping AURELIA PostgreSQL (data dir $DATA)..."
# pg_ctl stop targets the cluster by its data dir -> cannot affect dm-bot.
& "$BIN\pg_ctl.exe" -D $DATA -m fast stop | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "AURELIA PostgreSQL stopped."
  exit 0
} else {
  Write-Error "pg_ctl stop failed (exit $LASTEXITCODE)."
  exit 1
}
