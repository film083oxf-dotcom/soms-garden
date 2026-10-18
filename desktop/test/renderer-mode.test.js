'use strict';
/**
 * desktop/test/renderer-mode.test.js — เทสต์การสลับชุดท่าปกติ ↔ ชุดท่านอนหลับ
 * รัน renderer.js จริงใน sandbox พร้อม DOM ปลอม (ไม่ต้องเปิด Electron)
 * จึงตรวจได้ว่า "สถานะจริง → class sleepy" ไม่ใช่แค่ฟังก์ชันเดี่ยว ๆ
 *
 * รัน: cd desktop && npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { effective } = require('../lib/status.js');

const RENDERER = path.join(__dirname, '..', 'renderer', 'renderer.js');
const HTML = path.join(__dirname, '..', 'renderer', 'index.html');
const ROOT = path.join(__dirname, '..', '..');
const { decodePng, STATUSES } = require(path.join(ROOT, 'tools', 'pixelate-sprites.js'));
const NOW = Date.parse('2026-10-18T12:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

/** element ปลอมเท่าที่ renderer.js แตะจริง */
function fakeEl(extra) {
  const classes = new Set();
  const el = {
    dataset: {},
    style: {
      setProperty(name, value) { this[name] = value; },
      removeProperty(name) { delete this[name]; },
    },
    textContent: '',
    offsetWidth: 170,
    offsetHeight: 150,
    naturalWidth: 0,
    naturalHeight: 0,
    complete: false,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : !!force;
        if (on) classes.add(c);
        else classes.delete(c);
        return on;
      },
    },
    addEventListener() {},
  };
  if (extra) Object.assign(el, extra);
  el._classes = classes;
  return el;
}

/**
 * รัน renderer.js ใน sandbox แล้วคืนเครื่องมือสำหรับยิงสถานะเข้าไป
 * (@returns {{ rig, sprite, bubbleText, status, toast, som }})
 */
function bootRenderer(opts = {}) {
  const els = {
    rig: fakeEl(),
    pet: fakeEl(),
    sprite: fakeEl(),
    sleepSprite: fakeEl(),
    bubble: fakeEl(),
    bubbleText: fakeEl(),
  };
  const channels = {};
  const som = {
    onStatus(cb) { channels.status = cb; },
    onToast(cb) { channels.toast = cb; },
    setInteractive() {},
    focusAgentWindow() { return Promise.resolve(null); },
    showMenu() {},
    hello() {},
  };
  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    setTimeout() { return 0; },          // ไม่ให้ hello/toast ทำงานเบื้องหลัง
    clearTimeout() {},
    requestAnimationFrame() { return 0; }, // ไม่ต้องเดิน loop จริง
    document: {
      body: fakeEl(),
      documentElement: fakeEl(),
      addEventListener() {},
      getElementById: (id) => els[id],
    },
  };
  sandbox.window = {
    innerWidth: 420,
    innerHeight: 300,
    location: { search: opts.search || '' },
    addEventListener() {},
    matchMedia: () => ({ matches: false }),
    som,
  };
  vm.runInNewContext(fs.readFileSync(RENDERER, 'utf8'), sandbox, { filename: RENDERER });
  return {
    ...els,
    som,
    win: sandbox.window,
    documentEl: sandbox.document.documentElement,
    status: (payload) => channels.status(payload),
    toast: (payload) => channels.toast(payload),
  };
}

test('petSize จาก soms.config.json: ใช้เฉพาะจำนวนเต็มเท่าของ 64', () => {
  const ok = bootRenderer({ search: '?petSize=256' });
  assert.equal(ok.documentEl.style['--pet-size'], '256px');
  assert.equal(ok.documentEl.dataset.petSize, '256');

  const bad = bootRenderer({ search: '?petSize=200' });
  assert.equal(bad.documentEl.style['--pet-size'], undefined, 'ไม่ใช่เท่าของ 64 → ใช้ค่าเริ่มต้นใน CSS');

  const none = bootRenderer();
  assert.equal(none.documentEl.style['--pet-size'], undefined, 'ไม่ส่ง query → ค่าเริ่มต้น');
});

