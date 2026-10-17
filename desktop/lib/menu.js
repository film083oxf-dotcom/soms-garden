'use strict';
/**
 * desktop/lib/menu.js — เมนูคลิกขวาของน้องส้ม
 * แยกออกมาต่างหากเพื่อให้เทสต์หน่วยตรวจป้ายเมนูได้โดยไม่ต้องเปิด GUI
 */
function buildMenuTemplate(handlers) {
  const h = handlers || {};
  const item = (id, label, fn) => ({ id, label, enabled: typeof fn === 'function', click: fn });
  return [
    item('go-window', 'ไปหน้าต่างเอเจนต์', h.goWindow),
    item('open-garden', 'เปิดหน้าสวน', h.openGarden),
    item('quit', 'ปิดน้องส้ม', h.quit),
  ];
}

module.exports = { buildMenuTemplate };
