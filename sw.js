/* روح المسلم - Service Worker
   غيّر VERSION مع كل تعديل (شغّل: python3 bump_version.py) فيتحدّث التطبيق المثبّت تلقائيًا. */
const VERSION = 'v-57c12e81';
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
  await caches.delete('ruh-qimg-v1'); await caches.delete('ruh-qimg-v2');   // النسخ الكبيرة القديمة: التطبيق صار يحفظ نسخًا مصغّرة بنفسه فتتحرّر المساحة                   // صور المصدر القديم
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
async function qimg(r, f) {                             // الصور الأصلية كبيرة (~١ ميغابايت): تمرّ مباشرة للشبكة ولا تُخزَّن هنا، فالتطبيق يحفظ نسخة مصغّرة بنفسه
  return fetch(r);
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
/* ---------- إشعارات الخلفية ----------
   الصفحة تُرسل جدولًا بأحداث الأيام القادمة {id, at, title, body, kind} فنخزّنه في IndexedDB،
   ثم نعرض المستحق منها كلما أيقظنا النظام (periodicsync / sync) أو وصلنا push أو فُتح التطبيق. */
const DB = 'ruh-sched', ST = 'kv';
const idb = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const kvGet = async k => { try { const d = await idb(); return await new Promise(res => { const q = d.transaction(ST).objectStore(ST).get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); } catch (_) { return undefined; } };
const kvSet = async (k, v) => { try { const d = await idb(); await new Promise(res => { const t = d.transaction(ST, 'readwrite'); t.objectStore(ST).put(v, k); t.oncomplete = () => res(); t.onerror = () => res(); }); } catch (_) {} };
const FALLBACK = [['اذكر الله', 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ'], ['صلِّ على النبي ﷺ', 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ'], ['اذكر الله', 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ']];
const nopts = (e, renotify) => ({ body: String(e.body || '').trim(), icon: 'icon-192.png', badge: 'icon-192.png', tag: e.id || 'ruh', renotify: renotify !== false, dir: 'rtl', lang: 'ar', vibrate: e.kind === 'adhan' ? [300, 150, 300] : [120], requireInteraction: e.kind === 'adhan', data: { url: './' } });
async function show(e) { if (!e || !String(e.title || '').trim()) return false; await self.registration.showNotification(e.title, nopts(e)); return true; }

async function checkDue() {                     // يعرض ما حان موعده (خلال ٤٥ دقيقة) ولم يُعرض بعد، ولا يُظهر أبدًا إشعارًا فارغًا
  const ev = (await kvGet('events')) || [], shown = (await kvGet('shown')) || {}, now = Date.now();
  const due = ev.filter(e => e.at <= now && now - e.at <= 45 * 60000 && !shown[e.id + '@' + e.at]);
  let n = 0, lastRemind = null;
  for (const e of due) {
    shown[e.id + '@' + e.at] = now;
    if (e.id === 'ruh-remind') { lastRemind = e; continue; }   // التذكيرات العامة: نعرض الأحدث فقط
    if (await show(e)) n++;
  }
  if (lastRemind && await show(lastRemind)) n++;
  for (const k of Object.keys(shown)) if (now - shown[k] > 3 * 86400000) delete shown[k];
  if (due.length) await kvSet('shown', shown);
  return n;
}
async function armTriggers(ev) {               // إن دعم المتصفح الإشعارات المجدولة (Notification Triggers) فهي الأدق
  try {
    if (!('showTrigger' in Notification.prototype) || typeof TimestampTrigger === 'undefined') return;
    (await self.registration.getNotifications({ includeTriggered: false })).forEach(n => n.close());
    for (const e of ev.filter(x => x.at > Date.now() + 5000).slice(0, 60)) await self.registration.showNotification(e.title, Object.assign(nopts(e, false), { showTrigger: new TimestampTrigger(e.at) }));
  } catch (_) {}
}
self.addEventListener('message', e => {
  const d = e.data;
  if (d && d.type === 'sched' && Array.isArray(d.events)) e.waitUntil((async () => { await kvSet('events', d.events.filter(x => x && x.title && x.at)); await armTriggers(d.events); await checkDue(); })());
  if (d && d.type === 'check') e.waitUntil(checkDue());
});
self.addEventListener('periodicsync', e => { if (e.tag === 'ruh-sched') e.waitUntil(checkDue()); });
self.addEventListener('sync', e => { if (e.tag === 'ruh-sched') e.waitUntil(checkDue()); });
self.addEventListener('push', e => {            // جاهز لإشعارات الخادم لاحقًا. وإن وصل بلا محتوى نعرض ما حان، أو ذكرًا بدل إشعار فارغ
  e.waitUntil((async () => {
    let d = {};
    try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
    if (d.title || d.body) { await show({ id: d.tag || 'ruh', title: d.title || 'روح المسلم', body: d.body || '', kind: d.kind }); return; }
    if (!(await checkDue())) { const f = FALLBACK[Math.floor(Math.random() * FALLBACK.length)]; await show({ id: 'ruh-remind', title: f[0], body: f[1] }); }
  })());
});
