'use strict';
/**
 * preload.js — สะพานเดียวระหว่าง renderer กับ main
 * (contextIsolation เปิดอยู่ renderer จึงไม่แตะ Node/Electron ตรง ๆ)
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('som', {
  /** รับสถานะใหม่จาก main (อ่าน status.json ทุก 1 วินาที) */
  onStatus(cb) {
    ipcRenderer.on('som:status', (_e, s) => {
      if (typeof cb === 'function') cb(s);
    });
  },
  /** ข้อความตอบกลับจากการคลิกน้องส้ม (เช่น ไม่เจอหน้าต่าง) */
  onToast(cb) {
    ipcRenderer.on('som:toast', (_e, t) => {
      if (typeof cb === 'function') cb(t);
    });
  },
  /** true = เมาส์อยู่บนตัวน้อง/ฟอง → ให้รับคลิก; false = ทะลุต่อ */
  setInteractive(on) {
    ipcRenderer.send('som:set-interactive', !!on);
  },
  /** ค้นหา+ดึงหน้าต่างเอเจนต์ตาม field window ใน status.json */
  focusAgentWindow() {
    return ipcRenderer.invoke('som:focus-window');
  },
  /** เปิดเมนูคลิกขวา (พิกัดในหน้าต่าง) */
  showMenu(x, y) {
    ipcRenderer.send('som:show-menu', { x, y });
  },
  /** ทักทาย main ครั้งแรก (ใช้ตรวจในโหมด smoke) */
  hello(info) {
    ipcRenderer.send('som:hello', info);
  },
});
