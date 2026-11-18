/**
 * يولّد قائمة المكتبات مفتوحة المصدر وتراخيصها لشاشة «التراخيص» في التطبيق:
 *   node scripts/gen-licenses.cjs  →  apps/mobile/src/data/licenses.json
 * يقرأ اعتماديات التطبيق المباشرة (والمكتبة المشتركة) من node_modules.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pkgs = ['apps/mobile/package.json', 'packages/shared/package.json'].map((p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')));
const names = [...new Set(pkgs.flatMap((p) => Object.keys(p.dependencies || {})))].filter((n) => !n.startsWith('@nahj/')).sort();
const find = (n) => [path.join(ROOT, 'apps/mobile/node_modules', n, 'package.json'), path.join(ROOT, 'node_modules', n, 'package.json')].find((f) => fs.existsSync(f));
const out = names.map((n) => {
  const f = find(n);
  if (!f) return null;
  const p = JSON.parse(fs.readFileSync(f, 'utf8'));
  let repo = typeof p.repository === 'string' ? p.repository : p.repository?.url || p.homepage || '';
  repo = repo.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://').replace(/^github:/, 'https://github.com/');
  if (/^[\w-]+\/[\w.-]+$/.test(repo)) repo = `https://github.com/${repo}`;
  const license = typeof p.license === 'string' ? p.license : p.license?.type || (p.licenses?.[0]?.type) || 'انظر المصدر';
  return { name: n, version: p.version, license, url: repo.startsWith('http') ? repo : '' };
}).filter(Boolean);
const dest = path.join(ROOT, 'apps/mobile/src/data/licenses.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
console.log(`✓ ${out.length} مكتبة → ${path.relative(ROOT, dest)}`);
