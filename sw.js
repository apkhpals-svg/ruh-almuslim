/* روح المسلم - Service Worker
   غيّر VERSION مع كل تعديل (شغّل: python3 bump_version.py) فيتحدّث التطبيق المثبّت تلقائيًا. */
const VERSION = 'v-3f6b91d2';
const SHELL = 'ruh-shell-' + VERSION;   // يتغيّر مع كل إصدار ويُحذف القديم
const GF = 'ruh-gfonts-v1';             // خطوط Google (ثابت)
const QC = 'ruh-quran-v1';              // صفحات وخطوط المصحف (ثابت، حجمه كبير فلا يُعاد تحميله مع كل تحديث)
const FILES = ['./', './index.html', './manifest.json', '././icon-192.png', '././icon-512.png', '././icon-maskable-512.png', '././apple-touch-icon.png', '././favicon-32.png'];
const GCSS = 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Amiri+Quran&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;500;600;700;800&display=swap';
const QRE = /^https:\/\/(?:cdn\.jsdelivr\.net\/gh\/MohamadHajjRabee\/quran-qcf4@main|raw\.githubusercontent\.com\/MohamadHajjRabee\/quran-qcf4\/main)(\/.+)$/;
const QJ = /^https:\/\/(?:raw\.githubusercontent\.com\/apkhpals-svg\/ruh-almuslim\/main|cdn\.jsdelivr\.net\/gh\/apkhpals-svg\/ruh-almuslim@main)\/.+$/;
const jKey = u => { try { const m = /_(\d+)\.jpg$/.exec(decodeURIComponent(new URL(u).pathname)); return m ? m[1] + '.jpg' : null; } catch (_) { return null; } };  // مفتاح موحّد لكل صور المصحف مهما كان المصدر أو ترميز الاسم
const QI = /^https:\/\/(?:raw\.githubusercontent\.com\/GovarJabbar\/Quran-PNG\/main|cdn\.jsdelivr\.net\/gh\/GovarJabbar\/Quran-PNG@main|raw\.githubusercontent\.com\/Miftah-Fentaw\/Quran-Images\/main\/png|cdn\.jsdelivr\.net\/gh\/Miftah-Fentaw\/Quran-Images@main\/png)\/(\d+\.png)$/;
const IC = 'ruh-qimg-v2';              // صور صفحات المصحف (ثابت: تُحفظ كل صفحة تُفتح لتعمل دون إنترنت لاحقًا)
const qKey = p => new Request(self.location.origin + '/__q' + p);

self.addEventListener('install', e => {
  self.skipWaiting();                                   // تفعيل فوري بدون انتظار إغلاق النسخة القديمة
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })));
    try {                                               // تخزين خطوط Google مسبقًا (لا يُفشل التثبيت عند الخطأ)
      const g = await caches.open(GF), r = await fetch(GCSS, { mode: 'cors' });
      if (r.ok) {
        await g.put(GCSS, r.clone());
        const urls = [...new Set((await r.text()).match(/https:\/\/fonts\.gstatic\.com[^)'"\s]+/g) || [])];
        await Promise.all(urls.map(u => fetch(u, { mode: 'cors' }).then(x => x.ok && g.put(u, x)).catch(() => {})));
      }
    } catch (_) {}
  })());
});

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('ruh-shell-') && k !== SHELL) await caches.delete(k);
  await caches.delete('ruh-qimg-v1');                   // صور المصدر القديم
  await self.clients.claim();                           // السيطرة على الصفحات المفتوحة فورًا
})()));

self.addEventListener('message', e => {
  if (e.data === 'GET_VERSION' && e.ports[0]) e.ports[0].postMessage(VERSION);
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url), m = QRE.exec(r.url);
  if (m) return e.respondWith(quran(r, m[1]));
  if (QJ.test(r.url) || (u.origin === self.location.origin && /\.jpg$/i.test(u.pathname))) { const jk = jKey(r.url); if (jk) return e.respondWith(qimg(r, jk)); }
  const mi = QI.exec(r.url);
  if (mi) return e.respondWith(qimg(r, mi[1]));
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') return e.respondWith(swr(r, GF));
  if (u.origin === self.location.origin) e.respondWith(r.mode === 'navigate' ? nav(r) : swr(r, SHELL));
});

async function quran(r, p) {                            // الكاش أولًا؛ المفتاح موحّد بين CDN والمصدر الاحتياطي
  const c = await caches.open(QC), k = qKey(p), h = await c.match(k);
  if (h) return h;
  const res = await fetch(r);
  if (res.ok) c.put(k, res.clone());
  return res;
}
async function qimg(r, f) {                             // صورة الصفحة: الكاش أولًا، ثم الشبكة وتُحفظ (CORS فقط حتى لا يتضخم الكاش)
  const c = await caches.open(IC), k = new Request(self.location.origin + '/__qi/' + f), h = await c.match(k);
  if (h) return h;
  const res = await fetch(r);
  if (res.ok && res.type !== 'opaque') c.put(k, res.clone());
  return res;
}
async function swr(r, name) {                           // من الكاش فورًا ثم تحديثه من الشبكة
  const c = await caches.open(name), h = await c.match(r, { ignoreSearch: name === SHELL });
  const n = fetch(r).then(x => { if (x.ok) c.put(r, x.clone()); return x; }).catch(() => null);
  return h || (await n) || Response.error();
}
async function nav(r) {                                 // الصفحة: الشبكة أولًا (تحديث فوري) والكاش عند انقطاع الإنترنت
  const c = await caches.open(SHELL);
  try {
    const x = await Promise.race([fetch(r), new Promise((_, j) => setTimeout(j, 4000))]);
    if (x.ok) c.put('./index.html', x.clone());
    return x;
  } catch (_) { return (await c.match('./index.html')) || Response.error(); }
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) if ('focus' in c) return c.focus();
    return clients.openWindow('./');
  })());
});
self.addEventListener('push', e => {                    // جاهز لإشعارات الخادم لاحقًا (تصل والتطبيق مغلق)
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'روح المسلم', { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', dir: 'rtl', lang: 'ar', tag: d.tag || 'ruh', data: { url: './' } }));
});
