'use strict';
/**
 * desktop/test/status.test.js — เทสต์การอ่าน/ตัดสินสถานะ
 * ยืนยันว่า desktop ใช้กติกาเดียวกับหน้าเว็บ (index.html) เป๊ะ ๆ (ไม่ต้องมี GUI)
 * รัน: cd desktop && npm test
 */
const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  effective,
  readStatus,
  idleAfterMs,
  IDLE_MS,
  POLL_MS,
  STATUSES,
  LINES,
  STALE_LINE,
} = require('../lib/status.js');

const MIN = 60000;
const NOW = Date.parse('2026-10-17T12:00:00.000Z');
const ago = (ms) => NOW - ms;

const tempDirs = [];
after(() => {
  for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
});
function tempStatus(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'som-desktop-'));
  tempDirs.push(dir);
  const file = path.join(dir, 'status.json');
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content), 'utf8');
  return file;
}

test('จังหวะอ่าน 1 วินาที + เงียบ 10 นาที = หลับ (ตรงหน้าเว็บ)', () => {
  assert.equal(POLL_MS, 1000);
  assert.equal(IDLE_MS, 10 * MIN);
  assert.equal(idleAfterMs({}), IDLE_MS);
});

test('สถานะสด + ข้อความ + window → ส่งผ่านครบทุก field', () => {
  const s = effective(
    { status: 'coding', message: 'กำลังเขียน', updatedAt: new Date(ago(5000)).toISOString(), window: 'Codex' },
    NOW
  );
  assert.deepEqual(s, {
    status: 'coding',
    line: 'กำลังเขียน',
    stale: false,
    updatedAt: ago(5000),
    window: 'Codex',
  });
});

test('ข้อความว่าง/ช่องว่าง → ใช้คำพูดเริ่มต้นของท่า (เหมือนหน้าเว็บ)', () => {
  for (const st of STATUSES) {
    const s = effective({ status: st, message: '   ', updatedAt: new Date(ago(1000)).toISOString() }, NOW);
    assert.equal(s.status, st);
    assert.equal(s.line, LINES[st]);
  }
});

test('สถานะที่ไม่รู้จัก → แสดง idle แต่ยังไม่ถือว่า stale', () => {
  const s = effective({ status: 'dancing', message: '', updatedAt: new Date(ago(1000)).toISOString() }, NOW);
  assert.equal(s.status, 'idle');
  assert.equal(s.line, LINES.idle);
  assert.equal(s.stale, false);
});

test('เงียบเกินเวลา → idle + ข้อความหลับ (ชื่อหน้าต่างยังใช้ได้)', () => {
  const s = effective(
    { status: 'coding', message: 'ไม่ควรเห็นข้อความนี้', updatedAt: new Date(ago(11 * MIN)).toISOString(), window: 'VS' },
    NOW
  );
  assert.equal(s.status, 'idle');
  assert.equal(s.line, STALE_LINE);
  assert.equal(s.stale, true);
  assert.equal(s.window, 'VS');
});

test('ttlMinutes: ค่าใช้ได้ขยายเวลาได้ ค่าเพี้ยนใช้ค่าเริ่มต้น (เหมือนหน้าเว็บ)', () => {
  const fresh = effective({ status: 'done', updatedAt: new Date(ago(20 * MIN)).toISOString(), ttlMinutes: 30 }, NOW);
  assert.equal(fresh.stale, false, 'ttl 30 นาที → เงียบ 20 นาทียังไม่หลับ');

  const defaulted = effective({ status: 'done', updatedAt: new Date(ago(20 * MIN)).toISOString(), ttlMinutes: 0 }, NOW);
  assert.equal(defaulted.stale, true, 'ttl 0 ใช้ไม่ได้ → ค่าเริ่มต้น 10 นาที → หลับ');

  assert.equal(idleAfterMs({ ttlMinutes: 99999 }), 1440 * MIN, 'จำกัดบนที่ 1440 นาที');
  assert.equal(idleAfterMs({ ttlMinutes: 'abc' }), IDLE_MS);
  assert.equal(idleAfterMs({ ttlMinutes: -3 }), IDLE_MS);
  assert.equal(idleAfterMs({ ttlMinutes: 1 }), 1 * MIN, 'จำกัดล่างที่ 1 นาที');
});

test('updatedAt หาย/เพี้ยน → stale ทันที', () => {
  assert.equal(effective({ status: 'coding' }, NOW).stale, true);
  assert.equal(effective({ status: 'coding', updatedAt: 'not a date' }, NOW).stale, true);
});

test('field window: เก็บเฉพาะ string ที่มีเนื้อหา', () => {
  const base = { status: 'coding', updatedAt: new Date(ago(1000)).toISOString() };
  assert.equal(effective({ ...base, window: '  My App  ' }, NOW).window, 'My App');
  assert.equal(effective({ ...base, window: '   ' }, NOW).window, null);
  assert.equal(effective({ ...base, window: 42 }, NOW).window, null);
  assert.equal(effective(base, NOW).window, null);
});

test('readStatus: อ่านไฟล์จริงจากดิสก์', () => {
  const file = tempStatus({ status: 'success', message: 'ผ่านหมด', updatedAt: new Date(ago(2000)).toISOString() });
  const s = readStatus(file, NOW);
  assert.equal(s.status, 'success');
  assert.equal(s.line, 'ผ่านหมด');
  assert.equal(s.stale, false);
  assert.equal(s.error, undefined);
});

test('readStatus: ไฟล์หาย/JSON พัง → error:true (main จะคงสถานะเดิม ไม่กระตุกเป็นหลับ)', () => {
  const missing = readStatus(path.join(os.tmpdir(), 'som-missing-' + Date.now() + '.json'), NOW);
  assert.equal(missing.error, true);
  assert.equal(missing.status, 'idle');
  assert.equal(missing.stale, true);

  const broken = readStatus(tempStatus('{ this is not json'), NOW);
  assert.equal(broken.error, true);
  assert.equal(broken.line, STALE_LINE);
});
