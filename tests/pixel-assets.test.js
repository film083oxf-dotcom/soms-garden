'use strict';
/**
 * tests/pixel-assets.test.js — ตรวจว่าของที่ "เจนออกมา" ยังเป็นพิกเซลอาร์ตชุดเดียวกัน
 *
 *  - sprites/*.png ยังเป็น 512 (64×64 ×8) alpha 0/255 และใช้ 24 สีร่วมกัน
 *  - icons/*.png สร้างจาก sprites/idle.png ด้วย nearest (/3 → 192, ×8 → 512) ขอบตรงเม็ดพิกเซล
 *    และ favicon 32 ย่อครั้งละ 2 พิกเซลจากชุดเดียวกัน
 *
 * รัน: node --test "tests/*.test.js"
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { decodePng, STATUSES } = require(path.join(ROOT, 'tools', 'pixelate-sprites.js'));
const { readUnit, UNIT, BG } = require(path.join(ROOT, 'tools', 'make-icons.js'));

const UNIT_SCALE = 8;                    // 512 = 64×8
const CREAM = (BG[0] << 16) | (BG[1] << 8) | BG[2];

function colorAt(img, x, y) {
  const i = (y * img.width + x) * 4;
  return { color: (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2], alpha: img.data[i + 3] };
}

function palette() {
  const set = new Set();
  for (const status of STATUSES) {
    const img = decodePng(path.join(ROOT, 'sprites', status + '.png'));
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3]) set.add((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]);
    }
  }
  return set;
}

test('sprites/*.png ทั้ง 6 ท่าเป็นพิกเซลอาร์ต 512 (64×8) alpha 0/255 ด้วยพาเลตต์ 24 สีร่วม', () => {
  const pal = palette();
  assert.equal(pal.size, 24, 'พาเลตต์ร่วมต้องมี 24 สี');
  for (const status of STATUSES) {
    const img = decodePng(path.join(ROOT, 'sprites', status + '.png'));
    assert.equal(img.width, UNIT * UNIT_SCALE, status + ' กว้าง 512');
    assert.equal(img.height, UNIT * UNIT_SCALE, status + ' สูง 512');
    for (let y = 0; y < UNIT; y++) {
      for (let x = 0; x < UNIT; x++) {
        // เม็ดพิกเซลต้องเป็นบล็อก 8×8 สีเดียวกัน (ขยาย nearest ไม่ใช่ interpolate)
        const first = colorAt(img, x * UNIT_SCALE, y * UNIT_SCALE);
        for (let dy = 1; dy < UNIT_SCALE; dy++) {
          assert.equal(colorAt(img, x * UNIT_SCALE, y * UNIT_SCALE + dy).color, first.color, status + ' ไม่ใช่ nearest');
        }
        if (first.alpha === 0) continue;
        assert.equal(first.alpha, 255, status + ' alpha ต้องเป็น 0/255');
        assert.ok(pal.has(first.color), status + ' สีต้องอยู่ในพาเลตต์ร่วม');
      }
    }
  }
});

test('favicon สร้างจากพิกเซลอาร์ตชุดเดิม พื้นหลังโปร่งใส', () => {
  const unit = readUnit(decodePng(path.join(ROOT, 'sprites', 'idle.png')));
  const fav64 = decodePng(path.join(ROOT, 'icons', 'favicon-64.png'));
  assert.equal(fav64.width, UNIT);

  const fav32 = decodePng(path.join(ROOT, 'icons', 'favicon-32.png'));
  assert.equal(fav32.width, UNIT / 2);

  for (let y = 0; y < UNIT; y++) {
    for (let x = 0; x < UNIT; x++) {
      assert.equal(colorAt(fav64, x, y).color, (unit[(y * UNIT + x) * 4] << 16) | (unit[(y * UNIT + x) * 4 + 1] << 8) | unit[(y * UNIT + x) * 4 + 2], 'favicon-64 ต้องตรงกับ idle');
      assert.equal(colorAt(fav64, x, y).alpha, unit[(y * UNIT + x) * 4 + 3], 'favicon-64 alpha ตรงกับ idle');
    }
  }
  // favicon-32 = เก็บครั้งละ 2 พิกเซลจากชุดเดียวกัน
  for (let y = 0; y < UNIT / 2; y++) {
    for (let x = 0; x < UNIT / 2; x++) {
      const src = ((y * 2) * UNIT + x * 2) * 4;
      const want = (unit[src] << 16) | (unit[src + 1] << 8) | unit[src + 2];
      assert.equal(colorAt(fav32, x, y).color, want, 'favicon-32 ต้องเป็น nearest จาก idle');
      assert.equal(colorAt(fav32, x, y).alpha, unit[src + 3]);
    }
  }
  assert.equal(colorAt(fav32, 0, 0).alpha, 0, 'มุม favicon โปร่งใส');
});

test('icon-192 / icon-512 / apple-touch: พื้นครีม + แมวขยาย nearest เป็นจำนวนเท่าของ 64', () => {
  const pal = palette();
  const fav64 = decodePng(path.join(ROOT, 'icons', 'favicon-64.png'));

  const cases = [
    { file: 'icon-192.png', size: 192, scale: 3, offset: 0 },
    { file: 'icon-512.png', size: 512, scale: 8, offset: 0 },
    { file: 'apple-touch-icon.png', size: 180, scale: 3, offset: -6 },   // ×3 แล้วตัดขอบข้างละ 6
  ];

  for (const { file, size, scale, offset } of cases) {
    const img = decodePng(path.join(ROOT, 'icons', file));
    assert.equal(img.width, size, file + ' กว้าง ' + size);
    assert.equal(img.height, size, file + ' สูง ' + size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const { color, alpha } = colorAt(img, x, y);
        assert.equal(alpha, 255, file + ' ต้องทึบทั้งภาพ (พื้นครีมเต็มผืน)');
        const ux = Math.floor((x - offset) / scale);
        const uy = Math.floor((y - offset) / scale);
        if (ux < 0 || uy < 0 || ux >= UNIT || uy >= UNIT) {
          assert.equal(color, CREAM, file + ' ขอบนอกต้องเป็นสีพื้น');
          continue;
        }
        const src = (uy * UNIT + ux) * 4;
        const expect = fav64.data[src + 3] ? (fav64.data[src] << 16) | (fav64.data[src + 1] << 8) | fav64.data[src + 2] : CREAM;
        assert.equal(color, expect, `${file} ที่ (${x},${y}) ต้องเป็นพิกเซลอาร์ต ×${scale}`);
        if (expect !== CREAM) assert.ok(pal.has(expect), file + ' สีต้องอยู่ในพาเลตต์ 24 สี');
      }
    }
  }
});
