'use strict';
/**
 * desktop/test/config.test.js — เทสต์ soms.config.json + เมนูคลิกขวา (ไม่ต้องมี GUI)
 * รัน: cd desktop && npm test
 */
const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { readConfig, DEFAULTS } = require('../lib/config.js');
const { buildMenuTemplate } = require('../lib/menu.js');

const tempDirs = [];
after(() => {
  for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
});
function writeConfig(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'som-cfg-'));
  tempDirs.push(dir);
  const file = path.join(dir, 'soms.config.json');
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content), 'utf8');
  return file;
}

test('ไม่มีไฟล์ config → ค่าเริ่มต้น', () => {
  const cfg = readConfig(path.join(os.tmpdir(), 'som-config-missing-' + Date.now() + '.json'));
  assert.deepEqual(cfg, { window: '', gardenUrl: 'http://localhost:3000' });
});

test('อ่าน window + gardenUrl ได้และตัดช่องว่าง', () => {
  const cfg = readConfig(writeConfig({ window: '  Codex — soms  ', gardenUrl: 'https://example.com/garden' }));
  assert.equal(cfg.window, 'Codex — soms');
  assert.equal(cfg.gardenUrl, 'https://example.com/garden');
});

test('JSON พัง / รูปแบบผิด / URL ผิด → ไม่ throw ใช้ค่าเริ่มต้น', () => {
  assert.deepEqual(readConfig(writeConfig('ไม่ใช่ json แน่นอน')), DEFAULTS);
  assert.deepEqual(readConfig(writeConfig('"just a string"')), DEFAULTS);

  const badUrl = readConfig(writeConfig({ window: 'x', gardenUrl: 'javascript:alert(1)' }));
  assert.equal(badUrl.window, 'x');
  assert.equal(badUrl.gardenUrl, DEFAULTS.gardenUrl, 'ปฏิเสธ URL ที่ไม่ใช่ http(s)');

  const noWindow = readConfig(writeConfig({ window: 42 }));
  assert.equal(noWindow.window, '');
});

test('เมนูคลิกขวา: ครบ 3 รายการตามสเปก เรียงถูกต้อง', () => {
  const items = buildMenuTemplate({ goWindow() {}, openGarden() {}, quit() {} });
  assert.deepEqual(items.map((i) => i.label), ['ไปหน้าต่างเอเจนต์', 'เปิดหน้าสวน', 'ปิดน้องส้ม']);
  assert.deepEqual(items.map((i) => i.id), ['go-window', 'open-garden', 'quit']);
  assert.ok(items.every((i) => i.enabled === true));
  assert.ok(items.every((i) => typeof i.click === 'function'));
});

test('เมนู: ไม่ส่ง handler → ทุก item ปิด (enabled:false) ไม่แครช', () => {
  const items = buildMenuTemplate();
  assert.equal(items.length, 3);
  assert.ok(items.every((i) => i.enabled === false));
});
