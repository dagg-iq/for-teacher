/**
 * لوحة إدارة نَهج — صفحة واحدة بلا أدوات بناء.
 *  - الدخول: Google عبر Firebase Auth (الإعدادات من /__/firebase/init.json على Firebase Hosting).
 *  - كل العمليات: دالة Supabase «admin» (تتحقق من الرمز وبريد المدير على الخادم).
 *  - للاختبار: window.__ADMIN_TEST__ = { me, api(action, args) } يتجاوز Firebase والخادم.
 */
const CFG = window.NAHJ_ADMIN || {};
const TEST = window.__ADMIN_TEST__ || null;
const FB = 'https://www.gstatic.com/firebasejs/11.0.2';

// ───────────────────────── أدوات صغيرة
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = (v) => Number(v || 0).toLocaleString('en-US');
const pad = (x) => String(x).padStart(2, '0');
const fmtDate = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const fmtDateTime = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${fmtDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function plural(k, [one, two, few, many]) {
  if (k === 1) return one;
  if (k === 2) return two;
  if (k >= 3 && k <= 10) return `${k} ${few}`;
  return `${k} ${many}`;
}
function ago(iso) {
  if (!iso) return 'لم يحدث';
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'الآن';
  const m = Math.floor(s / 60); if (m < 60) return `منذ ${plural(m, ['دقيقة', 'دقيقتين', 'دقائق', 'دقيقة'])}`;
  const h = Math.floor(m / 60); if (h < 24) return `منذ ${plural(h, ['ساعة', 'ساعتين', 'ساعات', 'ساعة'])}`;
  const d = Math.floor(h / 24); if (d < 31) return `منذ ${plural(d, ['يوم', 'يومين', 'أيام', 'يوماً'])}`;
  const mo = Math.floor(d / 30); if (mo < 12) return `منذ ${plural(mo, ['شهر', 'شهرين', 'أشهر', 'شهراً'])}`;
  return fmtDate(iso);
}
const bytes = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} م.ب` : b >= 1024 ? `${Math.round(b / 1024)} ك.ب` : `${b || 0} بايت`);
const initial = (t) => esc(((t.name || t.email || '؟').trim().replace(/^[إأآ]/, 'ا').charAt(0) || '؟').toUpperCase());
const STATUS = { approved: 'مفعّل', pending: 'بانتظار الموافقة', suspended: 'موقوف', rejected: 'مرفوض' };
const chip = (s) => `<span class="chip st-${esc(s)}">${STATUS[s] || esc(s)}</span>`;
const PROVIDER = { email: 'بريد وكلمة سر', google: 'Google' };

const ICONS = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  megaphone: 'M3 11v3a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 8a5 5 0 0 1 0 8',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  refresh: 'M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3',
  key: 'M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7zm1.5 2.5h.01',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  pause: 'M10 4H6v16h4zM18 4h-4v16h4z',
  play: 'M6 4l14 8-14 8z',
  mail: 'M4 4h16v16H4zM4 6l8 7 8-7',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  phone: 'M7 2h10v20H7zM11 18h2',
  cloud: 'M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 6 18.9h11.5z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.3-4.3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  user: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
};
const icon = (name, size = 20) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name] || ''}"/></svg>`;
document.querySelectorAll('[data-i]').forEach((el) => { el.innerHTML = icon(el.dataset.i, el.closest('.nav') ? 21 : 16); });

function toast(msg, bad = false) {
  const el = document.createElement('div');
  el.className = `toast${bad ? ' bad' : ''}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), bad ? 6000 : 3200);
}

/** نافذة تأكيد/إدخال: يعيد true أو النص المدخل، أو false عند الإلغاء */
function dialog({ title, body = '', ok = 'تأكيد', danger = false, input = null }) {
  const dlg = $('#dlg');
  const f = $('#dlg-form');
  f.innerHTML = `<h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}
    ${input ? `<input class="field ${input.ltr ? 'ltr' : ''}" id="dlg-in" placeholder="${esc(input.placeholder || '')}" value="${esc(input.value || '')}" autocomplete="off">` : ''}
    <div class="row"><button class="btn ${danger ? 'btn-bad' : ''}" value="ok" id="dlg-ok">${esc(ok)}</button><button class="btn btn-ghost" value="cancel" formnovalidate>إلغاء</button></div>`;
  const inp = $('#dlg-in', f);
  const okBtn = $('#dlg-ok', f);
  if (inp && input.match) {
    okBtn.disabled = true;
    inp.addEventListener('input', () => { okBtn.disabled = inp.value.trim().toLowerCase() !== input.match.toLowerCase(); });
  }
  return new Promise((resolve) => {
    dlg.onclose = () => resolve(dlg.returnValue === 'ok' ? (inp ? inp.value.trim() : true) : false);
    dlg.returnValue = '';
    dlg.showModal();
    (inp || okBtn).focus();
  });
}

// ───────────────────────── الدخول
let auth = null;

async function initAuth() {
  if (TEST) {
    auth = { user: TEST.me, token: async () => 'test', signIn: async () => {}, signOut: async () => { location.reload(); } };
    return start(TEST.me);
  }
  const msg = $('#login-msg');
  $('#login').hidden = false;
  if (!CFG.supabaseUrl) { msg.textContent = 'إعدادات الخادم غير موجودة (config.js). أعد نشر الموقع.'; $('#google').disabled = true; return; }
  let fbCfg = CFG.firebase;
  if (!fbCfg) fbCfg = await fetch('/__/firebase/init.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!fbCfg?.apiKey) {
    msg.textContent = 'الدخول بـ Google غير مفعّل بعد: سجّل «تطبيق ويب» في مشروع Firebase وفعّل Google في Authentication.';
    $('#google').disabled = true;
    return;
  }
  // نطاق الموقع نفسه (Firebase Hosting يخدم /__/auth/) — يتجنب مشاكل ملفات الطرف الثالث في المتصفحات
  if (!/^(localhost|127\.)/.test(location.hostname)) fbCfg = { ...fbCfg, authDomain: location.hostname };
  let A;
  try {
    const { initializeApp } = await import(`${FB}/firebase-app.js`);
    A = await import(`${FB}/firebase-auth.js`);
    const fa = A.getAuth(initializeApp(fbCfg));
    fa.languageCode = 'ar';
    await A.setPersistence(fa, A.browserLocalPersistence);
    const provider = new A.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    auth = {
      user: null,
      token: async (force = false) => { if (!fa.currentUser) throw new Error('سجّل الدخول أولاً'); return fa.currentUser.getIdToken(force); },
      signIn: async () => {
        try { await A.signInWithPopup(fa, provider); } catch (e) {
          if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') return A.signInWithRedirect(fa, provider);
          throw e;
        }
      },
      signOut: async () => { await A.signOut(fa); location.hash = ''; location.reload(); },
    };
    A.getRedirectResult(fa).catch((e) => { msg.textContent = authError(e); });
    let first = true;
    A.onAuthStateChanged(fa, (u) => {
      if (u) {
        auth.user = { email: u.email, name: u.displayName, picture: u.photoURL };
        start(auth.user);
      } else if (!first) {
        $('#app').hidden = true;
        $('#login').hidden = false;
      }
      first = false;
    });
  } catch (e) {
    msg.textContent = 'تعذّر تحميل خدمة الدخول. تأكد من الإنترنت ثم أعد تحميل الصفحة.';
    console.error(e);
    return;
  }
  $('#google').onclick = async () => {
    msg.textContent = '';
    $('#google').disabled = true;
    try { await auth.signIn(); } catch (e) { msg.textContent = authError(e); } finally { $('#google').disabled = false; }
  };
}

function authError(e) {
  const c = e?.code || '';
  if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
  if (c === 'auth/unauthorized-domain') return 'هذا النطاق غير مسموح في Firebase ← Authentication ← Settings ← Authorized domains.';
  if (c === 'auth/operation-not-allowed') return 'الدخول بـ Google غير مفعّل في Firebase ← Authentication.';
  if (c === 'auth/network-request-failed') return 'تعذّر الاتصال. تأكد من الإنترنت.';
  return e?.message || 'تعذّر الدخول';
}

// ───────────────────────── الخادم
async function api(action, args = {}) {
  if (TEST) return TEST.api(action, args);
  const call = async (force) => fetch(`${CFG.supabaseUrl}/functions/v1/admin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: CFG.supabaseKey || '', 'x-admin-token': await auth.token(force) },
    body: JSON.stringify({ action, ...args }),
  });
  let r;
  try { r = await call(false); if (r.status === 401) r = await call(true); } catch { throw new Error('تعذّر الاتصال بالخادم. تأكد من الإنترنت.'); }
  const b = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(b.error || b.message || `خطأ من الخادم (${r.status})`); e.status = r.status; throw e; }
  return b;
}

