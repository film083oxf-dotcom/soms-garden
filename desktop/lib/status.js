'use strict';
/**
 * desktop/lib/status.js — อ่าน/ตัดสินสถานะแบบเดียวกับหน้าเว็บเป๊ะ (index.html)
 *
 * กติกาที่ต้องตรงกับหน้าเว็บ:
 * - อ่านทุก 1 วินาที (จังหวะอยู่ที่ main.js)
 * - เงียบเกิน ttlMinutes (ค่าเริ่มต้น 10 นาที, ช่วงที่ยอมรับ 1–1440) → idle
 * - สถานะที่ไม่รู้จัก → idle (แต่ยังไม่ถือว่า stale)
 * - ข้อความว่าง → ใช้คำพูดเริ่มต้นของท่านั้น
 * เพิ่มจากหน้าเว็บเล็กน้อย: field `window` (ชื่อหน้าต่างเอเจนต์) ส่งผ่านไปให้ renderer ด้วย
 */
const fs = require('node:fs');

const POLL_MS = 1000;
const IDLE_MS = 10 * 60 * 1000;          // ค่าเริ่มต้น: เงียบ 10 นาที → หลับ
const TTL_MIN = 1;
const TTL_MAX = 24 * 60;
const STATUSES = ['thinking', 'coding', 'success', 'error', 'done', 'idle'];
const LINES = {
  thinking: 'อืม... ขอคิดแป๊บนะ 🐾',
  coding: 'กำลังทำอยู่นะ~ รอหน่อยสักครู่ 🌱',
  success: 'เย้! ผ่านทุกอย่างแล้ว 🎉',
  error: 'แง... มีอะไรพังง่ะ 😿',
  done: 'เสร็จแล้ว! ขอพักเหนื่อยหน่อย 😸',
  idle: 'ไม่มีใครอยู่เลย... ขอหลับก่อน Zzz 😴',
};
const STALE_LINE = 'เงียบจัง... ขอหลับก่อน Zzz 😴';

/** เงียบนานแค่ไหนถึงหลับ — อ่านจาก ttlMinutes แล้วจำกัดช่วง 1–1440 นาที */
function idleAfterMs(raw) {
  const m = Number(raw && raw.ttlMinutes);
  if (!Number.isFinite(m) || m <= 0) return IDLE_MS;
  return Math.min(Math.max(m, TTL_MIN), TTL_MAX) * 60000;
}

/** field `window` — ต้องเป็น string ที่มีเนื้อหา ไม่งั้นเป็น null */
function windowNameOf(raw) {
  const w = raw && typeof raw.window === 'string' ? raw.window.trim() : '';
  return w || null;
}

/**
 * ตัดสินสถานะที่จะแสดงจริง (ตรงกับ effective() ใน index.html)
 * @param {object} raw    เนื้อ status.json
 * @param {number} nowMs  เวลาปัจจุบัน (รับเป็นพารามิเตอร์เพื่อให้เทสต์กำหนดเองได้)
 */
function effective(raw, nowMs = Date.now()) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const t = Date.parse(src.updatedAt || '');
  const baton = windowNameOf(src);
  const stale = !Number.isFinite(t) || nowMs - t > idleAfterMs(src);
  if (stale) {
    return {
      status: 'idle',
      line: STALE_LINE,
      stale: true,
      updatedAt: Number.isFinite(t) ? t : 0,
      window: baton,
    };
  }
  const status = STATUSES.indexOf(src.status) >= 0 ? src.status : 'idle';
  const msg = typeof src.message === 'string' ? src.message.trim() : '';
  return { status, line: msg || LINES[status], stale: false, updatedAt: t, window: baton };
}

/**
 * อ่านไฟล์ status.json แล้วตัดสินสถานะ
 * ไฟล์หาย/พัง → error: true (ฝั่ง main จะ “คงสถานะเดิม” ไว้ ไม่กระตุกเป็นหลับกลางคัน)
 */
function readStatus(statusPath, nowMs = Date.now()) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  } catch (err) {
    return { status: 'idle', line: STALE_LINE, stale: true, updatedAt: 0, window: null, error: true };
  }
  return effective(raw, nowMs);
}

module.exports = { POLL_MS, IDLE_MS, STATUSES, LINES, STALE_LINE, idleAfterMs, windowNameOf, effective, readStatus };
