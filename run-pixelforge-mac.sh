#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# PixelForge Studio — macOS & Unix Launch Script
# Supports Apple Silicon (M1/M2/M3/M4) & Intel (x86_64) Macs
# ══════════════════════════════════════════════════════════════════════

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=================================================================="
echo "  Starting PixelForge Studio on macOS..."
echo "  Architecture: $(uname -m)"
echo "=================================================================="

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH."
    echo "Install via Homebrew ('brew install node') or from https://nodejs.org"
    exit 1
fi

# Detect local or global Electron
if [ -x "./node_modules/.bin/electron" ]; then
    echo "Launching PixelForge Studio via Electron..."
    ./node_modules/.bin/electron . "$@"
    exit 0
elif command -v electron &> /dev/null; then
    echo "Launching PixelForge Studio via system Electron..."
    electron . "$@"
    exit 0
fi

# Fallback to local web application mode with native macOS open
echo "Electron not installed. Starting high-performance web server on port 8080..."
node server.js &
SERVER_PID=$!

sleep 1

if command -v open &> /dev/null; then
    open "http://localhost:8080"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:8080"
fi

echo "PixelForge Studio web application is running at http://localhost:8080"
echo "Press Ctrl+C (or Cmd+C) to quit."
wait $SERVER_PID
