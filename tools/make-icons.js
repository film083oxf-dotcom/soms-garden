#!/usr/bin/env node
'use strict';
/**
 * tools/make-icons.js — สร้างไอคอนแอปจากสไปรต์พิกเซลอาร์ต (sprites/idle.png)
 *
 * ต้นทางคือพิกเซลอาร์ต 64×64 (ไฟล์ 512 = 64×8 nearest) จึงขยายด้วย nearest เท่านั้น
 * เพื่อให้เม็ดพิกเซลคมและยังใช้พาเลตต์ชุดเดิม:
 *
 *   favicon-64.png       64×64   พิกเซลอาร์ต 1:1 (พื้นหลังโปร่งใส)
 *   favicon-32.png       32×32   ย่อครั้งละ 2 พิกเซลแบบ nearest (โปร่งใส)
 *   icon-192.png        192×192  พื้นครีม #FFF4E4 + แมว ×3
 *   icon-512.png        512×512  พื้นครีม + แมว ×8
 *   apple-touch-icon.png 180×180 พื้นครีม + แมว ×3 แล้วตัดขอบให้ได้ 180 พอดี
 *
 * ใช้: node tools/make-icons.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { decodePng, encodePng } = require('./pixelate-sprites.js');

const ROOT = path.join(__dirname, '..');
const ICONS = path.join(ROOT, 'icons');
const SOURCE = path.join(ROOT, 'sprites', 'idle.png');
const UNIT = 64;                        // พิกเซลอาร์ตต้นทาง 64×64
const BG = [255, 244, 228];             // #FFF4E4 — สีพื้นเดียวกับ manifest

/** ดึงพิกเซลอาร์ต 64×64 ออกจากไฟล์ 512 (จุดกึ่งกลางของแต่ละบล็อก 8×8) */
function readUnit(img) {
  const factor = img.width / UNIT;
  if (!Number.isInteger(factor)) throw new Error(`sprites/idle.png ต้องเป็น ${UNIT} × จำนวนเต็ม`);
  const out = Buffer.alloc(UNIT * UNIT * 4);
  for (let y = 0; y < UNIT; y++) {
    for (let x = 0; x < UNIT; x++) {
      const sx = x * factor + Math.floor(factor / 2);
      const sy = y * factor + Math.floor(factor / 2);
      const i = (sy * img.width + sx) * 4;
      const o = (y * UNIT + x) * 4;
      out[o] = img.data[i];
      out[o + 1] = img.data[i + 1];
      out[o + 2] = img.data[i + 2];
      out[o + 3] = img.data[i + 3];
    }
  }
  return out;
}

/** ขยาย nearest จากพิกเซลอาร์ต 64×64 → ผืน size×size (โปร่งใส) */
function blit(unit, size, scale, offsetX, offsetY, onBg) {
  const out = onBg ? Buffer.alloc(size * size * 4) : Buffer.alloc(size * size * 4);
  if (onBg) {
    for (let i = 0; i < size * size; i++) {
      out[i * 4] = BG[0];
      out[i * 4 + 1] = BG[1];
      out[i * 4 + 2] = BG[2];
      out[i * 4 + 3] = 255;
    }
  }
  for (let y = 0; y < UNIT; y++) {
    for (let x = 0; x < UNIT; x++) {
      const a = unit[(y * UNIT + x) * 4 + 3];
      if (!a) continue;
      for (let dy = 0; dy < scale; dy++) {
        const py = offsetY + y * scale + dy;
        if (py < 0 || py >= size) continue;
        for (let dx = 0; dx < scale; dx++) {
          const px = offsetX + x * scale + dx;
          if (px < 0 || px >= size) continue;
          const o = (py * size + px) * 4;
          out[o] = unit[(y * UNIT + x) * 4];
          out[o + 1] = unit[(y * UNIT + x) * 4 + 1];
          out[o + 2] = unit[(y * UNIT + x) * 4 + 2];
          out[o + 3] = 255;
        }
      }
    }
  }
  return out;
}

/** ย่อครั้งละ 2 พิกเซลแบบ nearest (เก็บความคมของพิกเซลอาร์ต) */
function halve(unit) {
  const size = UNIT / 2;
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = ((y * 2) * UNIT + x * 2) * 4;
      const o = (y * size + x) * 4;
      out[o] = unit[s];
      out[o + 1] = unit[s + 1];
      out[o + 2] = unit[s + 2];
      out[o + 3] = unit[s + 3];
    }
  }
  return out;
}

function main() {
  if (!fs.existsSync(SOURCE)) throw new Error('ไม่พบ ' + SOURCE);
  fs.mkdirSync(ICONS, { recursive: true });
  const unit = readUnit(decodePng(SOURCE));

  const write = (name, size, rgba) => {
    fs.writeFileSync(path.join(ICONS, name), encodePng(size, size, rgba));
    console.log(`✅ icons/${name} — ${size}×${size}`);
  };

  write('favicon-64.png', 64, blit(unit, 64, 1, 0, 0, false));
  write('favicon-32.png', 32, halve(unit));

  write('icon-192.png', 192, blit(unit, 192, 3, 0, 0, true));
  write('icon-512.png', 512, blit(unit, 512, 8, 0, 0, true));

  // 180 = แมว ×3 (192) แล้วตัดขอบออกข้างละ 6 พิกเซล ให้ได้ 180 พอดี
  const big = blit(unit, 192, 3, 0, 0, true);
  const cut = Buffer.alloc(180 * 180 * 4);
  for (let y = 0; y < 180; y++) {
    big.copy(cut, y * 180 * 4, ((y + 6) * 192 + 6) * 4, ((y + 6) * 192 + 6) * 4 + 180 * 4);
  }
  write('apple-touch-icon.png', 180, cut);

  console.log('🎉 ไอคอนทั้งหมดสร้างจาก sprites/idle.png (พิกเซลอาร์ต ' + UNIT + '×' + UNIT + ')');
}

if (require.main === module) main();

module.exports = { readUnit, blit, halve, UNIT, BG };
