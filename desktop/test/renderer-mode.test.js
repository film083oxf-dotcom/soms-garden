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
const NOW = Date.parse('2026-10-18T12:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

/** element ปลอมเท่าที่ renderer.js แตะจริง */
function fakeEl(extra) {
  const classes = new Set();
  const el = {
    dataset: {},
    style: {},
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
function bootRenderer() {
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
    addEventListener() {},
    matchMedia: () => ({ matches: false }),
    som,
  };
  vm.runInNewContext(fs.readFileSync(RENDERER, 'utf8'), sandbox, { filename: RENDERER });
  return {
    ...els,
    som,
    win: sandbox.window,
    status: (payload) => channels.status(payload),
    toast: (payload) => channels.toast(payload),
  };
}

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
  assert.equal(png.readUInt32BE(16), 1920, 'กว้าง 1920');
  assert.equal(png.readUInt32BE(20), 1920, 'สูง 1920 (2×2 เฟรม)');
});

test('index.html ผูก #sleepSprite ไว้ในกล่องเดียวกับ #sprite และไม่ใส่ image-rendering: pixelated', () => {
  const html = fs.readFileSync(HTML, 'utf8');
  assert.match(html, /<div id="pet"[\s\S]*?<div id="sleepSprite"[\s\S]*?<\/div>\s*<\/div>/);

  // ภาพเป็นงานวาดขอบเนียน → ต้องไม่มี image-rendering ใน "ประกาศ CSS" (ข้ามคอมเมนต์ที่อธิบายเรื่องนี้)
  const css = html.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /image-rendering\s*:/);
});
