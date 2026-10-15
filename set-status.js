#!/usr/bin/env node
'use strict';
/**
 * set-status.js — สั่งสถานะให้น้องส้ม (เขียนลง status.json)
 *
 * ใช้: node set-status.js <สถานะ> [ข้อความ] [ชนิดงาน]
 *   node set-status.js coding "กำลังเขียนหน้าล็อกอิน"
 *   node set-status.js done "เสร็จแล้ว" fix        ← fix = ปลูกดอกไม้
 *   node set-status.js done "เพิ่มฟีเจอร์ใหม่" feature  ← feature = ต้นไม้ใหญ่
 *   node set-status.js done "อัปเดตเอกสาร" docs    ← docs = พุ่มไม้
 *
 * สถานะที่รองรับ: thinking / coding / success / error / done / idle
 * - ทุกครั้งที่เป็น done จะเพิ่มต้นไม้ 1 ต้นลง garden.json พร้อมวันที่
 * - ถ้าไม่อัปเดตเกิน 2 นาที หน้าเว็บจะสลับเป็น idle ให้เอง
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const STATUSES = ['thinking', 'coding', 'success', 'error', 'done', 'idle'];
const KIND_OF = { fix: 'flower', feature: 'tree', docs: 'bush' }; // ชนิดงาน → ชนิดต้นไม้
const KIND_TH = { flower: 'ดอกไม้', tree: 'ต้นไม้ใหญ่', bush: 'พุ่มไม้' };
const STATUS_FILE = path.join(ROOT, 'status.json');
const GARDEN_FILE = path.join(ROOT, 'garden.json');

const USAGE = `
วิธีใช้: node set-status.js <สถานะ> [ข้อความ] [ชนิดงาน]

  สถานะ:   ${STATUSES.join(' / ')}
  ชนิดงาน: fix (ดอกไม้) / feature (ต้นไม้ใหญ่) / docs (พุ่มไม้)  ← ใช้ตอนสถานะ done

ตัวอย่าง:
  node set-status.js thinking "อืม ขอดูโครงสร้างก่อน"
  node set-status.js coding "กำลังเขียนหน้าล็อกอิน"
  node set-status.js done "เสร็จแล้ว" feature
`;

/* ---------- ช่วยอ่าน/เขียน JSON ---------- */
function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback; // ไฟล์ยังไม่มีหรือพัง → ใช่ค่าเริ่มต้น
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// วันที่แบบเวลาเครื่อง (YYYY-MM-DD) เอาไว้คิดสตรีครายวัน
function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * อัปเดตสถานะน้องส้ม
 * @param {string} status  สถานะจาก STATUSES
 * @param {string} message คำพูดบนฟองเหนือหัว (ภาษาไทย สั้น ๆ)
 * @param {string} [taskType] ชนิดงานตอน done: fix | feature | docs
 * @param {object} [opts]  { plant: false } = ไม่เพิ่มต้นไม้แม้เป็น done (ใช้ตอน demo)
 * @returns {object|null} ต้นไม้ที่ถูกเพิ่ม (ถ้ามี)
 */
function setStatus(status, message = '', taskType, opts = {}) {
  if (!STATUSES.includes(status)) {
    throw new Error(`สถานะไม่ถูกต้อง: "${status}" (ใช้ได้: ${STATUSES.join(', ')})`);
  }

  // 1) เขียนสถานะลง status.json (หน้าเว็บจะอ่านทุก 1 วินาที)
  const now = new Date();
  writeJSON(STATUS_FILE, {
    status,
    message: String(message).trim(),
    updatedAt: now.toISOString(),
  });

  // 2) ถ้าเสร็จงาน → เพิ่มต้นไม้ 1 ต้น + อัปเดตสตรีค
  if (status !== 'done' || opts.plant === false) return null;

  let type = String(taskType || 'feature').toLowerCase();
  if (!KIND_OF[type]) {
    console.warn(`⚠️  ไม่รู้จักชนิดงาน "${taskType}" — จะใช้ feature (ต้นไม้ใหญ่) แทน`);
    type = 'feature';
  }

  const garden = readJSON(GARDEN_FILE, { plants: [], streak: 0, lastDone: null });
  if (!Array.isArray(garden.plants)) garden.plants = [];

  const today = localDate(now);
  const yesterday = localDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  garden.plants.push({ type, kind: KIND_OF[type], date: today, addedAt: now.toISOString() });

  // สตรีครายวัน: ต่อเมื่อวาน = บวก 1, ขาดไปอย่างน้อย 1 วัน = เริ่มใหม่
  if (garden.lastDone === today) {
    // วันเดิม ไม่ต้องบวกเพิ่ม
  } else if (garden.lastDone === yesterday) {
    garden.streak = (Number(garden.streak) || 0) + 1;
  } else {
    garden.streak = 1;
  }
  garden.lastDone = today;

  writeJSON(GARDEN_FILE, garden);
  return garden.plants[garden.plants.length - 1];
}

module.exports = { setStatus, STATUSES, KIND_OF, KIND_TH, localDate, readJSON };

/* =========================================================
   รันตรง ๆ จากคำสั่ง: node set-status.js coding "..."
   ========================================================= */
if (require.main === module) {
  const [status, message = '', taskType] = process.argv.slice(2);

  if (!status || status === 'help' || status === '--help') {
    console.log(USAGE.trim());
    process.exit(status ? 0 : 1);
  }

  try {
    const planted = setStatus(status, message, taskType);
    console.log(`✅ เขียน status.json → ${status}${message ? ` : "${message}"` : ''}`);
    if (planted) {
      const total = readJSON(GARDEN_FILE, { plants: [] }).plants.length;
      console.log(`🌱 เพิ่ม${KIND_TH[planted.kind]}ลงสวนแล้ว (วันนี้ ${planted.date}) — รวม ${total} ต้น`);
    }
  } catch (err) {
    console.error(`❌ ${err.message}`);
    console.log(USAGE.trim());
    process.exit(1);
  }
}