// ───────────────────────── الحالة والتنقل
const S = { me: null, overview: null, teachers: null, filter: 'all', q: '', sort: 'created_at', dir: -1, view: 'overview', news: null, admins: null, config: null, lastPending: null };
const TITLES = { overview: 'نظرة عامة', requests: 'طلبات الحسابات', teachers: 'المدرّسون', news: 'الإعلانات والإشعارات', settings: 'الإعدادات' };
let started = false;
let poll = null;

async function start(user) {
  if (started) return;
  try {
    S.me = await api('me');
  } catch (e) {
    $('#app').hidden = true;
    $('#login').hidden = false;
    const msg = $('#login-msg');
    msg.innerHTML = `${esc(e.message)}<br><button class="btn btn-ghost btn-sm" id="other" type="button" style="margin-top:10px">الدخول بحساب آخر</button>`;
    $('#other').onclick = () => auth.signOut();
    return;
  }
  started = true;
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#me-name').textContent = user?.name || S.me.name || 'المدير';
  $('#me-email').textContent = S.me.email;
  const pic = user?.picture || S.me.picture;
  if (pic) $('#me-pic').src = pic; else $('#me-pic').hidden = true;
  $('#logout').onclick = () => auth.signOut();
  $('#refresh').onclick = () => refresh(true);
  window.addEventListener('hashchange', route);
  await refresh(false);
  route();
  clearInterval(poll);
  poll = setInterval(() => { if (!document.hidden) refresh(false, true); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(false, true); });
}

function route() {
  const v = (location.hash || '#overview').slice(1);
  S.view = TITLES[v] ? v : 'overview';
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.view === S.view));
  $('#title').textContent = TITLES[S.view];
  document.title = `${S.overview?.pending ? `(${S.overview.pending}) ` : ''}${TITLES[S.view]} — لوحة نَهج`;
  render();
  if (S.view === 'news' && !S.news) loadNews();
  if (S.view === 'settings' && !S.admins) loadSettings();
}

async function refresh(manual, quiet = false) {
  try {
    const [o, t] = await Promise.all([api('overview'), api('teachers')]);
    const prev = S.lastPending;
    S.overview = o;
    S.teachers = t.teachers;
    S.lastPending = o.pending;
    $('#badge').hidden = !o.pending;
    $('#badge').textContent = o.pending;
    $('#updated').textContent = `آخر تحديث ${fmtDateTime(new Date().toISOString()).split(' ')[1]}`;
    if (prev !== null && o.pending > prev) {
      const k = o.pending - prev;
      toast(`${plural(k, ['طلب حساب جديد', 'طلبان جديدان', 'طلبات جديدة', 'طلباً جديداً'])} بانتظار موافقتك`);
      if ('Notification' in window && Notification.permission === 'granted') new Notification('نَهج — طلب حساب جديد', { body: 'افتح لوحة الإدارة للموافقة', icon: '/favicon.png' });
    }
    if (manual) toast('حُدّثت البيانات');
    document.title = `${o.pending ? `(${o.pending}) ` : ''}${TITLES[S.view]} — لوحة نَهج`;
    // التحديث الصامت لا يعيد رسم صفحة فيها نموذج يُكتب (الإعلانات/الإعدادات) ولا أثناء الكتابة
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && document.activeElement.id !== 'q';
    if (!quiet || (['overview', 'requests', 'teachers'].includes(S.view) && !typing)) render();
  } catch (e) {
    if (!quiet) toast(e.message, true);
  }
}

