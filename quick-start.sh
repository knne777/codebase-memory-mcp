#!/bin/bash
# quick-start.sh — Build and run codebase-memory-mcp from LOCAL source.
# This ensures your modifications (Business Intelligence, Diagrams) are included.

echo "--- codebase-memory-mcp: Local Build & Start ---"

# 1. Detect Environment
OS="linux"
if [[ "$OSTYPE" == "darwin"* ]]; then OS="darwin"; fi
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then OS="windows"; fi

echo "OS Detected: $OS"

# 2. Build UI (if node is available)
if command -v npm &> /dev/null; then
    echo "Step 1: Building Graph UI..."
    cd graph-ui
    npm install --silent
    npm run build --silent
    cd ..
    # Embed UI into C source
    bash scripts/embed-frontend.sh graph-ui/dist build/embedded
else
    echo "Warning: npm not found. UI might be missing or using stale assets."
fi

# 3. Build C Core
echo "Step 2: Building C Core..."
# Check for make
if command -v make &> /dev/null; then
    make -f Makefile.cbm cbm
else
    echo "Error: 'make' not found. Please install build-essential (Linux) or Xcode (macOS)."
    exit 1
fi

# 4. Start Indexing
BIN="./build/c/codebase-memory-mcp"
if [ "$OS" == "windows" ]; then BIN="./build/c/codebase-memory-mcp.exe"; fi

if [ -f "$BIN" ]; then
    echo "Step 3: Starting local binary..."
    $BIN index .
else
    echo "Error: Build failed. Binary not found at $BIN"
    exit 1
fi

echo "----------------------------------------"
echo "Local Execution Started!"
echo "UI available at: http://localhost:9749"
echo "----------------------------------------"
