#!/usr/bin/env bash
# يجمع الموقع التعريفي في مجلد hosting/ لنشره على Firebase Hosting، ويكتب download.json لزر التنزيل.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf hosting && mkdir -p hosting
cp -r apps/site/. hosting/
rm -f hosting/download-config.json hosting/download-desktop.json
V=$(git rev-parse --short HEAD 2>/dev/null || date +%s)
sed -i "s#href=\"style.css\"#href=\"style.css?v=$V\"#; s#src=\"main.js\"#src=\"main.js?v=$V\"#" hosting/index.html
node -e '
const fs = require("fs");
const cfg = JSON.parse(fs.readFileSync("apps/site/download-config.json", "utf8"));
let w = {};
try { w = JSON.parse(fs.readFileSync("apps/site/download-desktop.json", "utf8")); } catch {}
const d = { url: process.env.DOWNLOAD_URL || cfg.link || "", version: process.env.DOWNLOAD_VERSION || cfg.version || "", size_mb: cfg.size_mb || "",
  desktop: { url: w.link || "", portable: w.portable || "", version: w.version || "", size_mb: w.size_mb || "" }, date: new Date().toISOString() };
fs.writeFileSync("hosting/download.json", JSON.stringify(d));
console.log("download.json:", JSON.stringify(d));
'
# لوحة الإدارة: عنوان Supabase والمفتاح العام (آمن للعلن؛ الصلاحيات تُفحص في الخادم)
node -e '
const fs = require("fs");
const c = { supabaseUrl: (process.env.SUPABASE_URL || "").replace(/\/$/, ""), supabaseKey: process.env.SUPABASE_ANON_KEY || "" };
fs.writeFileSync("hosting/admin/config.js", "window.NAHJ_ADMIN = " + JSON.stringify(c) + ";\n");
console.log("admin/config.js:", c.supabaseUrl ? "ok" : "بلا Supabase");
'
sed -i "s#/admin/admin.css\"#/admin/admin.css?v=$V\"#; s#/admin/admin.js\"#/admin/admin.js?v=$V\"#; s#/admin/config.js\"#/admin/config.js?v=$V\"#" hosting/admin/index.html
echo "✓ hosting/ جاهز"