function render() {
  const v = $('#view');
  if (!S.overview) { v.innerHTML = '<div class="kpis">' + '<div class="skeleton"></div>'.repeat(4) + '</div><div class="skeleton" style="height:260px"></div>'; return; }
  const keepFocus = document.activeElement?.id === 'q' ? { s: document.activeElement.selectionStart } : null;
  v.innerHTML = ({ overview: viewOverview, requests: viewRequests, teachers: viewTeachers, news: viewNews, settings: viewSettings })[S.view]();
  if (keepFocus) { const q = $('#q'); q.focus(); q.setSelectionRange(keepFocus.s, keepFocus.s); }
}

// ───────────────────────── نظرة عامة
function viewOverview() {
  const o = S.overview;
  const t = o.totals;
  const max = Math.max(1, ...o.signups.map((s) => s.n));
  const W = 600; const H = 150; const bw = W / o.signups.length;
  const bars = o.signups.map((s, i) => {
    const h = s.n ? Math.max(4, (s.n / max) * (H - 30)) : 2;
    return `<rect class="bar${s.n ? '' : ' zero'}" x="${(o.signups.length - 1 - i) * bw + 3}" y="${H - 18 - h}" width="${bw - 6}" height="${h}" rx="3"><title>${fmtDate(s.day)}: ${s.n}</title></rect>`
      + (s.n ? `<text x="${(o.signups.length - 1 - i) * bw + bw / 2}" y="${H - 22 - h}" text-anchor="middle">${s.n}</text>` : '');
  }).join('');
  const labels = [0, 10, 20, 29].map((i) => `<text x="${i === 0 ? W - 2 : i === 29 ? 2 : (o.signups.length - 1 - i) * bw + bw / 2}" y="${H - 2}" text-anchor="${i === 0 ? 'end' : i === 29 ? 'start' : 'middle'}">${fmtDate(o.signups[i].day).slice(0, 5)}</text>`).join('');
  return `
  ${o.pending ? `<a class="card" href="#requests" style="display:flex;gap:14px;align-items:center;text-decoration:none;color:inherit;box-shadow:0 0 0 2px var(--gold)">
      <span class="avatar" style="background:var(--warn-bg);color:var(--warn)">${icon('inbox')}</span>
      <span class="grow"><b>${plural(o.pending, ['طلب حساب جديد', 'طلبا حساب', 'طلبات', 'طلباً'])} بانتظار موافقتك</b><br><small class="muted">لن تعمل المزامنة لهم حتى توافق.</small></span>
      <span class="btn btn-sm">مراجعة</span></a>` : ''}
  <div class="kpis">
    <a class="kpi hero" href="#teachers"><small>المدرّسون المفعّلون</small><b>${n(o.approved)}</b><small>من أصل ${plural(o.teachers, ['حساب واحد', 'حسابين', 'حسابات', 'حساباً'])}</small></a>
    <a class="kpi ${o.pending ? 'alert' : ''}" href="#requests"><small>بانتظار الموافقة</small><b>${n(o.pending)}</b></a>
    <div class="kpi"><small>نشطون آخر ٧ أيام</small><b>${n(o.active7)}</b></div>
    <a class="kpi" href="#teachers" data-filter="suspended"><small>موقوفون / مرفوضون</small><b>${n(o.suspended + o.rejected)}</b></a>
  </div>
  <div class="grid2">
    <div class="card"><div class="card-h"><h2>التسجيلات آخر ٣٠ يوماً</h2><span class="muted small">${plural(o.signups.reduce((s, x) => s + x.n, 0), ['حساب واحد', 'حسابان', 'حسابات', 'حساباً']).replace(/^0 .*/, 'لا تسجيلات')}</span></div>
      <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="التسجيلات اليومية">${bars}${labels}</svg></div>
    <div class="card"><div class="card-h"><h2>آخر التسجيلات</h2><a href="#teachers" class="small">الكل</a></div>
      <div class="list">${o.recent.length ? o.recent.map((r) => `<button class="li" data-open="${esc(r.id)}"><span class="avatar">${initial(r)}</span><span class="li-main"><b>${esc(r.name || r.email)}</b><small class="ltr">${esc(r.name ? r.email : '')}</small></span><span style="display:grid;justify-items:end;gap:2px">${chip(r.status)}<small class="muted">${ago(r.created_at)}</small></span></button>`).join('') : '<p class="muted">لا حسابات بعد.</p>'}</div></div>
  </div>
  <div class="card"><div class="card-h"><h2>بيانات المدرّسين في السحابة</h2></div>
    <div class="kpis">
      ${[['الصفوف', t.classes], ['الشعب', t.sections], ['الطلاب', t.students], ['سجلات الدرجات', t.gradebooks], ['الدرجات', t.grades], ['سجلات الحضور', t.attendance], ['خطط الدروس', t.plans], ['الأجهزة', t.devices]]
        .map(([k, v]) => `<div class="kpi" style="box-shadow:none;background:var(--bg)"><small>${k}</small><b>${n(v)}</b></div>`).join('')}
      <div class="kpi" style="box-shadow:none;background:var(--bg)"><small>النسخ السحابية</small><b>${n(t.backup_files)}</b><small>${bytes(t.backup_bytes)}</small></div>
    </div>
    ${o.fcm ? '' : '<p class="muted small" style="margin:12px 0 0">الإشعارات على الهواتف غير مفعّلة (السر FCM_SERVICE_ACCOUNT).</p>'}
  </div>`;
}

