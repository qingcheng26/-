/* 极简 service worker。
 *
 * 只做一件事：**让「添加到主屏幕」装出来的是个真 App**（独立窗口、有自己的图标）。
 * 不缓存 API 响应 —— 那会把余额和草稿都存下来，而且看不到新的。
 *
 * 策略：网络优先，失败才回退缓存。这样加了新功能刷新一下就能看到，
 * 断网时至少还能打开界面（虽然生成不了草稿）。
 */

const CACHE = "reply-v2";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // 只碰自己这几个文件；API 请求一律直连，不缓存
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    // ⚠ cache:"no-store" 是必须的。
    //   GitHub Pages 给 html 发的头是 Cache-Control: max-age=600，
    //   不绕过的话「关掉标签页重新打开」也还是十分钟内的旧版本 ——
    //   用户会以为我改的东西没生效。
    fetch(req, { cache: "no-store" })
      .then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(req).then((hit) => hit || Response.error()))
  );
});
