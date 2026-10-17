/*
 * sw.js — ให้หน้าน้องส้มติดตั้งเป็นแอปได้ (และเปิดได้แม้เน็ตหลุด)
 *
 * กติกาสำคัญ:
 *  - status.json / garden.json = "network first เสมอ" (ห้ามแคช) ไม่งั้นสถานะจะค้าง
 *  - index.html = network first → ถ้าออฟไลน์ค่อยใช้สำเนาใน cache
 *  - รูป/ไอคอน = stale-while-revalidate (เปิดไว แล้วค่อยอัปเดตเบื้องหลัง)
 */
'use strict';

const CACHE = 'som-garden-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'sprites/idle.png', 'sprites/thinking.png', 'sprites/coding.png',
  'sprites/success.png', 'sprites/error.png', 'sprites/done.png',
  'sprites/idle.svg', 'sprites/thinking.svg', 'sprites/coding.svg',
  'sprites/success.svg', 'sprites/error.svg', 'sprites/done.svg'
];
const LIVE_DATA = /(status|garden)\.json(\?|$)/;   // ไฟล์สด ห้ามแคช
const STATIC_EXT = /\.(png|svg|webmanifest|woff2?|ico)(\?|$)/i;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // แคชทีละไฟล์: ถ้าใครลบไฟล์ใดออก (เช่นเก็บไว้แค่ .png ไม่มี .svg)
      // ก็ยังติดตั้งได้ ไม่ล้มทั้งชุด
      .then((c) => Promise.all(SHELL.map((url) => c.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // ข้ามไฟล์จากโดเมนอื่น
  if (LIVE_DATA.test(url.pathname + url.search)) return; // ให้เบราว์เซอร์ยิงเน็ตตรง ๆ

  // เอกสาร/หน้าเว็บ: เอาของใหม่ก่อน ถ้าออฟไลน์ค่อยใช้สำเนา
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('index.html', copy));
          return res;
        })
        .catch(() => caches.match('index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // รูป/ไอคอน/ฟอนต์: ใช้ของใน cache ก่อน แล้วค่อยอัปเดตเบื้องหลัง
  if (STATIC_EXT.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});