// ───────────────────────── الطلبات
function viewRequests() {
  const list = S.teachers.filter((t) => t.status === 'pending').sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const rejected = S.teachers.filter((t) => t.status === 'rejected').length;
  const notif = 'Notification' in window && Notification.permission === 'default';
  return `
  ${notif ? `<div class="card row"><span class="avatar">${icon('bell')}</span><span class="grow">نبّهني في المتصفح عند وصول طلب جديد (والصفحة مفتوحة).</span><button class="btn btn-sm btn-soft" data-act="notif">تفعيل التنبيه</button></div>` : ''}
  <div class="card">
    <div class="card-h"><h2>بانتظار الموافقة (${n(list.length)})</h2>
      ${list.length > 1 ? `<button class="btn btn-sm btn-good" data-act="approve-all">${icon('check', 16)}قبول الكل</button>` : ''}</div>
    ${list.length ? `<div class="list">${list.map((t) => `
      <div class="li req">
        <span class="avatar">${initial(t)}</span>
        <button class="li-main" style="all:unset;cursor:pointer;display:grid;min-width:0" data-open="${esc(t.id)}">
          <b class="ltr" style="text-align:right">${esc(t.email)}</b>
          <small>${t.name ? `${esc(t.name)} · ` : ''}سجّل ${ago(t.created_at)} · ${PROVIDER[t.provider] || esc(t.provider)}</small>
        </button>
        <div class="req-actions">
          <button class="btn btn-sm btn-good" data-act="status" data-id="${esc(t.id)}" data-status="approved">${icon('check', 16)}قبول</button>
          <button class="btn btn-sm btn-bad-ghost" data-act="status" data-id="${esc(t.id)}" data-status="rejected">${icon('x', 16)}رفض</button>
        </div>
      </div>`).join('')}</div>`
      : `<div class="empty"><span class="em-ic">${icon('check', 28)}</span><b>لا طلبات جديدة</b><span>كل من سجّل في التطبيق تمّت مراجعته.</span></div>`}
  </div>
  <p class="muted small">المدرّس الذي ينتظر الموافقة يستعمل التطبيق على جهازه عادياً، لكن بياناته لا تُرفع إلى السحابة حتى تقبله. ${rejected ? `<a href="#teachers" data-filter="rejected">المرفوضون (${rejected})</a>` : ''}</p>`;
}

// ───────────────────────── المدرّسون
const COLS = [
  ['name', 'المدرّس'], ['status', 'الحالة'], ['school', 'المدرسة / المادة'], ['students', 'الطلاب'], ['grades', 'الدرجات'],
  ['last_sync', 'آخر مزامنة'], ['last_sign_in_at', 'آخر دخول'], ['created_at', 'التسجيل'],
];
const sortVal = (t, k) => ({
  name: (t.name || t.email).toLowerCase(), status: t.status, school: `${t.school} ${t.subject}`, students: t.stats.students, grades: t.stats.grades,
  last_sync: t.stats.last_sync ? Date.parse(t.stats.last_sync) : 0, last_sign_in_at: t.last_sign_in_at ? Date.parse(t.last_sign_in_at) : 0, created_at: Date.parse(t.created_at),
}[k]);

function filtered() {
  const q = S.q.trim().toLowerCase();
  return S.teachers
    .filter((t) => S.filter === 'all' || t.status === S.filter || (S.filter === 'suspended' && t.status === 'rejected'))
    .filter((t) => !q || [t.email, t.name, t.school, t.subject].some((x) => (x || '').toLowerCase().includes(q)))
    .sort((a, b) => { const x = sortVal(a, S.sort); const y = sortVal(b, S.sort); return (x > y ? 1 : x < y ? -1 : 0) * S.dir; });
}

