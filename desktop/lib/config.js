'use strict';
/**
 * desktop/lib/config.js — อ่าน soms.config.json (ค่าตั้งส่วนตัว ไม่บังคับ)
 *
 * คีย์ที่รองรับ:
 *   window     — ชื่อหน้าต่างเริ่มต้นให้ --window ของ set-status.js (string)
 *   gardenUrl  — ลิงก์ที่เมนู "เปิดหน่าังสวน" จะเปิด (ต้องขึ้นด้วย http:// หรือ https://)
 *
 * ไม่มีไฟล์ / JSON พัง / ค่าผิดรูป → ใช้ค่าเริ่มต้นทั้งหมด ห้าม throw
 */
const fs = require('node:fs');

const DEFAULTS = { window: '', gardenUrl: 'http://localhost:3000' };

function readConfig(configPath) {
  const out = { window: DEFAULTS.window, gardenUrl: DEFAULTS.gardenUrl };
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
  return out;
}

module.exports = { readConfig, DEFAULTS };
