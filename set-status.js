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
 *   node set-status.js coding "รันเทสต์ยาว" --ttl=45   ← 45 นาทีค่อยหลับ
 *   node set-status.js coding "เขียนโค้ด" --window "Codex"  ← ผูกกับหน้าต่าง (desktop pet กระโดดไปหา)
 *   node set-status.js --list-windows      ← ดูรายชื่อหน้าต่างที่เปิดอยู่ (Windows)
 *
 * สถานะที่รองรับ: thinking / coding / success / error / done / idle
 * - ทุกครั้งที่เป็น done จะเพิ่มต้นไม้ 1 ต้นลง garden.json พร้อมวันที่
 * - ถ้าไม่อัปเดตเกิน ttlMinutes (ค่าเริ่มต้น 10 นาที) หน้าเว็บจะสลับเป็น idle ให้เอง
 */

const fs = require('node:fs');
const path = require('node:path');

const { listTitles, isWindows } = require('./desktop/lib/windows.js');
const { readConfig } = require('./desktop/lib/config.js');

const ROOT = __dirname;
const STATUSES = ['thinking', 'coding', 'success', 'error', 'done', 'idle'];
const KIND_OF = { fix: 'flower', feature: 'tree', docs: 'bush' }; // ชนิดงาน → ชนิดต้นไม้
const KIND_TH = { flower: 'ดอกไม้', tree: 'ต้นไม้ใหญ่', bush: 'พุ่มไม้' };
const STATUS_FILE = path.join(ROOT, 'status.json');
const GARDEN_FILE = path.join(ROOT, 'garden.json');