function viewTeachers() {
  const c = (s) => S.teachers.filter((t) => t.status === s).length;
  const segs = [['all', 'الكل', S.teachers.length], ['approved', 'مفعّل', c('approved')], ['pending', 'بانتظار', c('pending')], ['suspended', 'موقوف/مرفوض', c('suspended') + c('rejected')]];
  const list = filtered();
  return `
  <div class="card">
    <div class="toolbar" style="margin-bottom:14px">
      <input class="field search" id="q" type="search" placeholder="ابحث بالاسم أو البريد أو المدرسة…" value="${esc(S.q)}" autocomplete="off">
      <div class="seg" role="tablist">${segs.map(([k, l, v]) => `<button data-act="filter" data-f="${k}" class="${S.filter === k ? 'on' : ''}">${l}<em>${v}</em></button>`).join('')}</div>
      <button class="btn btn-sm" data-act="create">${icon('plus', 16)}إضافة مدرّس</button>
      <button class="btn btn-sm btn-ghost" data-act="csv">${icon('download', 16)}Excel</button>
    </div>
    ${list.length ? `
    <div class="table-wrap"><table>
      <thead><tr>${COLS.map(([k, l]) => `<th><button data-act="sort" data-k="${k}">${l}${S.sort === k ? (S.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}</tr></thead>
      <tbody>${list.map((t) => `<tr data-open="${esc(t.id)}">
        <td><div class="who"><span class="avatar">${initial(t)}</span><span class="li-main"><b>${esc(t.name || '—')}</b><small>${esc(t.email)}</small></span></div></td>
        <td>${chip(t.status)}${t.banned && t.status === 'approved' ? ' <span class="chip plain">محظور</span>' : ''}</td>
        <td>${esc([t.school, t.subject].filter(Boolean).join(' · ') || '—')}</td>
        <td class="num">${n(t.stats.students)}</td>
        <td class="num">${n(t.stats.grades)}</td>
        <td>${t.stats.last_sync ? ago(t.stats.last_sync) : '—'}</td>
        <td>${t.last_sign_in_at ? ago(t.last_sign_in_at) : '—'}</td>
        <td class="num">${fmtDate(t.created_at)}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="cards list">${list.map((t) => `<button class="li" data-open="${esc(t.id)}"><span class="avatar">${initial(t)}</span>
      <span class="li-main"><b>${esc(t.name || t.email)}</b><small>${esc([t.school, t.subject].filter(Boolean).join(' · ') || t.email)}</small>
      <small>${n(t.stats.students)} طالب · آخر مزامنة ${t.stats.last_sync ? ago(t.stats.last_sync) : '—'}</small></span>${chip(t.status)}</button>`).join('')}</div>`
    : `<div class="empty"><span class="em-ic">${icon('search', 26)}</span><b>لا نتائج</b><span>${S.teachers.length ? 'غيّر البحث أو التصفية.' : 'لم يسجّل أحد بعد.'}</span></div>`}
  </div>`;
}

function csv() {
  const rows = [['البريد', 'الاسم', 'الحالة', 'المدرسة', 'المادة', 'الصفوف', 'الشعب', 'الطلاب', 'سجلات الدرجات', 'الدرجات', 'الحضور', 'آخر مزامنة', 'آخر دخول', 'التسجيل', 'ملاحظة']];
  for (const t of filtered()) rows.push([t.email, t.name, STATUS[t.status], t.school, t.subject, t.stats.classes, t.stats.sections, t.stats.students, t.stats.gradebooks, t.stats.grades, t.stats.attendance, fmtDateTime(t.stats.last_sync), fmtDateTime(t.last_sign_in_at), fmtDateTime(t.created_at), t.note || '']);
  const text = '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = `مدرسو-نهج-${fmtDate(new Date().toISOString()).replace(/\//g, '-')}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const genPassword = () => {
  const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(r, (x) => a[x % a.length]).join('');
};

async function createTeacher() {
  const dlg = $('#dlg');
  const f = $('#dlg-form');
  const pw = genPassword();
  f.innerHTML = `<h2>إضافة مدرّس</h2><p>يُنشأ الحساب مفعّلاً مباشرة. أعطِ المدرّس البريد وكلمة السر ليدخل من التطبيق.</p>
    <label class="lbl">البريد<input class="field ltr" id="c-email" type="email" required autocomplete="off"></label>
    <label class="lbl">الاسم (اختياري)<input class="field" id="c-name" autocomplete="off"></label>
    <label class="lbl">كلمة السر<span class="pw"><input class="field" id="c-pw" value="${pw}" minlength="6" required autocomplete="off"><button type="button" class="btn btn-ghost btn-sm" id="c-gen">توليد</button></span></label>
    <div class="row"><button class="btn" value="ok">إنشاء الحساب</button><button class="btn btn-ghost" value="cancel" formnovalidate>إلغاء</button></div>`;
  $('#c-gen').onclick = () => { $('#c-pw').value = genPassword(); };
  dlg.returnValue = '';
  dlg.showModal();
  $('#c-email').focus();
  const ok = await new Promise((r) => { dlg.onclose = () => r(dlg.returnValue === 'ok'); });
  if (!ok) return;
  const email = $('#c-email').value.trim(); const name = $('#c-name').value.trim(); const password = $('#c-pw').value;
  try {
    await api('create', { email, name, password });
    await refresh(false, true); render();
    await dialog({ title: 'أُنشئ الحساب', body: `البريد: ${email}\nكلمة السر: ${password}\n\nانسخها الآن وأرسلها للمدرّس.`, ok: 'نسخ وإغلاق' });
    navigator.clipboard?.writeText(`نَهج\nالبريد: ${email}\nكلمة السر: ${password}`).catch(() => {});
  } catch (e) { toast(e.message, true); }
}

// ───────────────────────── تفاصيل مدرّس
let openId = null;
async function openTeacher(id) {
  openId = id;
  const dr = $('#drawer');
  const t = S.teachers?.find((x) => x.id === id);
  dr.innerHTML = `<div class="dr-head"><span class="avatar">${t ? initial(t) : ''}</span><span class="li-main"><b>${esc(t?.name || t?.email || '')}</b><small>${esc(t?.email || '')}</small></span><button class="btn btn-ghost btn-sm" data-act="close">${icon('x', 16)}</button></div>
    <div class="dr-body"><div class="skeleton"></div><div class="skeleton"></div></div>`;
  dr.hidden = false; $('#drawer-bg').hidden = false;
  document.body.style.overflow = 'hidden';
  try {
    const d = await api('teacher', { id });
    if (openId !== id) return;
    dr.innerHTML = drawerHtml(d);
  } catch (e) {
    $('.dr-body', dr).innerHTML = `<div class="empty"><b>تعذّر التحميل</b><span>${esc(e.message)}</span></div>`;
  }
}
function closeDrawer() {
  openId = null;
  $('#drawer').hidden = true; $('#drawer-bg').hidden = true;
  document.body.style.overflow = '';
}

function drawerHtml(d) {
  const p = d.profile || {};
  const s = d.stats;
  const name = p.name || '';
  const st = d.status;
  const statusBtns = {
    pending: [['approved', 'قبول', 'btn-good', 'check'], ['rejected', 'رفض', 'btn-bad-ghost', 'x']],
    approved: [['suspended', 'إيقاف الحساب', 'btn-bad-ghost', 'pause']],
    suspended: [['approved', 'إعادة التفعيل', 'btn-good', 'play']],
    rejected: [['approved', 'قبول', 'btn-good', 'check']],
  }[st] || [];
  return `
  <div class="dr-head"><span class="avatar">${initial({ name, email: d.email })}</span>
    <span class="li-main"><b dir="auto">${esc(name || d.email)}</b><small>${esc(d.email)}</small></span>${chip(st)}
    <button class="btn btn-ghost btn-sm" data-act="close" aria-label="إغلاق">${icon('x', 16)}</button></div>
  <div class="dr-body">
    <div class="row">${statusBtns.map(([to, l, cls, ic]) => `<button class="btn btn-sm ${cls}" data-act="status" data-id="${esc(d.id)}" data-status="${to}">${icon(ic, 16)}${l}</button>`).join('')}
      ${d.banned && st === 'approved' ? '<span class="chip plain">محظور من الدخول</span>' : ''}</div>
    <div class="stats">
      ${[['الصفوف', s.classes], ['الشعب', s.sections], ['الطلاب', s.students], ['السجلات', s.gradebooks], ['الدرجات', s.grades], ['الحضور', s.attendance], ['الخطط', s.plans], ['المهام', s.tasks]]
        .map(([k, v]) => `<div class="stat"><b>${n(v)}</b><small>${k}</small></div>`).join('')}
    </div>
    <div class="card"><h3 style="margin-bottom:10px">المعلومات</h3><dl class="kv">
      <dt>الاسم</dt><dd>${esc(name || '—')}</dd>
      <dt>المدرسة</dt><dd>${esc(p.school || '—')}</dd>
      <dt>المادة</dt><dd>${esc(p.subject || '—')}</dd>
      ${p.phone ? `<dt>الهاتف</dt><dd class="ltr">${esc(p.phone)}</dd>` : ''}
      <dt>طريقة الدخول</dt><dd>${PROVIDER[d.provider] || esc(d.provider)}</dd>
      <dt>التسجيل</dt><dd>${fmtDateTime(d.created_at)}</dd>
      <dt>آخر دخول</dt><dd>${d.last_sign_in_at ? `${fmtDateTime(d.last_sign_in_at)} (${ago(d.last_sign_in_at)})` : '—'}</dd>
      <dt>آخر مزامنة</dt><dd>${s.last_sync ? `${fmtDateTime(s.last_sync)} (${ago(s.last_sync)})` : '—'}</dd>
      ${d.decided_at ? `<dt>آخر قرار</dt><dd>${fmtDateTime(d.decided_at)}</dd>` : ''}
      <dt>الأجهزة</dt><dd>${d.devices.length ? d.devices.map((x) => `${esc(x.platform)}${x.app_version ? ` (${esc(x.app_version)})` : ''}`).join('، ') : '—'}</dd>
    </dl></div>
    <div class="card"><h3 style="margin-bottom:10px">الصفوف والشعب</h3>
      ${d.classes.length ? `<div style="display:grid;gap:8px">${d.classes.map((c) => `<div class="cls"><b>${esc(c.name)}${c.subject ? ` <small class="muted">· ${esc(c.subject)}</small>` : ''}</b>
        <div class="cls-secs">${c.sections.map((x) => `<span class="chip plain">${esc(x.name)} · ${n(x.students)} طالب${x.gradebooks ? ` · ${n(x.gradebooks)} سجل` : ''}</span>`).join('') || '<small class="muted">بلا شعب</small>'}</div></div>`).join('')}</div>`
        : '<p class="muted" style="margin:0">لا صفوف في السحابة بعد.</p>'}
    </div>
    <div class="card"><h3 style="margin-bottom:10px">النسخ السحابية (${n(d.backups.length)})</h3>
      ${d.backups.length ? `<div class="list">${d.backups.slice(0, 6).map((b) => `<div class="li"><span class="li-main"><b class="num">${fmtDateTime(b.created_at)}</b><small>${b.name.includes('.auto') ? 'تلقائية' : 'يدوية'} · ${bytes(b.size)}</small></span></div>`).join('')}</div>` : '<p class="muted" style="margin:0">لا نسخ بعد.</p>'}
    </div>
    <div class="card actions"><h3>ملاحظة خاصة بك</h3>
      <textarea id="d-note" placeholder="مثلاً: مدرّس في مدرسة …">${esc(d.note || '')}</textarea>
      <div><button class="btn btn-sm btn-soft" data-act="note" data-id="${esc(d.id)}">حفظ الملاحظة</button></div></div>
    <div class="card actions"><h3>${icon('key', 18)} تغيير كلمة السر</h3>
      <div class="pw"><input class="field" id="d-pw" placeholder="كلمة السر الجديدة" autocomplete="new-password"><button class="btn btn-ghost btn-sm" data-act="gen">توليد</button></div>
      <label class="check"><input type="checkbox" id="d-pw-out" checked> إخراجه من كل أجهزته</label>
      <div><button class="btn btn-sm" data-act="password" data-id="${esc(d.id)}">تغيير كلمة السر</button></div></div>
    <div class="card actions"><h3>${icon('mail', 18)} تغيير البريد</h3>
      <input class="field ltr" id="d-email" value="${esc(d.email)}" type="email" autocomplete="off">
      <div><button class="btn btn-sm btn-soft" data-act="email" data-id="${esc(d.id)}">حفظ البريد</button></div></div>
    <div class="card actions"><h3>${icon('bell', 18)} إشعار لهذا المدرّس</h3>
      <input class="field" id="d-nt" placeholder="العنوان" maxlength="120">
      <textarea id="d-nb" placeholder="نص الإشعار" maxlength="1000"></textarea>
      <div><button class="btn btn-sm btn-soft" data-act="notify-one" data-id="${esc(d.id)}" ${d.devices.length ? '' : 'disabled title="لا أجهزة مسجّلة"'}>إرسال</button>
      ${d.devices.length ? '' : '<small class="muted">لا يوجد هاتف مسجّل لهذا الحساب.</small>'}</div></div>
    <div class="card actions danger-zone"><h3 style="color:var(--bad)">منطقة الخطر</h3>
      <div class="row">
        <button class="btn btn-sm btn-ghost" data-act="revoke" data-id="${esc(d.id)}">${icon('logout', 16)}إخراجه من كل الأجهزة</button>
        <button class="btn btn-sm btn-bad" data-act="delete" data-id="${esc(d.id)}" data-email="${esc(d.email)}">${icon('trash', 16)}حذف الحساب وكل بياناته</button>
      </div></div>
  </div>`;
}

// ───────────────────────── الإعلانات
async function loadNews() {
  try { S.news = (await api('announcements')).announcements; } catch (e) { S.news = []; toast(e.message, true); }
  if (S.view === 'news') render();
}
function viewNews() {
  const fcm = S.overview.fcm;
  const list = S.news;
  return `
  <div class="card actions">
    <h2>رسالة جديدة لكل المدرّسين</h2>
    <label class="lbl">العنوان<input class="field" id="a-title" maxlength="120" placeholder="مثلاً: تحديث جديد متاح"></label>
    <label class="lbl">النص<textarea id="a-body" maxlength="2000" placeholder="اكتب الرسالة…"></textarea></label>
    <div class="row">
      <label class="lbl grow">رابط (اختياري)<input class="field ltr" id="a-url" placeholder="https://"></label>
      <label class="lbl">يختفي بعد<select id="a-days"><option value="0">لا يختفي</option><option value="1">يوم</option><option value="3">٣ أيام</option><option value="7" selected>أسبوع</option><option value="30">شهر</option></select></label>
    </div>
    <label class="check"><input type="checkbox" id="a-in" checked> يظهر داخل التطبيق كإعلان</label>
    <label class="check"><input type="checkbox" id="a-push" ${fcm ? 'checked' : 'disabled'}> إشعار على هواتف المدرّسين المفعّلين ${fcm ? '' : '<small class="muted">(FCM غير مضبوط)</small>'}</label>
    <div><button class="btn" data-act="announce">${icon('megaphone', 18)}إرسال</button></div>
  </div>
  <div class="card"><div class="card-h"><h2>الإعلانات</h2></div>
    ${list === null ? '<div class="skeleton"></div>' : list.length ? `<div class="list">${list.map((a) => {
      const expired = a.expires_at && Date.parse(a.expires_at) < Date.now();
      return `<div class="li" style="align-items:flex-start"><span class="li-main" style="white-space:normal">
        <b>${esc(a.title)} ${expired ? '<span class="chip plain">انتهى</span>' : '<span class="chip st-approved">ظاهر</span>'}</b>
        <span class="muted" style="white-space:pre-line">${esc(a.body)}</span>
        <small>${fmtDateTime(a.created_at)}${a.expires_at ? ` · ينتهي ${fmtDate(a.expires_at)}` : ''}${a.url ? ` · <a href="${esc(a.url)}" target="_blank" rel="noopener" class="ltr">${esc(a.url)}</a>` : ''}</small></span>
        <button class="btn btn-sm btn-bad-ghost" data-act="del-news" data-id="${esc(a.id)}" aria-label="حذف">${icon('trash', 16)}</button></div>`;
    }).join('')}</div>` : '<div class="empty"><span class="em-ic">' + icon('megaphone', 26) + '</span><b>لا إعلانات</b></div>'}
  </div>`;
}

// ───────────────────────── الإعدادات
async function loadSettings() {
  try {
    const [a, c] = await Promise.all([api('admins'), api('config')]);
    S.admins = a.admins; S.config = c;
  } catch (e) { toast(e.message, true); S.admins = []; S.config = { require_approval: true }; }
  if (S.view === 'settings') render();
}
function viewSettings() {
  if (!S.admins) return '<div class="skeleton"></div><div class="skeleton"></div>';
  const ra = S.config.require_approval;
  return `
  <div class="card actions">
    <h2>التسجيل في التطبيق</h2>
    <label class="check" style="font-weight:700"><input type="checkbox" id="s-ra" ${ra ? 'checked' : ''} data-act="require"> كل حساب جديد يحتاج موافقتي</label>
    <p class="muted small" style="margin:0">${ra ? 'الحسابات الجديدة تظهر في «الطلبات» ولا تُزامن بياناتها حتى تقبلها.' : 'الحسابات الجديدة تُفعّل تلقائياً بلا مراجعة.'}</p>
  </div>
  <div class="card actions">
    <div class="card-h" style="margin:0"><h2>${icon('shield', 18)} المدراء</h2></div>
    <div class="list">${S.admins.map((a) => `<div class="li"><span class="avatar">${icon('user', 18)}</span><span class="li-main"><b class="ltr" style="text-align:right">${esc(a.email)}</b><small>${a.primary ? 'المدير الرئيسي (من إعدادات النشر)' : `أُضيف ${fmtDate(a.added_at)}`}${a.email === S.me.email ? ' · أنت' : ''}</small></span>
      ${a.primary || a.email === S.me.email ? '' : `<button class="btn btn-sm btn-bad-ghost" data-act="rm-admin" data-email="${esc(a.email)}">إزالة</button>`}</div>`).join('')}</div>
    <div class="row"><input class="field grow ltr" id="s-admin" type="email" placeholder="name@gmail.com" autocomplete="off"><button class="btn btn-sm" data-act="add-admin">${icon('plus', 16)}إضافة مدير</button></div>
    <p class="muted small" style="margin:0">المدير يدخل هذه اللوحة بحساب Google بنفس البريد، ويستطيع فعل كل شيء.</p>
  </div>
  <div class="card"><h2 style="margin-bottom:8px">روابط</h2>
    <div class="row">
      <a class="btn btn-sm btn-ghost" href="${esc((CFG.supabaseUrl || '').replace(/^https:\/\/([^.]+)\.supabase\.co.*/, 'https://supabase.com/dashboard/project/$1'))}" target="_blank" rel="noopener">لوحة Supabase</a>
      <a class="btn btn-sm btn-ghost" href="https://console.firebase.google.com/" target="_blank" rel="noopener">Firebase</a>
      <a class="btn btn-sm btn-ghost" href="/" target="_blank" rel="noopener">موقع نَهج</a>
    </div></div>`;
}

// ───────────────────────── الأحداث
async function act(btn, fn, okMsg) {
  btn.disabled = true;
  const html = btn.innerHTML;
  btn.innerHTML = '<span class="spin"></span>';
  try { await fn(); if (okMsg) toast(okMsg); } catch (e) { toast(e.message, true); } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = html; } }
}
const reloadAll = async () => { await refresh(false, true); render(); if (openId) openTeacher(openId); };

