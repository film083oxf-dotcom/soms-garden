'use strict';
/**
 * desktop/test/windows.test.js — เทสต์ตรรกะจับคู่ชื่อหน้าต่าง + การประกอบ argv
 * (ส่วนที่ไม่ต้องใช้ GUI/PowerShell — รัน: cd desktop && npm test)
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  matchWindowTitle,
  buildFocusArgs,
  buildListArgs,
  parseListOutput,
  parseFocusResult,
  isWindows,
  SCRIPTS,
} = require('../lib/windows.js');

const TITLES = ['Visual Studio Code — soms-garden', 'Codex', 'Windows PowerShell', 'npm install desktop'];

test('matchWindowTitle: ชื่อตรงเป๊ะ (ไม่สนตัวพิมพ์ ตัดช่องว่างหัวท้าย)', () => {
  assert.equal(matchWindowTitle(TITLES, 'codex'), 'Codex');
  assert.equal(matchWindowTitle(TITLES, 'CODEX'), 'Codex');
  assert.equal(matchWindowTitle(TITLES, '  codex  '), 'Codex');
});

test('matchWindowTitle: ไม่มีตรงเป๊ะ → ชื่อใดก็ได้ที่มีคำนั้นอยู่ข้างใน', () => {
  assert.equal(matchWindowTitle(TITLES, 'studio'), 'Visual Studio Code — soms-garden');
  assert.equal(matchWindowTitle(TITLES, 'soms-garden'), 'Visual Studio Code — soms-garden');
  assert.equal(matchWindowTitle(TITLES, 'power'), 'Windows PowerShell');
});

test('matchWindowTitle: ตรงเป๊ะชนะแบบมีคำอยู่ข้างในเสมอ', () => {
  assert.equal(matchWindowTitle(['abc def', 'abc'], 'ABC'), 'abc');
});

test('matchWindowTitle: หาไม่เจอ / คำค้นใช้ไม่ได้ → null', () => {
  assert.equal(matchWindowTitle(TITLES, 'firefox'), null);
  assert.equal(matchWindowTitle(TITLES, ''), null);
  assert.equal(matchWindowTitle(TITLES, '   '), null);
  assert.equal(matchWindowTitle(TITLES, undefined), null);
  assert.equal(matchWindowTitle(TITLES, 123), null);
  assert.equal(matchWindowTitle([], 'codex'), null);
  assert.equal(matchWindowTitle('not-an-array', 'codex'), null);
});

test('matchWindowTitle: ทิ้ง entry ที่ไม่ใช่ string ออก', () => {
  assert.equal(matchWindowTitle([null, 42, '', ' ok '], 'OK'), ' ok ');
});

test('buildFocusArgs: ชื่อหน้าต่างคือ argv ตัวเดียว — ไม่ถูกต่อเข้าสคริปต์ (กัน injection)', () => {
  const evil = 'x"; Stop-Computer; # $(rm -rf C:\\) `id`';
  const args = buildFocusArgs(evil);

  assert.equal(args.length, 8);
  assert.equal(args[0], '-NoProfile');
  assert.equal(args[4], '-File');
  assert.equal(args[5], SCRIPTS.focus);
  assert.equal(args[6], '-WindowTitle');
  assert.equal(args[7], evil, 'ชื่อต้องอยู่เป็น element สุดท้ายตามตัวอักษร');
  // argv ก่อนหน้าชื่อต้องเป็นค่าคงที่ทั้งหมด (ไม่มีตรงไหนมีเนื้อหาของชื่อ)
  assert.ok(args.slice(0, 7).every((a) => !a.includes('Stop-Computer')));
  assert.ok(args.slice(0, 7).every((a) => !a.includes('$(')));
});

test('buildFocusArgs: ชื่อว่าง/ชนิดผิด → throw', () => {
  assert.throws(() => buildFocusArgs(''), /ค่าว่าง/);
  assert.throws(() => buildFocusArgs('   '), /ค่าว่าง/);
  assert.throws(() => buildFocusArgs(null), /ค่าว่าง/);
  assert.throws(() => buildFocusArgs(undefined), /ค่าว่าง/);
});

test('buildListArgs: argv คงที่ทุกตัว ไม่มีส่วนไหนมาจากผู้ใช้', () => {
  const args = buildListArgs();
  assert.equal(args.length, 6);
  assert.equal(args[4], '-File');
  assert.equal(args[5], SCRIPTS.list);
});

test('parseListOutput: อ่าน JSON array ของชื่อ', () => {
  assert.deepEqual(parseListOutput('["A","B"]\r\n'), ['A', 'B']);
  assert.deepEqual(parseListOutput('["หน้าต่างเดียว"]'), ['หน้าต่างเดียว']);
});

test('parseListOutput: ของว่าง / รูปแบบผิด → throw', () => {
  assert.throws(() => parseListOutput(''), /ไม่ได้ส่งผลลัพธ์/);
  assert.throws(() => parseListOutput('   '), /ไม่ได้ส่งผลลัพธ์/);
  assert.throws(() => parseListOutput('not json'));
  assert.throws(() => parseListOutput('{"found":true}'), /array/);
});

test('parseFocusResult: อ่าน JSON จาก focus-window.ps1', () => {
  assert.deepEqual(
    parseFocusResult('{"found":true,"title":"Codex","restored":true,"foreground":true}'),
    { found: true, title: 'Codex', restored: true, foreground: true }
  );
});

test('parseFocusResult: ของว่าง/พัง → found:false โดยไม่ throw', () => {
  const empty = { found: false, title: '', restored: false, foreground: false };
  assert.deepEqual(parseFocusResult(''), empty);
  assert.deepEqual(parseFocusResult('<html>error</html>'), empty);
  assert.deepEqual(parseFocusResult('[1,2]'), empty);
  assert.deepEqual(parseFocusResult(null), empty);
});

test('isWindows ตรงกับ platform ของเครื่อง', () => {
  assert.equal(isWindows(), process.platform === 'win32');
});
