# AURELIA local PostgreSQL - STATUS (Stage 15C)
#
# Safe summary: port, data dir, running yes/no, quick db-verify yes/no.
# Reads the password from .env only to run a count query; never prints it.

$PORT = 6700
$DATA = 'C:\tmp\aurelia-postgres-data'
$BIN  = 'C:\tmp\postgresql-16.11\pgsql\bin'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

Write-Host 'AURELIA local PostgreSQL - status'
Write-Host '  website:   http://localhost:5000'
Write-Host "  db port:   $PORT"
Write-Host "  data dir:  $DATA"
Write-Host '  dm-bot DB: localhost:5432 (separate - do NOT touch)'

# --- running? (verify the listener really is the AURELIA cluster) ---
$running = $false
$conn = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  $opid = ($conn | Select-Object -First 1).OwningProcess
  $cmd  = (Get-CimInstance Win32_Process -Filter "ProcessId=$opid").CommandLine
  if ($cmd -like '*aurelia-postgres-data*' -and $cmd -notlike '*dm-bot*') { $running = $true }
}
Write-Host "  running:   $(if ($running) { 'yes' } else { 'no' })"

# --- quick db verify (product count) without printing secrets ---
# SQL is piped via stdin (-f -) rather than -c, because PowerShell 5.1 mangles
# embedded double-quotes in native args, which would break the "Product" identifier.
$verify = 'no'
if ($running) {
  $envPath = Join-Path $RepoRoot '.env'
  if (Test-Path $envPath) {
    $raw = Get-Content $envPath -Raw
    if ($raw -match 'postgresql://([^:]+):([^@]+)@localhost:6700/([^?]+)') {
      $u = $matches[1]; $env:PGPASSWORD = $matches[2]; $db = $matches[3]
      $cnt = ('SELECT count(*) FROM "Product";' | & "$BIN\psql.exe" -U $u -h 127.0.0.1 -p $PORT -d $db -w -tA -f -) 2>$null
      $env:PGPASSWORD = ''
      $cnt = "$cnt".Trim()
      if ($cnt -eq '10') { $verify = 'yes' }
      elseif ($cnt -match '^\d+$') { $verify = "partial ($cnt products)" }
    } else {
      $verify = 'unknown (.env DATABASE_URL not parseable)'
    }
  } else {
    $verify = 'unknown (.env missing)'
  }
}
Write-Host "  db verify: $verify"
