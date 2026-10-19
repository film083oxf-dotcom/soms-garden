/**
 * tests/browser-smoke.test.js — เทสต์หน้าเว็บจริงในเบราว์เซอร์ headless (ไม่ต้องลง dependency)
 *
 * รัน: node --test tests/browser-smoke.test.js
 *
 * วิธีทำงาน
 *  1) คัดลอกหน้าเว็บ + สไปรท์ + ไอคอน ลงโฟลเดอร์ชั่วคราว (ของจริงไม่ถูกแตะ)
 *  2) เปิด HTTP server เล็ก ๆ ให้หน้าเว็บ fetch status.json / garden.json ได้จริง
 *  3) ฉีดสคริปต์ probe ตัวเล็ก ๆ เก็บ “สิ่งที่หน้าเว็บแสดง” เป็น JSON ลงใน DOM
 *  4) เรียก Chrome/Edge โหมด headless แล้วอ่านผลจาก DOM ที่ dump ออกมา
 *
 * ถ้าเครื่องไม่มี Chrome/Edge จะ skip (ไม่ใช่ pass) และบอกว่าข้ามเพราะอะไร
 * ตั้ง path เองได้ด้วย env CHROME_PATH
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

/* ---------- หาเบราว์เซอร์ที่ใช้ได้ ---------- */
function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch { /* ข้าม path ที่อ่านไม่ได้ */ }
  }
  return null;
}

const BROWSER = findBrowser();
const skipReason = 'ไม่พบ Chrome/Edge ในเครื่อง — ตั้ง env CHROME_PATH เพื่อชี้ไฟล์เบราว์เซอร์';

/* ---------- สคริปต์ probe ที่ฉีดเข้าไปในสำเนา index.html ---------- */
const PROBE = `
<script>
(function () {
  var tries = 0;
  function snap() {
    var s = document.getElementById('sprite');
    var plants = document.getElementById('plants');
    var box = document.querySelector('.bubble');
    var html = plants.innerHTML;
    return {
      body: document.body.className,
      bubble: document.getElementById('bubbleText').textContent,
      hint: document.getElementById('hint').textContent,
      pill: document.getElementById('statusPill').textContent,
      sprite: s.getAttribute('src'),
      spriteLoaded: s.naturalWidth,
      spriteCssW: parseFloat(getComputedStyle(s).width),
      imageRendering: getComputedStyle(s).imageRendering,
      fellBack: s.dataset.fb === '1',
      plantCount: document.getElementById('plantCount').textContent,
      streak: document.getElementById('streak').textContent,
      leaf: document.getElementById('leafState').textContent,
      plantsClass: plants.className,
      plantNodes: plants.querySelectorAll('.plant').length,
      trees: (html.match(/#C08552/g) || []).length,
      flowers: (html.match(/#FFE27A/g) || []).length,
      ariaLive: box.getAttribute('aria-live'),
      ariaRole: box.getAttribute('role'),
      ariaPressed: document.querySelectorAll('[data-set-theme][aria-pressed="true"]').length,
      hasPet: !!document.getElementById('pet'),
      spriteInPet: !!document.querySelector('#pet #sprite'),
      hasShadow: !!document.querySelector('.pet-shadow'),
      petAnim: getComputedStyle(document.getElementById('pet')).animationName,
      dropAnim: (document.querySelector('.fx .drop') ? getComputedStyle(document.querySelector('.fx .drop')).animationName : null),
      sparkAnim: (document.querySelector('.fx .spark') ? getComputedStyle(document.querySelector('.fx .spark')).animationName : null),
      heartAnim: (document.querySelector('.fx .heart') ? getComputedStyle(document.querySelector('.fx .heart')).animationName : null),
      tearNodes: document.querySelectorAll('.fx .tear').length
    };
  }
  function write(id, prefix, data) {
    var pre = document.createElement('pre');
    pre.id = id;
    pre.textContent = prefix + JSON.stringify(data) + 'END';
    document.body.appendChild(pre);
  }
  function finish() {
    write('smoke-result', 'SMOKE', snap());
    if (location.search.indexOf('smoke=pet') >= 0) {
      var pet = document.getElementById('pet');
      pet.click();                                   // จับ “กดลูบหัว”
      setTimeout(function () {
        write('smoke-pet', 'SMOKEPET', {
          petted: pet.classList.contains('petted'),
          bubble: document.getElementById('bubbleText').textContent,
          heartAnim: getComputedStyle(document.querySelector('.fx .heart')).animationName,
          status: document.body.className
        });
      }, 300);
    }
  }
  function wait() {
    tries += 1;
    var s = document.getElementById('sprite');
    var text = document.getElementById('bubbleText').textContent;
    var hint = document.getElementById('hint').textContent;
    var loaded = !!(s && s.complete && s.naturalWidth > 0);
    // รอ tick() รอบแรก (ฟองคำพูดหลุดจากค่าเริ่มต้น) + รูปโหลดเสร็จ + ให้ garden.json วาดเสร็จ
    // กรณียังไม่มี status.json ฟองจะไม่เปลี่ยน แต่ hint จะบอก → ถือว่าพร้อมแล้ว
    var ready = text !== 'กำลังตื่นอยู่...' || hint.indexOf('ยังไม่เจอ status.json') >= 0;
    if (tries > 1 && ready && loaded) return setTimeout(finish, 500);
    if (tries > 100) return finish();
    setTimeout(wait, 50);
  }
  setTimeout(wait, 50);
})();
</script>
`;

