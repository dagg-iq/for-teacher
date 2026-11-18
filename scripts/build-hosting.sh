#!/usr/bin/env bash
# يجمع الموقع التعريفي في مجلد hosting/ لنشره على Firebase Hosting، ويكتب download.json لزر التنزيل.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf hosting && mkdir -p hosting
cp -r apps/site/. hosting/
rm -f hosting/download-config.json
V=$(git rev-parse --short HEAD 2>/dev/null || date +%s)
sed -i "s#href=\"style.css\"#href=\"style.css?v=$V\"#; s#src=\"main.js\"#src=\"main.js?v=$V\"#" hosting/index.html
node -e '
const fs = require("fs");
const cfg = JSON.parse(fs.readFileSync("apps/site/download-config.json", "utf8"));
const d = { url: process.env.DOWNLOAD_URL || cfg.link || "", version: process.env.DOWNLOAD_VERSION || cfg.version || "", size_mb: cfg.size_mb || "", date: new Date().toISOString() };
fs.writeFileSync("hosting/download.json", JSON.stringify(d));
console.log("download.json:", JSON.stringify(d));
'
echo "✓ hosting/ جاهز"
