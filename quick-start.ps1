# quick-start.ps1 — Build and run codebase-memory-mcp from LOCAL source (Windows).
# This ensures your modifications (Business Intelligence, Diagrams) are included.

Write-Host "`n--- codebase-memory-mcp: Windows Local Build & Start ---" -ForegroundColor Cyan

# 1. Build UI (if node is available)
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "Step 1: Building Graph UI..." -ForegroundColor Gray
    Set-Location graph-ui
    npm install --silent
    npm run build --silent
    Set-Location ..
    # Embed UI into C source
    if (Get-Command bash -ErrorAction SilentlyContinue) {
        bash scripts/embed-frontend.sh
    } else {
        Write-Host "Warning: bash not found. Cannot embed UI assets. Using stubs." -ForegroundColor Yellow
    }
} else {
    Write-Host "Warning: npm not found. UI might be missing." -ForegroundColor Yellow
}

# 2. Build C Core
Write-Host "Step 2: Building C Core..." -ForegroundColor Gray
# On Windows, we try to use the setup-windows script or direct build if make is present
if (Get-Command make -ErrorAction SilentlyContinue) {
    make -f Makefile.cbm cbm
} else {
    Write-Host "Error: 'make' not found. Please install Mingw-w64 or use a developer terminal." -ForegroundColor Red
    Write-Host "Alternative: Try running 'scripts/setup-windows.ps1 -FromSource'" -ForegroundColor Cyan
    exit 1
}

# 3. Start Indexing
$Bin = ".\build\c\codebase-memory-mcp.exe"
if (Test-Path $Bin) {
    Write-Host "Step 3: Starting local binary..." -ForegroundColor Gray
    & $Bin index .
} else {
    Write-Host "Error: Build failed. Binary not found at $Bin" -ForegroundColor Red
    exit 1
}

Write-Host "`n----------------------------------------" -ForegroundColor Green
Write-Host "Local Execution Started!" -ForegroundColor Green
Write-Host "UI available at: http://localhost:9749" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Green