test('เริ่มต้นที่ชุดท่าปกติ และยังสลับเองผ่าน window.somMode ได้', () => {
  const r = bootRenderer();
  assert.equal(r.rig.dataset.mode, 'normal');
  assert.equal(r.rig.classList.contains('sleepy'), false);
  assert.equal(typeof r.win.somMode, 'function');

  r.win.somMode('sleepy');
  assert.equal(r.rig.classList.contains('sleepy'), true);
  r.win.somMode('normal');
  assert.equal(r.rig.dataset.mode, 'normal');
});

test('status.json = idle → เข้าโหมดน้องแมวง่วงนอน (sleepy)', () => {
  const r = bootRenderer();
  r.status(effective({ status: 'idle', updatedAt: ago(1000) }, NOW));
  assert.equal(r.rig.dataset.mode, 'sleepy');
  assert.equal(r.rig.dataset.status, 'idle');
  assert.equal(r.rig.classList.contains('sleepy'), true);
  assert.equal(r.bubbleText.textContent, 'ไม่มีใครอยู่เลย... ขอหลับก่อน Zzz 😴');
});

test('idle เพราะเงียบเกิน ttlMinutes (stale) ก็เข้าโหมดง่วงนอนเหมือนกัน', () => {
  const r = bootRenderer();
  const stale = effective({ status: 'coding', updatedAt: ago(11 * 60000) }, NOW);
  assert.equal(stale.status, 'idle', 'เงียบ 11 นาที = หลับ');
  r.status(stale);
  assert.equal(r.rig.classList.contains('sleepy'), true);
});

test('สถานะอื่นทุกค่ากลับมาชุดท่าปกติทันที แม้เพิ่งหลับอยู่', () => {
  const r = bootRenderer();
  r.status(effective({ status: 'idle', updatedAt: ago(1000) }, NOW));
  assert.equal(r.rig.classList.contains('sleepy'), true);

  for (const status of ['thinking', 'coding', 'success', 'error', 'done']) {
    r.status(effective({ status, updatedAt: ago(1000) }, NOW));
    assert.equal(r.rig.dataset.mode, 'normal', status + ' → normal');
    assert.equal(r.rig.classList.contains('sleepy'), false, status + ' ต้องถอด class sleepy');
    assert.equal(r.rig.dataset.status, status);
  }
});

test('สลับไป-กลับหลายรอบไม่ค้าง class และยังใช้ภาพ .png ตามเดิม', () => {
  const r = bootRenderer();
  for (let i = 0; i < 3; i++) {
    r.status(effective({ status: 'idle', updatedAt: ago(1000) }, NOW));
    assert.equal(r.rig.classList.contains('sleepy'), true);
    r.status(effective({ status: 'coding', updatedAt: ago(1000) }, NOW));
    assert.equal(r.rig.classList.contains('sleepy'), false);
  }
  assert.match(r.sprite.src, /sprites\/coding\.png$/);
});

test('ไฟล์ sprite sheet ที่ CSS อ้างถึงมีอยู่จริง (path ใช้ได้ทั้ง npm start และตอนแพ็ก)', () => {
  const html = fs.readFileSync(HTML, 'utf8');
  const m = html.match(/background-image:\s*url\("([^"]+)"\)/);
  assert.ok(m, 'index.html ต้องมี background-image ของ sleep sprite');
  const file = path.resolve(path.dirname(HTML), m[1]);
  assert.ok(fs.existsSync(file), 'ไม่พบไฟล์ ' + file);

  const png = fs.readFileSync(file);
  assert.equal(png.toString('ascii', 1, 4), 'PNG', 'ต้องเป็น PNG');
  assert.equal(png.readUInt32BE(16), 1024, 'กว้าง 1024');
  assert.equal(png.readUInt32BE(20), 1024, 'สูง 1024 (2×2 เฟรม ๆ ละ 512)');
});

