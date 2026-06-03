# Stop BirdX local dev processes on ports 5173 (Vite) and 5174 (API).
$procIds = @()
netstat -ano | ForEach-Object {
  if ($_ -match ':(5173|5174)\s+.*LISTENING\s+(\d+)$') {
    $procIds += [int]$Matches[2]
  }
}
$procIds = $procIds | Sort-Object -Unique
if (-not $procIds.Count) {
  Write-Host "No listeners on 5173 or 5174."
  exit 0
}
foreach ($procId in $procIds) {
  try {
    $name = (Get-Process -Id $procId -ErrorAction Stop).ProcessName
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Host "Stopped $name (PID $procId)"
  } catch {
    Write-Warning "Could not stop PID ${procId}: $($_.Exception.Message)"
  }
}
