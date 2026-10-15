#!/usr/bin/env node
'use strict';
/**
 * demo.js — สลับสถานะน้องส้มอัตโนมัติทุก 3 วินาที ไว้ดูว่าขยับถูกไหม
 *
 * ใช้: node demo.js               → วนซ้ำไม่รู้จบ (กด Ctrl+C เพื่อหยุด)
 *      node demo.js 1             → รันครบ 1 รอบ (6 สถานะ) แล้วหยุด
 *      node demo.js 2 --garden    → รัน 2 รอบ และให้สถานะ done ปลูกต้นไม้จริงด้วย
 *
 * เคล็ดลับ: เปิด index.html ผ่าน local server (npx serve .) ไว้
 * แล้วรันคำสั่งนี้ในอีกเทอร์มินัลหนึ่ง น้องส้มจะเปลี่ยนท่าให้เห็นเอง
 */

const { setStatus } = require('./set-status.js');

const DELAY_MS = 3000; // ทุก 3 วินาที
const STEPS = [
  ['thinking', 'อืม... ขอดูโครงสร้างก่อนนะ', null],
  ['coding',   'กำลังเขียนโค้ดอยู่~ อีกเดี๋ยวเสร็จ', null],
  ['success',  'เย้! รันผ่านหมดเลย', null],
  ['error',    'แง... มีบั๊กซ่อนอยู่ตัวหนึ่ง', null],
  ['done',     'เสร็จแล้ว! ปลูกต้นไม้สักต้นมั้ย', 'feature'],
  ['idle',     'เหนื่อยจัง... ขอหลับแป๊บ', null],
];

const args = process.argv.slice(2);
const loopsArg = args.find((a) => /^\d+$/.test(a));
const loops = loopsArg ? parseInt(loopsArg, 10) : Infinity; // จำนวนรอบ (ไม่ระบุ = ไม่รู้จบ)
const plantOnDone = args.includes('--garden');              // ปลูกต้นไม้จริงไหม

let step = 0;

console.log('🎬 เริ่ม demo น้องส้มทำสวน — Ctrl+C เพื่อหยุด');
console.log(`   (${loops === Infinity ? 'วนไม่รู้จบ' : loops + ' รอบ'} · done ${
  plantOnDone ? 'จะปลูกต้นไม้จริง' : 'ไม่แตะสวน'})\n`);

function next() {
  const [status, message, taskType] = STEPS[step % STEPS.length];
  const round = Math.floor(step / STEPS.length) + 1;
  const index = (step % STEPS.length) + 1;

  // demo ไม่ปลูกต้นไม้ตาม default เพื่อไม่ให้ garden.json รกตอนทดสอบ
  const planted = setStatus(status, message, taskType, { plant: plantOnDone });

  const icon = { thinking: '🤔', coding: '✍️', success: '🎉', error: '😿', done: '😸', idle: '😴' }[status];
  console.log(
    `[รอบ ${round} · ${index}/${STEPS.length}] ${icon} ${status}` +
    (message ? ` — "${message}"` : '') +
    (planted ? ' 🌱 (ปลูกต้นไม้แล้ว)' : '')
  );

  step += 1;
  if (step >= loops * STEPS.length) {
    console.log('🏁 จบ demo — น้องส้มกลับมานั่งเฉย ๆ แล้ว (status.json อยู่ที่สถานะสุดท้าย)');
    return;
  }
  setTimeout(next, DELAY_MS);
}

next();