test('index.html ผูก #sleepSprite ในกล่องเดียวกับ #sprite และตั้ง pixelated ให้ทั้งสองสไปรต์', () => {
  const html = fs.readFileSync(HTML, 'utf8');
  assert.match(html, /<div id="pet"[\s\S]*?<div id="sleepSprite"[\s\S]*?<\/div>\s*<\/div>/);

  const css = html.replace(/\/\*[\s\S]*?\*\//g, '');   // ข้ามคอมเมนต์อธิบาย
  assert.match(css, /#sprite\s*\{[^}]*image-rendering:\s*pixelated/);

  // ชีตหลับเป็นพิกเซลอาร์ต 64×64 ×8 เหมือน 6 ท่าหลัก → ต้อง pixelated
  const sleepBlock = css.match(/#sleepSprite\s*\{[^}]*\}/);
  assert.ok(sleepBlock, 'ต้องมีบล็อก #sleepSprite');
  assert.match(sleepBlock[0], /image-rendering:\s*pixelated/);

  // 4 เฟรมในชีต = 2×2 กล่อง → background-size ต้องเป็น 2 เท่าของ --pet-size
  assert.match(sleepBlock[0], /background-size:\s*calc\(var\(--pet-size\) \* 2\)\s+calc\(var\(--pet-size\) \* 2\)/);
  assert.doesNotMatch(sleepBlock[0], /clip-path/, 'เฟรมละกล่องพอดี ไม่ต้องตัดขอบแล้ว');

  // keyframes ต้องเลื่อนครบ 4 เฟรม (บนซ้าย/บนขวา/ล่างซ้าย/ล่างขวา)
  const keyframes = css.match(/@keyframes sleepyAnim\s*\{([\s\S]*?)\n  \}/);
  assert.ok(keyframes, 'ต้องมี @keyframes sleepyAnim');
  for (const stop of ['0%', '25%', '50%', '75%']) {
    assert.ok(keyframes[1].includes(stop + ' '), 'มี keyframe ' + stop);
  }
  assert.equal((keyframes[1].match(/background-position/g) || []).length, 4, 'เลื่อนตำแหน่ง 4 เฟรม');
});

test('สไปรต์ชีตหลับ: alpha 0/255, ใช้ 24 สีชุดเดิม และวางตัวตรงกับ idle (ไม่กระโดด)', () => {
  const html = fs.readFileSync(HTML, 'utf8');
  const m = html.match(/background-image:\s*url\("([^"]+)"\)/);
  const sheet = decodePng(path.resolve(path.dirname(HTML), m[1]));
  assert.equal(sheet.width, 1024);

  // palette ร่วม 24 สี อ่านจาก sprites/*.png (ผลของ pixelate-sprites.js)
  const palette = new Set();
  for (const status of STATUSES) {
    const img = decodePng(path.join(ROOT, 'sprites', status + '.png'));
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] === 255) palette.add((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]);
    }
  }
  assert.equal(palette.size, 24, '6 ท่าหลักใช้ 24 สีพอดี');

  const idle = decodePng(path.join(ROOT, 'sprites', 'idle.png'));
  const unit = idle.width / 64;
  const idleBottom = Math.floor(contentBottom(idle) / unit);

  const cell = sheet.width / 2;
  for (let index = 0; index < 4; index++) {
    const fx = index % 2;
    const fy = Math.floor(index / 2);
    let bottom = -1;
    let left = cell;
    let right = -1;
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const i = (((fy * cell + y) * sheet.width) + fx * cell + x) * 4;
        const a = sheet.data[i + 3];
        assert.ok(a === 0 || a === 255, `alpha ต้องเป็น 0/255 (เฟรม ${index + 1})`);
        if (a === 0) continue;
        const color = (sheet.data[i] << 16) | (sheet.data[i + 1] << 8) | sheet.data[i + 2];
        assert.ok(palette.has(color), 'สี #' + color.toString(16).padStart(6, '0') + ' ต้องอยู่ในพาเลตต์ 24 สี');
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
    // ขยาย ×8: เส้นพื้นของทุกเฟรมต้องอยู่แถวเดียวกับ idle (คลาดได้ไม่เกิน 1 พิกเซลอาร์ต)
    assert.ok(Math.abs(bottom / 8 - idleBottom) <= 1, `เฟรม ${index + 1} วางเส้นพื้นตรงกับ idle`);
    // และอยู่กลางกล่อง (จุดกึ่งกลางห่างจากกลางกล่องไม่เกิน 1 พิกเซลอาร์ต)
    assert.ok(Math.abs((left + right) / 2 / 8 - 32) <= 1, `เฟรม ${index + 1} อยู่กลางกล่อง`);
  }
});

/** แถวล่างสุดที่มีพิกเซลทึบของภาพ */
function contentBottom(img) {
  for (let y = img.height - 1; y >= 0; y--) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] === 255) return y;
    }
  }
  return -1;
}
