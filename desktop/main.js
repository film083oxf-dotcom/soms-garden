'use strict';
/**
 * main.js — หน้าต่างน้องส้มแบบ desktop pet (Electron · Windows)
 *
 * - โปร่งใส ไร้กรอบ เต็ม workArea ของจอหลัก (ไม่รวม taskbar) อยู่บนสุด ไม่ขึ้น taskbar
 * - คลิกทะลุทั้งหน้าต่าง (setIgnoreMouseEvents + forward) ยกเว้นตัวน้องส้มกับฟองคำพูด
 *   renderer จะบอกผ่าน IPC ว่าเมาส์อยู่บนตัวน้องหรือไม่ → สลับรับ/ไม่รับเมาส์ตรงนั้น
 * - อ่าน ../status.json ทุก 1 วินาที ด้วยกติกาเดียวกับหน้าเว็บ (lib/status.js)
 * - คลิกน้องส้ม = ดึงหน้าต่างเอเจนต์จาก field `window` ขึ้นมา (lib/windows.js + PowerShell)
 *
 * โหมดทดสอบ: SOM_SMOKE=1 → รอ renderer ทัก + status อย่างน้อย 2 รอบ
 * แล้วพิมพ์ผลเป็น JSON บรรทัดเดียวแล้วปิดตัวเอง (ใช้ตรวจในเครื่องที่ไม่มีคนจับเมาส์)
 */
const { app, BrowserWindow, Menu, ipcMain, screen, shell } = require('electron');
const path = require('node:path');

const { readStatus, POLL_MS } = require('./lib/status');
const { findByTitle } = require('./lib/windows');
const { buildMenuTemplate } = require('./lib/menu');
const { readConfig } = require('./lib/config');

const SMOKE = process.env.SOM_SMOKE === '1';
const ROOT = path.join(__dirname, '..');
const CONFIG = readConfig(path.join(ROOT, 'soms.config.json'));
const STATUS_FILE = path.join(ROOT, 'status.json');

let win = null;
let state = null;      // สถานะล่าสุดที่ส่งให้ renderer (เก็บไว้ใช้ตอนคลิก)
let lastSig = '';      // กันส่งซ้ำเมื่อ status.json ไม่เปลี่ยน
let ticks = 0;         // จำนวนรอบอ่านสถานะ (สำหรับ smoke)
let helloInfo = null;  // ข้อมูลที่ renderer ทักมาครั้งแรก (สำหรับ smoke)

function smokeLog(msg) {
  if (SMOKE) console.log('[som-smoke] ' + msg);
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function createWindow() {
  const area = screen.getPrimaryDisplay().workArea;   // workArea = พื้นที่ทำงานไม่รวม taskbar
  win = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,          // ไม่แย่งโฟกัสจากแอปที่ผู้ใช้กำลังพิมพ์อยู่
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    title: "Som's Garden",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });   // ทะลุหมดก่อน — renderer เปิดรับเฉพาะตอนชี้ที่ตัวน้อง
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.showInactive()); // เปิดแบบไม่กระโดดทับแอปอื่น

  // renderer เพิ่งโหลดเสร็จ → ส่งสถานะปัจจุบันให้ทันที (ไม่งั้นจะค้างท่า idle
  // เพราะ tick ตัวแรกเกิดก่อนที่หน้าจะโหลดและ "ส่งเฉพาะตอนเปลี่ยน" อยู่)
  win.webContents.on('did-finish-load', () => {
    lastSig = '';
    tick();
  });

  if (SMOKE) {
    win.webContents.on('console-message', (_e, _l, msg) => smokeLog('renderer: ' + msg));
  }
}

/** อ่านสถานะ 1 รอบ — ไฟล์หายชั่วคราว → คงสถานะเดิม (หน้าเว็บก็คงไว้เช่นกัน) */
function tick() {
  ticks += 1;
  const s = readStatus(STATUS_FILE);
  if (s.error && state) return;
  state = s;
  const sig = JSON.stringify(s);
  if (sig !== lastSig) {
    lastSig = sig;
    send('som:status', s);
  }
  maybeFinishSmoke();
}

/**
 * หาหน้าต่างที่ชื่อตรงกับ field `window` แล้วดึงขึ้นหน้าสุด
 * ไม่ว่าจะล้มเหลวแบบไหนก็คืนข้อความสั้น ๆ ห้าม throw ออกไปให้ renderer
 */
async function focusAgentWindow() {
  const target = state ? state.window : null;
  if (!target) return { ok: false, message: 'ยังไม่ได้ตั้งชื่อหน้าต่าง (--window)' };

  const r = await findByTitle(target);
  if (r.ok) return { ok: true, message: 'ดึงหน้าต่างขึ้นมาแล้ว 🪟' };
  if (r.reason === 'not-found') return { ok: false, message: 'ไม่เจอหน้าต่าง "' + target + '" นะ' };
  smokeLog('focus failed: ' + JSON.stringify(r));
  return { ok: false, message: 'ดึงหน้าต่างขึ้นไม่ได้ 😿' };
}

function maybeFinishSmoke() {
  if (!SMOKE || !helloInfo || ticks < 2 || !win) return;
  smokeLog(
    'result=' +
      JSON.stringify({
        hello: helloInfo,
        ticks,
        bounds: win.getBounds(),
        ignoreMouse: true,
        status: state,
      })
  );
  setTimeout(() => app.exit(0), 250);
}

/* ================= IPC จาก renderer ================= */
ipcMain.on('som:set-interactive', (_e, on) => {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!on, { forward: true });
});

ipcMain.on('som:hello', (_e, info) => {
  helloInfo = info || {};
  maybeFinishSmoke();
});

ipcMain.handle('som:focus-window', async () => {
  try {
    return await focusAgentWindow();
  } catch (err) {
    smokeLog('focus error: ' + err.message);
    return { ok: false, message: 'ดึงหน้าต่างขึ้นไม่ได้ 😿' };
  }
});

ipcMain.on('som:show-menu', (_e, pos) => {
  if (!win || win.isDestroyed()) return;
  const menu = Menu.buildFromTemplate(
    buildMenuTemplate({
      goWindow: () => {
        focusAgentWindow()
          .then((r) => send('som:toast', r))
          .catch(() => {});
      },
      openGarden: () => {
        shell.openExternal(CONFIG.gardenUrl).catch(() => {});
      },
      quit: () => app.quit(),
    })
  );
  win.setFocusable(true);   // เมนูต้องรับโฟกัสชั่วคราว พอปิดเมนูคืนเป็น false
  menu.popup({
    window: win,
    x: Number.isFinite(pos && pos.x) ? Math.round(pos.x) : undefined,
    y: Number.isFinite(pos && pos.y) ? Math.round(pos.y) : undefined,
    callback: () => {
      if (win && !win.isDestroyed()) win.setFocusable(false);
    },
  });
});

/* ================= ชีวิตแอป ================= */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    /* มีอีกตัวเปิดอยู่ → ตัวแรกทำงานอยู่แล้ว ไม่ต้องทำอะไร */
  });

  app.whenReady().then(() => {
    createWindow();
    tick();
    setInterval(tick, POLL_MS);
    if (SMOKE) {
      setTimeout(() => {
        smokeLog('timeout result=' + JSON.stringify({ hello: helloInfo, ticks }));
        app.exit(1);
      }, 20000);
    }
  });

  app.on('window-all-closed', () => app.quit());
}