const USAGE = `
วิธีใช้: node set-status.js <สถานะ> [ข้อความ] [ชนิดงาน] [--ttl=<นาที>] [--window="<ชื่อหน้าต่าง>"]

  สถานะ:    ${STATUSES.join(' / ')}
  ชนิดงาน:  fix (ดอกไม้) / feature (ต้นไม้ใหญ่) / docs (พุ่มไม้)  ← ใช้ตอนสถานะ done
  --ttl:    เงียบเกินกี่นาทีให้ถือว่าหลับ (1–1440, ค่าเริ่มต้น 10)
  --window: ชื่อหน้าต่างของเอเจนต์ตัวนี้ (ไม่สนตัวพิมพ์ ใส่บางส่วนก็ได้)
            ให้น้องส้ม desktop pet กระโดดไปหน้าต่างนั้นเมื่อถูกคลิก
            ไม่ระบุ → อ่านค่าเริ่มต้นจาก soms.config.json (คีย์ window)

  node set-status.js --list-windows   ดูรายชื่อหน้าต่างที่เปิดอยู่ (ใช้ได้เฉพาะ Windows)

ตัวอย่าง:
  node set-status.js thinking "อืม ขอดูโครงสร้างก่อน"
  node set-status.js coding "กำลังเขียนหน้าล็อกอิน"
  node set-status.js coding "รันเทสต์ชุดใหญ่" --ttl=45
  node set-status.js done "เสร็จแล้ว" feature
  node set-status.js coding "เขียนโค้ดต่อ" --window "Codex"
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

// วันก่อนหน้าแบบปฏิทินเวลาเครื่อง (ไม่ใช่ "ลบ 24 ชั่วโมง" ที่อาจเพี้ยนข้าม DST/ข้ามวัน)
function localDateBefore(d, days = 1) {
  return localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - days));
}

/**
 * อัปเดตสถานะน้องส้ม
 * @param {string} status  สถานะจาก STATUSES
 * @param {string} message คำพูดบนฟองเหนือหัว (ภาษาไทย สั้น ๆ)
 * @param {string} [taskType] ชนิดงานตอน done: fix | feature | docs
/**
 * แปลงค่า ttlMinutes ที่รับมาให้อยู่ในช่วง 1–1440 นาที
 * @returns {number|null} null = ไม่ได้ระบุ/ไม่ถูกต้อง (ใช้ค่าเริ่มต้นของหน้าเว็บ)
 */
function normalizeTTL(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.max(Math.round(n), 1), 24 * 60);
}

/**
 * อัปเดตสถานะน้องส้ม
 * @param {string} status  สถานะจาก STATUSES
 * @param {string} message คำพูดบนฟองเหนือหัว (ภาษาไทย สั้น ๆ)
 * @param {string} [taskType] ชนิดงานตอน done: fix | feature | docs
 * @param {object} [opts]  { plant: false } = ไม่เพิ่มต้นไม้แม้เป็น done (ใช้ตอน demo)
 *                         { ttlMinutes } = เงียบกี่นาทีถือว่าหลับ
 *                         { window } = ชื่อหน้าต่างเอเจนต์ (ให้ desktop pet กระโดดไปหาเมื่อคลิก)
 *                         { statusFile, gardenFile } = เปลี่ยนที่เขียนไฟล์ (ใช้ในเทสต์)
 *                         { now } = เวลาที่ใช้คิดวัน/สตรีค (ใช้ในเทสต์; ค่าเริ่มต้น = เวลาจริง)
 * @returns {object|null} ต้นไม้ที่ถูกเพิ่ม (ถ้ามี)
 */
function setStatus(status, message = '', taskType, opts = {}) {
  if (!STATUSES.includes(status)) {
    throw new Error(`สถานะไม่ถูกต้อง: "${status}" (ใช้ได้: ${STATUSES.join(', ')})`);
  }

  const statusFile = opts.statusFile || STATUS_FILE;
  const gardenFile = opts.gardenFile || GARDEN_FILE;

  // 1) เขียนสถานะลง status.json (หน้าเว็บจะอ่านทุก 1 วินาที)
  //    วันที่/สตรีคคิดจากปฏิทินเวลาเครื่องเสมอ — ไม่ใช่ UTC (จึงไม่เปลี่ยนวันตอน 07:00 เวลาไทย)
  const now = opts.now instanceof Date ? opts.now : new Date();
  const record = {
    status,
    message: String(message).trim(),
    updatedAt: now.toISOString(),
  };
  const ttlMinutes = normalizeTTL(opts.ttlMinutes);
  if (ttlMinutes) record.ttlMinutes = ttlMinutes;
  const windowName = opts.window && String(opts.window).trim();
  if (windowName) record.window = windowName;   // field เสริมให้ desktop pet (หน้าเว็บเดิมไม่กระทบ)
  writeJSON(statusFile, record);

  // 2) ถ้าเสร็จงาน → เพิ่มต้นไม้ 1 ต้น + อัปเดตสตรีค
  if (status !== 'done' || opts.plant === false) return null;

  let type = String(taskType || 'feature').toLowerCase();
  if (!KIND_OF[type]) {
    console.warn(`⚠️  ไม่รู้จักชนิดงาน "${taskType}" — จะใช้ feature (ต้นไม้ใหญ่) แทน`);
    type = 'feature';
  }

  const garden = readJSON(gardenFile, { plants: [], streak: 0, lastDone: null });
  if (!Array.isArray(garden.plants)) garden.plants = [];

  const today = localDate(now);
  const yesterday = localDateBefore(now, 1);

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

  writeJSON(gardenFile, garden);
  return garden.plants[garden.plants.length - 1];
}

module.exports = {
  setStatus, normalizeTTL, STATUSES, KIND_OF, KIND_TH, localDate, localDateBefore, readJSON, writeJSON,
};

/**
 * --list-windows: แสดงรายชื่อหน้าต่างที่เปิดอยู่ (ใช้ PowerShell ของ Windows)
 * @returns {Promise<boolean>} true = สำเร็จ
 */
async function listOpenWindows() {
  if (!isWindows()) {
    console.error('❌ --list-windows ใช้ได้เฉพาะ Windows เท่านั้น');
    return false;
  }
  const res = await listTitles();
  if (!res.ok) {
    console.error(`❌ อ่านรายชื่อหน้าต่างไม่สำเร็จ: ${res.error}`);
    return false;
  }
  if (!res.titles.length) {
    console.log('ไม่พบหน้าต่างที่เปิดอยู่');
    return true;
  }
  console.log('🪟 หน้าต่างที่เปิดอยู่ (เอาชื่อไปใส่ --window "..." ได้ ไม่สนตัวพิมพ์ ใส่บางส่วนก็ได้):');
  res.titles.forEach((title, i) => console.log(`  ${i + 1}. ${title}`));
  return true;
}

/* =========================================================
   รันตรง ๆ จากคำสั่ง: node set-status.js coding "..."
   ========================================================= */
if (require.main === module) {
  const rawArgs = process.argv.slice(2);
  const argv = [];
  let ttlRaw = null;
  let windowRaw = null;
  let listWindows = false;
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '--ttl') ttlRaw = rawArgs[++i];
    else if (a.startsWith('--ttl=')) ttlRaw = a.slice('--ttl='.length);
    else if (a === '--window') windowRaw = rawArgs[++i];
    else if (a.startsWith('--window=')) windowRaw = a.slice('--window='.length);
    else if (a === '--list-windows') listWindows = true;
    else argv.push(a);
  }

  if (listWindows) {
    // แสดงหน้าต่างที่เปิดอยู่ แล้วจบ (ไม่ต้องมีสถานะ)
    listOpenWindows().then((ok) => {
      process.exitCode = ok ? 0 : 1;
    });
  } else {
    const [status, message = '', taskType] = argv;

    if (!status || status === 'help' || status === '--help') {
      console.log(USAGE.trim());
      process.exit(status ? 0 : 1);
    }

    // ชื่อหน้าต่าง: --window มาก่อน ไม่ระบุค่อยอ่านค่าเริ่มต้นจาก soms.config.json
    const windowName = windowRaw !== null
      ? String(windowRaw)
      : readConfig(path.join(ROOT, 'soms.config.json')).window;

    try {
      const planted = setStatus(status, message, taskType, { ttlMinutes: ttlRaw, window: windowName });
      console.log(`✅ เขียน status.json → ${status}${message ? ` : "${message}"` : ''}`);
      const ttl = normalizeTTL(ttlRaw);
      if (ttl) console.log(`⌛ เงียบเกิน ${ttl} นาที = น้องส้มจะหลับเอง`);
      else if (ttlRaw !== null) console.warn(`⚠️  --ttl "${ttlRaw}" ใช้ไม่ได้ (ต้องเป็น 1–1440 นาที) — ใช้ค่าเริ่มต้น 10 นาที`);
      const windowShown = windowName && String(windowName).trim();
      if (windowShown) console.log(`🪟 ผูกกับหน้าต่าง "${windowShown}" — คลิกน้องส้มเดสก์ท็อป = กระโดดไปที่นั่น`);
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
}
