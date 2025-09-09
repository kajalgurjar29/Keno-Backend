#!/usr/bin/env bash
set -e

# Set Puppeteer cache directory inside Render’s persistent build folder
export PUPPETEER_CACHE_DIR="/opt/render/.cache/puppeteer"
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

echo "Installing dependencies with Puppeteer Chromium..."
npm install