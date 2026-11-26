// أزرار التنزيل: تقرأ روابط آخر نسخة (أندرويد وويندوز) من download.json — يكتبه البناء في GitHub
(function () {
  var AR = '٠١٢٣٤٥٦٧٨٩';
  var ar = function (s) { return String(s).replace(/[0-9]/g, function (d) { return AR[d]; }).replace(/\./g, '٫'); };
  var set = function (sel, fn) { document.querySelectorAll(sel).forEach(fn); };
  var soon = function (kind) {
    set('[data-dl="' + kind + '"]', function (a) { a.setAttribute('aria-disabled', 'true'); a.title = 'قريباً'; });
  };
  fetch('download.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      d = d || {};
      // أندرويد
      if (d.url) {
        set('[data-dl="android"]', function (a) { a.href = d.url; a.setAttribute('download', 'nahj.apk'); });
        var m = 'أندرويد ٧+';
        if (d.version) m += ' · النسخة ' + ar(d.version);
        if (d.size_mb) m += ' · ' + ar(d.size_mb) + ' م.ب';
        set('[data-meta="android"]', function (el) { el.textContent = m; });
      } else soon('android');
      // ويندوز
      var w = d.desktop || {};
      if (w.url) {
        set('[data-dl="windows"]', function (a) { a.href = w.url; });
        var wm = 'ويندوز ١٠ و١١';
        if (w.version) wm += ' · النسخة ' + ar(String(w.version).split('.').pop());
        if (w.size_mb) wm += ' · ' + ar(w.size_mb) + ' م.ب';
        set('[data-meta="windows"]', function (el) { el.textContent = wm; });
      } else soon('windows');
      if (w.portable) set('[data-dl="portable"]', function (a) { a.href = w.portable; });
      else set('[data-dl="portable"]', function (a) { a.hidden = true; });
    })
    .catch(function () {});

  // ظهور الأقسام عند التمرير
  var els = document.querySelectorAll('section:not(.hero), .grid article');
  if (!('IntersectionObserver' in window)) return;
  els.forEach(function (el) { el.classList.add('reveal'); });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach(function (el) { io.observe(el); });
})();
