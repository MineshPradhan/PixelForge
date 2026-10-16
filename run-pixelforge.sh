#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# PixelForge Studio — Linux Launch Script
# ══════════════════════════════════════════════════════════════════════

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=================================================================="
echo "  Starting PixelForge Studio on Linux..."
echo "=================================================================="

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH."
    echo "Please install Node.js 18+ to run PixelForge Studio."
    exit 1
fi

# Detect execution mode (Desktop via Electron or Web via server.js)
if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
    if [ -x "./node_modules/.bin/electron" ]; then
        echo "Launching Desktop Electron application..."
        ./node_modules/.bin/electron . "$@"
        exit 0
    elif command -v electron &> /dev/null; then
        echo "Launching Desktop via system electron..."
        electron . "$@"
        exit 0
    fi
fi

# Web fallback mode
echo "Desktop display server not found or Electron not installed."
echo "Starting PixelForge Local Web Server on port 8080..."

node server.js &
SERVER_PID=$!

sleep 1

if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:8080"
elif command -v sensible-browser &> /dev/null; then
    sensible-browser "http://localhost:8080"
fi

echo "PixelForge Studio is running at http://localhost:8080"
echo "Press Ctrl+C to terminate."
wait $SERVER_PID