/* ---------- MIME ที่ต้องเสิร์ฟให้ถูก ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
};

/* ---------- สร้างสำเนาเว็บในโฟลเดอร์ชั่วคราว ---------- */
function makeSite() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'som-smoke-'));
  fs.mkdirSync(path.join(dir, 'sprites'));
  fs.mkdirSync(path.join(dir, 'icons'));

  for (const f of fs.readdirSync(path.join(ROOT, 'sprites'))) {
    const from = path.join(ROOT, 'sprites', f);
    if (!fs.statSync(from).isFile()) continue;   // ข้าม sprites/original (ไฟล์ต้นฉบับสำรอง)
    fs.copyFileSync(from, path.join(dir, 'sprites', f));
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'icons'))) {
    fs.copyFileSync(path.join(ROOT, 'icons', f), path.join(dir, 'icons', f));
  }
  fs.copyFileSync(path.join(ROOT, 'manifest.webmanifest'), path.join(dir, 'manifest.webmanifest'));

  // ฉีด probe ต่อท้ายก่อน </body>
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(dir, 'index.html'), html.replace('</body>', PROBE + '</body>'), 'utf8');

  return dir;
}

function startServer(dir) {
  const server = http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    } catch {
      res.writeHead(400).end('bad request');
      return;
    }
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.join(dir, rel);
    if (!file.startsWith(dir)) {                      // กัน path traversal
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(buf);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

/* ---------- เปิดเบราว์เซอร์ headless แล้วอ่านผลจาก DOM ---------- */
// เขียน DOM ที่ dump ออกมาลงไฟล์ (ไม่ใช้ pipe: ลูกของ Chrome อาจถือ pipe ค้างจนค้างทั้งเทสต์)
function readPage(origin, profile, dumpFile, opts = {}) {
  const { budget = 3000, pressPet = false, extraArgs = [] } = opts;
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--window-size=420,760',
    `--user-data-dir=${profile}`,
    `--virtual-time-budget=${budget}`,
    '--dump-dom',
    ...extraArgs,
    origin + (pressPet ? '/?smoke=pet' : '/'),
  ];

  const out = fs.openSync(dumpFile, 'w');
  return new Promise((resolve, reject) => {
    const child = spawn(BROWSER, args, { stdio: ['ignore', out, 'ignore'] });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('เบราว์เซอร์ไม่จบภายใน 60 วินาที'));
    }, 60000);

    child.on('error', (err) => {
      clearTimeout(timer);
      fs.closeSync(out);
      reject(err);
    });

    child.on('exit', () => {
      clearTimeout(timer);
      fs.closeSync(out);
      let dump = '';
      try { dump = fs.readFileSync(dumpFile, 'utf8'); } catch { /* ไฟล์ว่าง = รายงานด้านล่าง */ }
      const hit = /SMOKE(\{[\s\S]*?\})END/.exec(dump);
      if (!hit) {
        reject(new Error('ไม่พบผลจาก probe ใน DOM ที่เบราว์เซอร์ส่งกลับ (หน้าเว็บอาจโหลดไม่ขึ้น)'));
        return;
      }
      const petHit = /SMOKEPET(\{[\s\S]*?\})END/.exec(dump);
      resolve({ page: JSON.parse(hit[1]), pet: petHit ? JSON.parse(petHit[1]) : null });
    });
  });
}

