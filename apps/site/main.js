// زر التنزيل: يقرأ رابط آخر نسخة من download.json (يكتبه بناء APK في GitHub)
(function () {
  var AR = '٠١٢٣٤٥٦٧٨٩';
  var ar = function (s) { return String(s).replace(/[0-9]/g, function (d) { return AR[d]; }).replace(/\./g, '٫'); };
  fetch('download.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var links = document.querySelectorAll('[data-download]');
      if (!d || !d.url) {
        links.forEach(function (a) {
          if (a.getAttribute('href') === '#') { a.setAttribute('aria-disabled', 'true'); a.title = 'النسخة الأولى قريباً'; }
        });
        document.querySelectorAll('[data-download-meta]').forEach(function (m) { m.textContent = 'النسخة الأولى قريباً جداً'; });
        return;
      }
      links.forEach(function (a) { a.href = d.url; a.removeAttribute('aria-disabled'); a.setAttribute('download', 'rasd.apk'); });
      var meta = 'ملف APK · أندرويد ٧ فما فوق';
      if (d.version) meta += ' · النسخة ' + ar(d.version);
      if (d.size_mb) meta += ' · ' + ar(d.size_mb) + ' ميغابايت';
      document.querySelectorAll('[data-download-meta]').forEach(function (m) { m.textContent = meta; });
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
