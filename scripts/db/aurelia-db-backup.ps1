# AURELIA local PostgreSQL — BACKUP (Этап 15C)
#
# Dumps the AURELIA database (custom format) into backups/db/.
# Reads the password from .env only to authenticate pg_dump; never prints it.
# The dump contains catalog data only — NO role passwords (pg_dump of a single
# database does not export cluster-wide credentials). backups/ is gitignored.

$PORT = 6700
$BIN  = 'C:\tmp\postgresql-16.11\pgsql\bin'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

$envPath = Join-Path $RepoRoot '.env'
if (-not (Test-Path $envPath)) { Write-Error 'No .env found.'; exit 1 }

$raw = Get-Content $envPath -Raw
if ($raw -notmatch 'postgresql://([^:]+):([^@]+)@localhost:6700/([^?]+)') {
  Write-Error 'DATABASE_URL for localhost:6700 not found / not parseable in .env.'
  exit 1
}
$u = $matches[1]; $pw = $matches[2]; $db = $matches[3]

$backupDir = Join-Path $RepoRoot 'backups\db'
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force | Out-Null }

$ts   = Get-Date -Format 'yyyyMMdd-HHmmss'
$file = Join-Path $backupDir "aurelia-$ts.dump"

Write-Host "Backing up database '$db' (port $PORT) ..."
$env:PGPASSWORD = $pw
& "$BIN\pg_dump.exe" -U $u -h 127.0.0.1 -p $PORT -d $db -F c -f $file
$code = $LASTEXITCODE
$env:PGPASSWORD = ''

if ($code -eq 0 -and (Test-Path $file)) {
  $sizeKb = [math]::Round((Get-Item $file).Length / 1KB, 1)
  Write-Host "Backup written: $file ($sizeKb KB)"
  Write-Host 'Restore is intentionally NOT automated - see docs/backend/LOCAL_DB_OPERATIONS.md.'
  exit 0
} else {
  Write-Error "pg_dump failed (exit $code)."
  exit 1
}
