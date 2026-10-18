'use strict';
/**
 * desktop/lib/config.js — อ่าน soms.config.json (ค่าตั้งส่วนตัว ไม่บังคับ)
 *
 * คีย์ที่รองรับ:
 *   window     — ชื่อหน้าต่างเริ่มต้นให้ --window ของ set-status.js (string)
 *   gardenUrl  — ลิงก์ที่เมนู "เปิดหน้าสวน" จะเปิด (ต้องขึ้นด้วย http:// หรือ https://)
 *   petSize    — ขนาดตัวน้องส้มบนเดสก์ท็อปเป็นพิกเซล (ต้องเป็น 64 คูณจำนวนเต็ม: 64/128/192/256/320/384)
 *                ใช้จำนวนเท่าของ 64 เพื่อให้พิกเซลอาร์ตไม่เบี้ยวเวลาย่อ/ขยาย
 *
 * ไม่มีไฟล์ / JSON พัง / ค่าผิดรูป → ใช้ค่าเริ่มต้นทั้งหมด ห้าม throw
 */
const fs = require('node:fs');

const PET_MIN = 64;
const PET_MAX = 384;
const PET_STEP = 64;

const DEFAULTS = { window: '', gardenUrl: 'http://localhost:3000', petSize: 192 };

/** ขนาดตัวน้องส้มต้องเป็นจำนวนเต็มเท่าของ 64 (ค่าเริ่มต้น 192 = 3×64) */
function normalizePetSize(value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < PET_MIN || value > PET_MAX) return null;
  if (value % PET_STEP !== 0) return null;
  return value;
}

function readConfig(configPath) {
  const out = { window: DEFAULTS.window, gardenUrl: DEFAULTS.gardenUrl, petSize: DEFAULTS.petSize };
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    return out;
  }
  if (!raw || typeof raw !== 'object') return out;
  if (typeof raw.window === 'string' && raw.window.trim()) out.window = raw.window.trim();
  if (typeof raw.gardenUrl === 'string' && /^https?:\/\/\S+$/i.test(raw.gardenUrl.trim())) {
    out.gardenUrl = raw.gardenUrl.trim();
  }
  const size = normalizePetSize(raw.petSize);
  if (size !== null) out.petSize = size;
  return out;
}

module.exports = { readConfig, normalizePetSize, DEFAULTS, PET_MIN, PET_MAX, PET_STEP };