document.addEventListener('click', async (ev) => {
  const open = ev.target.closest('[data-open]');
  const b = ev.target.closest('[data-act]');
  const filt = ev.target.closest('[data-filter]');
  if (filt) { S.filter = filt.dataset.filter; }
  if (ev.target.id === 'drawer-bg') return closeDrawer();
  if (!b && open) return openTeacher(open.dataset.open);
  if (!b) return;
  const a = b.dataset.act;
  const id = b.dataset.id;
  const t = S.teachers?.find((x) => x.id === id);
  const who = t?.email || '';
  switch (a) {
    case 'close': return closeDrawer();
    case 'filter': S.filter = b.dataset.f; return render();
    case 'sort': if (S.sort === b.dataset.k) S.dir *= -1; else { S.sort = b.dataset.k; S.dir = ['name', 'status', 'school'].includes(b.dataset.k) ? 1 : -1; } return render();
    case 'csv': return csv();
    case 'create': return createTeacher();
    case 'gen': $('#d-pw').value = genPassword(); return;
    case 'notif': await Notification.requestPermission(); return render();
    case 'status': {
      const to = b.dataset.status;
      const q = { approved: null, rejected: ['رفض الطلب؟', `${who}\nلن يستطيع الدخول بهذا الحساب.`, 'رفض'], suspended: ['إيقاف الحساب؟', `${who}\nيخرج من كل أجهزته ولا يستطيع الدخول حتى تعيد تفعيله. بياناته تبقى محفوظة.`, 'إيقاف'] }[to];
      if (q && !(await dialog({ title: q[0], body: q[1], ok: q[2], danger: true }))) return;
      return act(b, async () => { await api('set_status', { id, status: to }); await reloadAll(); }, { approved: 'فُعّل الحساب', rejected: 'رُفض الطلب', suspended: 'أُوقف الحساب', pending: 'أُعيد للمراجعة' }[to]);
    }
    case 'approve-all':
      if (!(await dialog({ title: 'قبول كل الطلبات؟', body: `${plural(S.overview.pending, ['حساب واحد', 'حسابان', 'حسابات', 'حساباً'])} ستُفعّل وتبدأ مزامنتها.`, ok: 'قبول الكل' }))) return;
      return act(b, async () => { const r = await api('approve_all'); await reloadAll(); toast(`فُعّلت ${plural(r.count, ['حساب واحد', 'حسابان', 'حسابات', 'حساباً'])}`); });
    case 'note': return act(b, () => api('note', { id, note: $('#d-note').value }), 'حُفظت الملاحظة');
    case 'password': {
      const pw = $('#d-pw').value;
      if (pw.length < 6) return toast('كلمة السر ٦ أحرف على الأقل', true);
      if (!(await dialog({ title: 'تغيير كلمة السر؟', body: `${who}\nكلمة السر الجديدة: ${pw}\nأرسلها للمدرّس بعد التغيير.`, ok: 'تغيير' }))) return;
      return act(b, async () => {
        await api('set_password', { id, password: pw, signout: $('#d-pw-out').checked });
        navigator.clipboard?.writeText(pw).catch(() => {});
        $('#d-pw').value = '';
      }, 'تغيّرت كلمة السر (ونُسخت)');
    }
    case 'email': {
      const email = $('#d-email').value.trim();
      if (!(await dialog({ title: 'تغيير البريد؟', body: `من ${who}\nإلى ${email}\nيدخل المدرّس بعدها بالبريد الجديد.`, ok: 'تغيير' }))) return;
      return act(b, async () => { await api('set_email', { id, email }); await reloadAll(); }, 'تغيّر البريد');
    }
    case 'notify-one': {
      const title = $('#d-nt').value.trim(); const body = $('#d-nb').value.trim();
      if (!title || !body) return toast('اكتب العنوان والنص', true);
      return act(b, async () => { const r = await api('notify', { id, title, body }); toast(r.sent ? `أُرسل إلى ${r.sent} جهاز` : 'لم يصل لأي جهاز'); $('#d-nt').value = ''; $('#d-nb').value = ''; });
    }
    case 'revoke':
      if (!(await dialog({ title: 'إخراجه من كل الأجهزة؟', body: `${who}\nيحتاج لتسجيل الدخول من جديد على كل أجهزته.`, ok: 'إخراج' }))) return;
      return act(b, () => api('revoke', { id }), 'أُنهيت جلساته');
    case 'delete': {
      const email = b.dataset.email;
      const typed = await dialog({ title: 'حذف الحساب نهائياً؟', body: `يُحذف الحساب وكل صفوفه وطلابه ودرجاته ونسخه السحابية، ولا يمكن التراجع.\nاكتب البريد للتأكيد:\n${email}`, ok: 'حذف نهائياً', danger: true, input: { placeholder: email, match: email, ltr: true } });
      if (!typed) return;
      return act(b, async () => { await api('delete', { id }); closeDrawer(); await reloadAll(); }, 'حُذف الحساب');
    }
    case 'announce': {
      const title = $('#a-title').value.trim(); const body = $('#a-body').value.trim();
      if (!title || !body) return toast('اكتب العنوان والنص', true);
      const inApp = $('#a-in').checked; const push = $('#a-push').checked;
      if (!inApp && !push) return toast('اختر طريقة الإرسال', true);
      if (!(await dialog({ title: 'إرسال لكل المدرّسين؟', body: `${title}\n\n${body}`, ok: 'إرسال' }))) return;
      return act(b, async () => {
        const r = inApp ? await api('announce', { title, body, url: $('#a-url').value.trim(), days: Number($('#a-days').value), push })
          : await api('notify', { title, body });
        toast(push ? `أُرسل (${r.sent ?? 0} جهاز)` : 'نُشر الإعلان');
        S.news = null; loadNews();
      });
    }
    case 'del-news':
      if (!(await dialog({ title: 'حذف الإعلان؟', ok: 'حذف', danger: true }))) return;
      return act(b, async () => { await api('delete_announcement', { id }); S.news = S.news.filter((x) => x.id !== id); render(); }, 'حُذف');
    case 'require': {
      const v = b.checked;
      try { S.config = await api('config', { require_approval: v }); toast(v ? 'الحسابات الجديدة تحتاج موافقتك' : 'الحسابات الجديدة تُفعّل تلقائياً'); } catch (e) { b.checked = !v; toast(e.message, true); }
      return render();
    }
    case 'add-admin': {
      const email = $('#s-admin').value.trim();
      if (!email) return;
      if (!(await dialog({ title: 'إضافة مدير؟', body: `${email}\nسيستطيع فعل كل شيء في هذه اللوحة.`, ok: 'إضافة' }))) return;
      return act(b, async () => { S.admins = (await api('add_admin', { email })).admins; render(); }, 'أُضيف المدير');
    }
    case 'rm-admin': {
      const email = b.dataset.email;
      if (!(await dialog({ title: 'إزالة المدير؟', body: email, ok: 'إزالة', danger: true }))) return;
      return act(b, async () => { S.admins = (await api('remove_admin', { email })).admins; render(); }, 'أُزيل');
    }
  }
});
document.addEventListener('input', (ev) => { if (ev.target.id === 'q') { S.q = ev.target.value; render(); } });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('#drawer').hidden && !$('#dlg').open) closeDrawer(); });

initAuth();