function writeSite(dir, status, garden) {
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(status), 'utf8');
  if (garden === null) fs.rmSync(path.join(dir, 'garden.json'), { force: true });
  else fs.writeFileSync(path.join(dir, 'garden.json'), JSON.stringify(garden), 'utf8');
}

const isoMinutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const dayAgo = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  const pad = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* ---------- เทสต์ทั้งชุดใช้สำเนาเว็บ + server ชุดเดียวกัน ---------- */
test('browser smoke: หน้าเว็บจริงใน Chrome headless', { skip: BROWSER ? false : skipReason }, async (t) => {
  const site = makeSite();
  const { server, origin } = await startServer(site);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'som-profile-'));
  const dumpFile = path.join(site, 'dump.html');

  t.after(async () => {
    await new Promise((r) => {
      if (server.closeAllConnections) server.closeAllConnections();   // keep-alive ของ Chrome ไม่ให้ค้างปิด server
      server.close(r);
    });
    fs.rmSync(site, { recursive: true, force: true });
    fs.rmSync(profile, { recursive: true, force: true });
  });

  await t.test('โคลนใหม่: ไม่มี status.json / garden.json → หลับ + คำใบ้ ไม่พัง', async () => {
    fs.rmSync(path.join(site, 'status.json'), { force: true });
    fs.rmSync(path.join(site, 'garden.json'), { force: true });
    const { page } = await readPage(origin, profile, dumpFile);

    assert.equal(page.body, 'st-idle');
    assert.match(page.hint, /ยังไม่เจอ status\.json/);
    assert.equal(page.plantNodes, 0, 'ยังไม่มีสวนก็ต้องไม่พัง');
    assert.equal(page.spriteLoaded, 512, 'ยังต้องแสดงภาพน้องส้มได้');
  });

  await t.test('ขนาดแสดงผลเป็นจำนวนเท่าของ 64 และใช้ image-rendering: pixelated', async () => {
    writeSite(site, { status: 'coding', message: 'พิกเซลอาร์ต', updatedAt: new Date().toISOString() }, null);
    const { page } = await readPage(origin, profile, dumpFile);

    assert.equal(page.spriteCssW, 192, 'แสดงผล 192px = 3×64');
    assert.equal(page.spriteCssW % 64, 0, 'ต้องเป็นจำนวนเท่าของ 64');
    assert.equal(page.imageRendering, 'pixelated');
    assert.equal(page.spriteLoaded, 512, 'ภาพต้นทางยังเป็น 512 (64×8)');
  });

  await t.test('ทุกท่า: ภาพ/ฟองคำพูด/ป้ายสถานะตรงกับ status.json', async () => {
    const cases = [
      ['thinking', 'ขอคิดแป๊บ', 'กำลังคิด'],
      ['coding', 'รดน้ำต้นกล้า', 'กำลังเขียนโค้ด'],
      ['success', 'ผ่านหมดแล้ว', 'สำเร็จ'],
      ['error', 'มีอะไรพัง', 'มีข้อผิดพลาด'],
      ['done', 'เสร็จแล้วนะ', 'งานเสร็จแล้ว'],
    ];

    for (const [status, message, pill] of cases) {
      writeSite(site, { status, message, updatedAt: new Date().toISOString() }, null);
      const { page } = await readPage(origin, profile, dumpFile);

      assert.equal(page.body, 'st-' + status, `${status}: body class ต้องเป็น st-${status}`);
      assert.equal(page.bubble, message, `${status}: ฟองคำพูดต้องใช้ข้อความจาก status.json`);
      assert.equal(page.pill, pill, `${status}: ป้ายสถานะภาษาไทย`);
      assert.equal(page.sprite, 'sprites/' + status + '.png', `${status}: ต้องโหลด PNG ของท่านั้น`);
      assert.equal(page.spriteLoaded, 512, `${status}: รูปต้องโหลดสำเร็จจริง (512px)`);
      assert.equal(page.fellBack, false, `${status}: ต้องไม่ต้องใช้ SVG สำรอง`);
    }
  });

  await t.test('ttlMinutes: เงียบ 5 นาทีแต่ตั้ง ttl 90 → ยังไม่หลับ', async () => {
    writeSite(site, { status: 'coding', message: 'งานยาว', updatedAt: isoMinutesAgo(5), ttlMinutes: 90 }, null);
    const { page } = await readPage(origin, profile, dumpFile);

    assert.equal(page.body, 'st-coding', 'ต้องยังนั่งรดน้ำ ไม่ใช่หลับ');
    assert.equal(page.bubble, 'งานยาว');
  });

  await t.test('ttlMinutes: เงียบ 90 วินาทีกับ ttl 1 นาที → หลับเอง', async () => {
    writeSite(site, { status: 'coding', message: 'เงียบไปแล้ว', updatedAt: isoMinutesAgo(1.5), ttlMinutes: 1 }, null);
    const { page } = await readPage(origin, profile, dumpFile);

    assert.equal(page.body, 'st-idle');
    assert.equal(page.pill, 'หลับ / ไม่อัปเดต');
    assert.match(page.bubble, /หลับก่อน/);
  });

  await t.test('สถานะที่ไม่รู้จัก → ถอยไปท่าหลับ ไม่พังทั้งหน้า', async () => {
    writeSite(site, { status: 'dancing', message: '', updatedAt: new Date().toISOString() }, null);
    const { page } = await readPage(origin, profile, dumpFile);

    assert.equal(page.body, 'st-idle');
    assert.equal(page.spriteLoaded, 512, 'ยังต้องแสดงภาพได้');
  });

  await t.test('สวน: วาดครบทุกต้น + นับจำนวน + สตรีค', async () => {
    const today = dayAgo(0);
    writeSite(
      site,
      { status: 'done', message: 'เก็บสวน', updatedAt: new Date().toISOString() },
      {
        plants: [
          { type: 'feature', kind: 'tree', date: today },
          { type: 'fix', kind: 'flower', date: today },
          { type: 'docs', kind: 'bush', date: today },
        ],
        streak: 3,
        lastDone: today,
      }
    );

    const { page } = await readPage(origin, profile, dumpFile);
    assert.equal(page.plantNodes, 3, 'ต้องมีต้นไม้ 3 ต้นใน DOM');
    assert.match(page.plantCount, /3/);
    assert.match(page.streak, /3/);
    assert.ok(page.trees >= 1, 'ต้องมีต้นไม้ใหญ่ (kind=tree)');
    assert.ok(page.flowers >= 1, 'ต้องมีดอกไม้ (kind=flower)');
    assert.equal(page.plantsClass.includes('yellow'), false, 'ทำวันนี้ → ใบยังเขียว');
    assert.equal(page.leaf, '');
  });

  await t.test('ใบเหลือง: lastDone เป็น ISO เต็ม 5 วันก่อน → “ขาด 5 วัน” ไม่ใช่ NaN', async () => {
    // วันที่ต้องคิดแบบปฏิทินเวลาเครื่อง (เหมือน dayAgo) — toISOString() ของ "ตอนนี้ลบ 5 วัน"
    // จะเลื่อนไปวันก่อนหน้าเมื่อรันช่วงเช้ามืดในโซนเวลาเป็นบวก ทำให้ได้ "ขาด 6 วัน"
    const iso = `${dayAgo(5)}T12:00:00.000Z`;
    writeSite(
      site,
      { status: 'thinking', message: 'คิดงาน', updatedAt: new Date().toISOString() },
      { plants: [{ type: 'fix', kind: 'flower', date: iso.slice(0, 10) }], streak: 2, lastDone: iso }
    );

    const { page } = await readPage(origin, profile, dumpFile);
    assert.match(page.leaf, /ขาด 5 วัน/, 'ต้องอ่านวันที่แบบ ISO เต็มได้');
    assert.match(page.plantsClass, /yellow-2/);
  });

  await t.test('a11y: ฟองคำพูด announce ได้ + ปุ่มธีมบอกสถานะที่เลือก', async () => {
    writeSite(site, { status: 'thinking', message: 'ทดสอบ a11y', updatedAt: new Date().toISOString() }, null);
    const { page } = await readPage(origin, profile, dumpFile);

    assert.equal(page.ariaLive, 'polite');
    assert.equal(page.ariaRole, 'status');
    assert.equal(page.ariaPressed, 1, 'ต้องมีปุ่มธีมที่ aria-pressed="true" แค่ 1 ปุ่ม');
  });

  await t.test('น้องส้มมีกรอบ .pet + เงา + หายใจได้', async () => {
    writeSite(site, { status: 'coding', message: 'ขยับตัว', updatedAt: new Date().toISOString() }, null);
    const { page } = await readPage(origin, profile, dumpFile);

    assert.equal(page.hasPet, true, 'ต้องมี .pet ครอบรูป');
    assert.equal(page.spriteInPet, true, '#sprite ต้องอยู่ใน .pet');
    assert.equal(page.hasShadow, true, 'ต้องมีเงาใต้ตัว');
    assert.equal(page.petAnim, 'breathe', 'ตัวต้องหายใจ (animation breathe)');
  });

  await t.test('เอฟเฟกต์เปลี่ยนตามท่า: coding=น้ำหยด, success=ประกาย, done=หัวใจ, error=ไม่มีน้ำตา', async () => {
    writeSite(site, { status: 'coding', message: 'รดน้ำ', updatedAt: new Date().toISOString() }, null);
    let { page } = await readPage(origin, profile, dumpFile);
    assert.equal(page.dropAnim, 'drip', 'coding ต้องมีน้ำหยด');

    writeSite(site, { status: 'success', message: 'เย้', updatedAt: new Date().toISOString() }, null);
    ({ page } = await readPage(origin, profile, dumpFile));
    assert.equal(page.sparkAnim, 'twinkle', 'success ต้องมีประกาย');

    writeSite(site, { status: 'done', message: 'เสร็จ', updatedAt: new Date().toISOString() }, null);
    ({ page } = await readPage(origin, profile, dumpFile));
    assert.equal(page.heartAnim, 'floatUp', 'done ต้องมีหัวใจลอย');

    writeSite(site, { status: 'error', message: 'พัง', updatedAt: new Date().toISOString() }, null);
    ({ page } = await readPage(origin, profile, dumpFile));
    assert.equal(page.tearNodes, 0, 'ท่า error มีน้ำตาในภาพอยู่แล้ว ไม่ต้องซ้อน CSS tear');
  });

  await t.test('กดลูบหัว: ตัวย่น + หัวใจลอย + คำพูดอ้อน', async () => {
    writeSite(site, { status: 'coding', message: 'ทำงานอยู่', updatedAt: new Date().toISOString() }, null);
    const { page, pet } = await readPage(origin, profile, dumpFile, { pressPet: true });

    assert.ok(pet, 'probe ต้องรายงานผลหลังกดลูบหัว');
    assert.equal(pet.petted, true, 'ต้องติด class petted');
    assert.match(pet.bubble, /🐾|🍊|💛|😽/, 'ฟองคำพูดต้องเป็นคำอ้อน ๆ ตอนถูกลูบ');
    assert.equal(pet.heartAnim, 'floatUp', 'หัวใจต้องลอยขึ้นตอนถูกลูบ');
    assert.equal(page.body, 'st-coding', 'สถานะจริงต้องไม่เปลี่ยนจากการลูบหัว');
  });

  await t.test('prefers-reduced-motion: ปิดอนิเมชันทั้งหมด (ไม่ขยับ)', async () => {
    writeSite(site, { status: 'coding', message: 'ไม่ต้องขยับ', updatedAt: new Date().toISOString() }, null);
    const { page } = await readPage(origin, profile, dumpFile, { extraArgs: ['--force-prefers-reduced-motion'] });

    assert.equal(page.petAnim, 'none', 'ตัวไม่ต้องหายใจ');
    assert.equal(page.dropAnim, 'none', 'น้ำหยดต้องหยุด');
  });

  await t.test('ถ้า PNG หาย → ใช้ SVG สำรองและยังแสดงภาพได้', async () => {
    const png = path.join(site, 'sprites', 'idle.png');
    const backup = path.join(site, 'sprites', 'idle.png.bak');
    fs.renameSync(png, backup);
    try {
      writeSite(site, { status: 'idle', message: 'ลอง fallback', updatedAt: new Date().toISOString() }, null);
      const { page } = await readPage(origin, profile, dumpFile);

      assert.equal(page.fellBack, true, 'ต้องสลับไป .svg');
      assert.equal(page.sprite, 'sprites/idle.svg');
      assert.ok(page.spriteLoaded > 0, 'SVG ต้องโหลดขึ้นจริง');
    } finally {
      fs.renameSync(backup, png);
    }
  });
});
