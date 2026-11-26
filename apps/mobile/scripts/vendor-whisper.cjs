/**
 * ينسخ مكتبة التعرّف على الكلام داخل الجهاز (transformers.js + onnxruntime wasm) إلى public/vendor/transformers
 * فتُشحن مع نسخة الويب والحاسوب (بلا CDN وقت التشغيل). يُشغَّل قبل `expo export -p web`:
 *   node scripts/vendor-whisper.cjs
 * يأخذها من node_modules إن وُجدت، وإلا ينزّل الحزمة من npm (npm pack) ويستخرج الملفات الثلاثة فقط.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const VERSION = '3.8.1';
const FILES = ['transformers.min.js', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm'];
const out = path.join(__dirname, '..', 'public', 'vendor', 'transformers');

function fromDir(dist) {
  fs.mkdirSync(out, { recursive: true });
  for (const f of FILES) fs.copyFileSync(path.join(dist, f), path.join(out, f));
  fs.writeFileSync(path.join(out, 'VERSION'), VERSION);
  console.log(`vendor-whisper: ${FILES.length} files -> ${path.relative(process.cwd(), out)}`);
}

if (fs.existsSync(path.join(out, 'VERSION')) && fs.readFileSync(path.join(out, 'VERSION'), 'utf8').trim() === VERSION && FILES.every((f) => fs.existsSync(path.join(out, f)))) {
  console.log('vendor-whisper: up to date');
  process.exit(0);
}

let dist = null;
try {
  const pkg = require.resolve('@huggingface/transformers/package.json', { paths: [process.cwd(), __dirname] });
  const v = JSON.parse(fs.readFileSync(pkg, 'utf8')).version;
  if (v === VERSION) dist = path.join(path.dirname(pkg), 'dist');
} catch { /* not installed */ }

if (!dist) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nahj-tjs-'));
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFileSync(npm, ['pack', `@huggingface/transformers@${VERSION}`, '--silent'], { cwd: tmp, stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' });
  const tgz = fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  execFileSync('tar', ['-xzf', tgz, '-C', tmp, ...FILES.map((f) => `package/dist/${f}`)], { cwd: tmp });
  dist = path.join(tmp, 'package', 'dist');
}
fromDir(dist);
