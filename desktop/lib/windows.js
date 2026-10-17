'use strict';
/**
 * desktop/lib/windows.js — ค้นหา/ดึงหน้าต่างด้วย PowerShell + Win32
 *
 * ความปลอดภัย (ป้องกัน command injection):
 *   ชื่อหน้าต่างถูกส่งเข้า PowerShell เป็น “อาร์กิวเมนต์ตัวเดียว” เสมอ
 *   (execFile ไม่ผ่าน shell → powershell ... -File focus-window.ps1 -WindowTitle <ชื่อ>)
 *   ไม่มีการต่อสตริงคำสั่ง ชื่อมี ; ` $( " ยังไงก็ถูกอ่านเป็นข้อความธรรมดา
 *
 * ตรรกะจับคู่ชื่ออยู่ใน matchWindowTitle() — ฟังก์ชันล้วน ทดสอบได้โดยไม่ต้องมี GUI:
 *   1) ชื่อตรงเป๊ะ (ไม่สนตัวพิมพ์) ก่อน
 *   2) ไม่มี → ชื่อใดก็ได้ที่มีคำนั้นอยู่ข้างใน (ไม่สนตัวพิมพ์)
 */
const path = require('node:path');
const { execFile } = require('node:child_process');

const POWERSHELL = 'powershell.exe';
const SCRIPTS = {
  list: path.join(__dirname, '..', 'powershell', 'list-windows.ps1'),
  focus: path.join(__dirname, '..', 'powershell', 'focus-window.ps1'),
};
const TIMEOUT_MS = 8000;

function isWindows() {
  return process.platform === 'win32';
}

function norm(s) {
  return String(s).trim().toLowerCase();
}

/**
 * จับคู่ชื่อหน้าต่างกับคำค้น (case-insensitive)
 * @param {string[]} titles รายชื่อหน้าต่างที่เปิดอยู่
 * @param {string} target    ชื่อ/คำบางส่วนจาก field `window` ใน status.json
 * @returns {string|null}    ชื่อเต็มของหน้าต่างที่เจอ (ค่าเดิมตามต้นฉบับ) หรือ null
 */
function matchWindowTitle(titles, target) {
  if (typeof target !== 'string' || !Array.isArray(titles)) return null;
  const q = norm(target);
  if (!q) return null;
  const list = titles.filter((t) => typeof t === 'string' && t.trim());
  const exact = list.find((t) => norm(t) === q);
  if (exact) return exact;
  const partial = list.find((t) => norm(t).includes(q));
  return partial || null;
}

/** argv ชุดเดียวกันทุกครั้ง — ไม่มีส่วนไหนมาจากผู้ใช้ (กันการลัดผ่าน -File) */
function baseArgs() {
  return ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File'];
}

function buildListArgs() {
  return baseArgs().concat([SCRIPTS.list]);
}

/**
 * ประกอบ argv สำหรับดึงหน้าต่าง — ชื่อเรียงเป็น argv ตัวสุดท้ายแบบตัวต่อตัว
 * @throws {Error} ชื่อว่าง/ไม่ใช่ string
 */
function buildFocusArgs(windowTitle) {
  if (typeof windowTitle !== 'string' || !windowTitle.trim()) {
    throw new Error('ชื่อหน้าต่างต้องไม่เป็นค่าว่าง');
  }
  return baseArgs().concat([SCRIPTS.focus, '-WindowTitle', windowTitle]);
}

/** JSON array ของชื่อหน้าต่างจาก list-windows.ps1 */
function parseListOutput(stdout) {
  const text = String(stdout == null ? '' : stdout).trim();
  if (!text) throw new Error('powershell ไม่ได้ส่งผลลัพธ์กลับมา');
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('รูปแบบผลลัพธ์ไม่ใช่ array ของชื่อ');
  return data.filter((t) => typeof t === 'string' && t.trim());
}

/** JSON {"found","title","restored","foreground"} จาก focus-window.ps1 */
function parseFocusResult(stdout) {
  const empty = { found: false, title: '', restored: false, foreground: false };
  const text = String(stdout == null ? '' : stdout).trim();
  if (!text) return empty;
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return empty;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return empty;
  return {
    found: data.found === true,
    title: typeof data.title === 'string' ? data.title : '',
    restored: data.restored === true,
    foreground: data.foreground === true,
  };
}

/**
 * รัน PowerShell แบบ argv (ไม่ผ่าน shell) + timeout กันค้าง
 * @returns {Promise<{ok:boolean, code:number|null, stdout:string, error:string|null}>}
 */
function runPowerShell(args) {
  return new Promise((resolve) => {
    if (!isWindows()) {
      resolve({ ok: false, code: null, stdout: '', error: 'รองรับเฉพาะ Windows เท่านั้น' });
      return;
    }
    execFile(
      POWERSHELL,
      args,
      { windowsHide: true, timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        const out = String(stdout || '');
        if (!err) {
          resolve({ ok: true, code: 0, stdout: out, error: null });
          return;
        }
        const numeric = typeof err.code === 'number' ? err.code : null;
        resolve({
          ok: false,
          code: numeric,
          stdout: out,
          error: numeric === null ? err.message : `powershell exit ${numeric}`,
        });
      }
    );
  });
}

/** รายชื่อหน้าต่างที่เปิดอยู่ */
async function listTitles() {
  const res = await runPowerShell(buildListArgs());
  if (!res.ok) return { ok: false, titles: [], error: res.error };
  try {
    return { ok: true, titles: parseListOutput(res.stdout), error: null };
  } catch (err) {
    return { ok: false, titles: [], error: err.message };
  }
}

/**
 * หาหน้าต่างตามชื่อ (จับคู่ใน Node) แล้วสั่ง PowerShell ดึงขึ้นหน้าสุด
 * @returns {Promise<{ok:true, title:string, restored:boolean} |
 *                   {ok:false, reason:'no-target'|'list-failed'|'not-found'|'focus-failed'|'not-brought-to-front', ...}>}
 */
async function findByTitle(target) {
  if (typeof target !== 'string' || !target.trim()) return { ok: false, reason: 'no-target' };

  const listing = await listTitles();
  if (!listing.ok) return { ok: false, reason: 'list-failed', error: listing.error };

  const title = matchWindowTitle(listing.titles, target);
  if (!title) return { ok: false, reason: 'not-found', target: target.trim() };

  const res = await runPowerShell(buildFocusArgs(title));
  const parsed = parseFocusResult(res.stdout);

  if (res.ok && parsed.found && parsed.foreground) {
    return { ok: true, title, restored: parsed.restored };
  }
  if (res.code === 2) {
    // exit 2 จากสคริปต์ = หาชื่อไม่เจอ (หน้าต่างอาจปิดไประหว่างทาง)
    return { ok: false, reason: 'not-found', target: title };
  }
  if (res.code === 3 || parsed.found) {
    return { ok: false, reason: 'not-brought-to-front', target: title };
  }
  return { ok: false, reason: 'focus-failed', error: res.error };
}

module.exports = {
  isWindows,
  matchWindowTitle,
  buildListArgs,
  buildFocusArgs,
  parseListOutput,
  parseFocusResult,
  listTitles,
  findByTitle,
  POWERSHELL,
  SCRIPTS,
};
