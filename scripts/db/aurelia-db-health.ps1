# AURELIA local PostgreSQL — HEALTH (Этап 15C)
#
# Healthy = (1) PostgreSQL on 6700 accepts connections AND (2) npm run db:verify
# passes. Exit code reflects health (0 = healthy, 1 = unhealthy).
# Does not print secrets.

$PORT = 6700
$BIN  = 'C:\tmp\postgresql-16.11\pgsql\bin'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

$ok = $true

# 1) Does PostgreSQL respond on 6700? (no auth needed)
& "$BIN\pg_isready.exe" -h 127.0.0.1 -p $PORT
if ($LASTEXITCODE -ne 0) {
  Write-Host "PostgreSQL is NOT ready on port $PORT."
  $ok = $false
} else {
  Write-Host "PostgreSQL is accepting connections on port $PORT."
}

# 2) Does the catalog verify pass?
if ($ok) {
  Push-Location $RepoRoot
  try {
    & npm run db:verify
    if ($LASTEXITCODE -ne 0) { $ok = $false }
  } finally {
    Pop-Location
  }
}

if ($ok) {
  Write-Host 'HEALTH: OK'
  exit 0
} else {
  Write-Host 'HEALTH: FAIL'
  exit 1
}
