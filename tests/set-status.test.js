/**
 * tests/set-status.test.js — เทสต์ตรรกะของ set-status.js (ใช้ node:test ล้วน ไม่ต้องลงอะไร)
 *
 * รัน: node --test tests/
 *
 * ทุกเทสต์เขียนลงโฟลเดอร์ชั่วคราว ไม่แตะ status.json / garden.json ของจริง
 */
'use strict';

const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { setStatus, normalizeTTL, localDate, KIND_OF } = require('../set-status.js');

/* ---------- ที่เขียนไฟล์ชั่วคราวต่อ 1 เทสต์ ---------- */
const tempDirs = [];
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });  // เก็บกวาดหลังจบ
});

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'som-garden-'));
  tempDirs.push(dir);
  const statusFile = path.join(dir, 'status.json');
  const gardenFile = path.join(dir, 'garden.json');
  return {
    dir,
    statusFile,
    gardenFile,
    read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); },
    write(file, data) { fs.writeFileSync(file, JSON.stringify(data), 'utf8'); },
  };
}

const today = () => localDate(new Date());
const daysBefore = (n) => localDate(new Date(Date.now() - n * 86400000));

test('เขียน status.json พร้อมสถานะ ข้อความ และเวลา ISO', () => {
  const box = sandbox();
  assert.equal(setStatus('coding', '  กำลังเขียนเทสต์  ', null, { statusFile: box.statusFile }), null);

  const saved = box.read(box.statusFile);
  assert.equal(saved.status, 'coding');
  assert.equal(saved.message, 'กำลังเขียนเทสต์', 'ตัดช่องว่างหัวท้าย');
  assert.ok(!Number.isNaN(Date.parse(saved.updatedAt)), 'updatedAt ต้อง parse ได้');
  assert.equal(saved.ttlMinutes, undefined, 'ไม่ระบุ --ttl → ไม่เขียน field นี้');
});

test('สถานะที่ไม่รู้จัก → throw และไม่เขียนไฟล์', () => {
  const box = sandbox();
  assert.throws(() => setStatus('dancing', '', null, { statusFile: box.statusFile }), /สถานะไม่ถูกต้อง/);
  assert.equal(fs.existsSync(box.statusFile), false);
});

test('done → ปลูกต้นไม้ตามชนิดงาน', () => {
  const box = sandbox();
  const plant = setStatus('done', 'เสร็จแล้ว', 'docs', { statusFile: box.statusFile, gardenFile: box.gardenFile });

  assert.equal(plant.kind, 'bush');
  assert.equal(plant.type, 'docs');
  assert.equal(plant.date, today());

  const garden = box.read(box.gardenFile);
  assert.equal(garden.plants.length, 1);
  assert.equal(garden.streak, 1);
  assert.equal(garden.lastDone, today());
});

test('ชนิดงานที่ไม่รู้จัก → ถอยไปใช้ feature (ต้นไม้ใหญ่)', () => {
  const box = sandbox();
  const warn = console.warn;
  console.warn = () => {};                     // เงียบ warn ที่ตั้งใจให้เกิด
  try {
    const plant = setStatus('done', 'x', 'banana', { statusFile: box.statusFile, gardenFile: box.gardenFile });
    assert.equal(plant.type, 'feature');
    assert.equal(plant.kind, KIND_OF.feature);
  } finally {
    console.warn = warn;
  }
});

test('done สองครั้งในวันเดียว → ได้ 2 ต้น แต่สตรีคไม่บวกซ้ำ', () => {
  const box = sandbox();
  const opts = { statusFile: box.statusFile, gardenFile: box.gardenFile };
  setStatus('done', 'รอบเช้า', 'fix', opts);
  setStatus('done', 'รอบบ่าย', 'fix', opts);

  const garden = box.read(box.gardenFile);
  assert.equal(garden.plants.length, 2);
  assert.equal(garden.streak, 1, 'วันเดิมต้องไม่บวกสตรีค');
});

test('ทำต่อเนื่องเมื่อวาน → สตรีค +1', () => {
  const box = sandbox();
  box.write(box.gardenFile, {
    plants: [{ type: 'docs', kind: 'bush', date: daysBefore(1) }],
    streak: 4,
    lastDone: daysBefore(1),
  });

  setStatus('done', 'ต่อเนื่อง', 'docs', { statusFile: box.statusFile, gardenFile: box.gardenFile });
  const garden = box.read(box.gardenFile);
  assert.equal(garden.streak, 5);
  assert.equal(garden.plants.length, 2);
});

test('ขาดไปหลายวัน → สตรีคเริ่มใหม่ที่ 1', () => {
  const box = sandbox();
  box.write(box.gardenFile, {
    plants: [{ type: 'fix', kind: 'flower', date: daysBefore(9) }],
    streak: 12,
    lastDone: daysBefore(9),
  });

  setStatus('done', 'กลับมาแล้ว', 'fix', { statusFile: box.statusFile, gardenFile: box.gardenFile });
  assert.equal(box.read(box.gardenFile).streak, 1);
});

test('garden.json พัง/ไม่มี → เริ่มสวนใหม่ได้ ไม่ throw', () => {
  const box = sandbox();
  fs.writeFileSync(box.gardenFile, '{ this is not json', 'utf8');

  const plant = setStatus('done', 'ซ่อมสวน', 'feature', { statusFile: box.statusFile, gardenFile: box.gardenFile });
  assert.equal(plant.kind, 'tree');
  assert.equal(box.read(box.gardenFile).plants.length, 1);
});

test('done + { plant: false } → ไม่งอกต้นไม้ (โหมด demo)', () => {
  const box = sandbox();
  setStatus('done', 'demo', 'feature', { plant: false, statusFile: box.statusFile, gardenFile: box.gardenFile });
  assert.equal(fs.existsSync(box.gardenFile), false, 'ไม่ควรสร้าง garden.json เลย');
});

test('--ttl: ค่าปกติถูกเขียน, ค่าเพี้ยนถูกเมิน', () => {
  const box = sandbox();
  setStatus('coding', 'ttl 45', null, { statusFile: box.statusFile, ttlMinutes: 45 });
  assert.equal(box.read(box.statusFile).ttlMinutes, 45);

  setStatus('coding', 'ttl เพี้ยน', null, { statusFile: box.statusFile, ttlMinutes: 'abc' });
  assert.equal(box.read(box.statusFile).ttlMinutes, undefined);
});

test('normalizeTTL จำกัดช่วง 1–1440 นาที', () => {
  assert.equal(normalizeTTL(30), 30);
  assert.equal(normalizeTTL('30'), 30);
  assert.equal(normalizeTTL(0), null);
  assert.equal(normalizeTTL(-5), null);
  assert.equal(normalizeTTL(''), null);
  assert.equal(normalizeTTL(null), null);
  assert.equal(normalizeTTL(0.4), 1, 'ปัดขึ้นเป็นอย่างน้อย 1 นาที');
  assert.equal(normalizeTTL(9999), 1440, 'ไม่เกิน 24 ชั่วโมง');
});

test('localDate คืนวันที่แบบเวลาเครื่อง (YYYY-MM-DD)', () => {
  assert.match(localDate(new Date(2026, 0, 5)), /^2026-01-05$/);
  assert.match(localDate(), /^\d{4}-\d{2}-\d{2}$/);
});
