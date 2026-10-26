# Saker Energy - One-click start all services
$ErrorActionPreference = "SilentlyContinue"
$py = "C:\Users\64149\AppData\Local\Programs\Python\Python311\python.exe"
$dir = "E:\saker-energy-main\backend"

Write-Host "=== Saker Energy Service Startup ===" -ForegroundColor Cyan

# Stop old processes
Write-Host "Stopping old processes..."
Stop-Process -Name "sim","ingest","workorder","python" -Force -ErrorAction SilentlyContinue
Start-Sleep 2

# Start simulator (normal mode, no fault)
Write-Host "Starting simulator..."
Start-Process -FilePath "$dir\sim\sim.exe" -ArgumentList "--nats","nats://localhost:4222","--seed","42","--interval","3" -WindowStyle Hidden

# Start ingest
Write-Host "Starting ingest..."
Start-Process -FilePath "$dir\ingest\ingest.exe" -ArgumentList "--nats","nats://localhost:4222","--db","postgres://saker:saker_dev_password@localhost:55432/saker?sslmode=disable" -WindowStyle Hidden

# Start detector
Write-Host "Starting detector..."
Start-Process -FilePath $py -ArgumentList "$dir\detector\main.py" -WindowStyle Hidden

# Start aggregator
Write-Host "Starting aggregator..."
Start-Process -FilePath $py -ArgumentList "$dir\aggregator\main.py" -WindowStyle Hidden

# Start agent
Write-Host "Starting diagnostic agent..."
Start-Process -FilePath $py -ArgumentList "$dir\agent\main.py" -WindowStyle Hidden

# Start ML anomaly detector
Write-Host "Starting ML anomaly detector..."
Start-Process -FilePath $py -ArgumentList "$dir\ml_detector\main.py" -WindowStyle Hidden

# Start workorder API
Write-Host "Starting workorder API on :8080..."
Start-Process -FilePath "$dir\workorder\workorder.exe" -WindowStyle Hidden

Start-Sleep 3
Write-Host ""
Write-Host "=== All services started ===" -ForegroundColor Green
Write-Host "Dashboard: file:///$dir/dashboard.html"
Write-Host "API: http://localhost:8080/api/"
Write-Host ""
Write-Host "To inject a fault, stop sim and run:"
Write-Host "  .\sim\sim.exe --fault F01_module_over_temperature"
Write-Host "  .\sim\sim.exe --fault F07_cell_temperature_spread"
Write-Host "  .\sim\sim.exe --fault F11_grid_voltage_disturb"
