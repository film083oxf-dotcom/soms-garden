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
const { decodePng, STATUSES, componentsOf, cleanSpecks, SPECK_MIN, CLEANUP_KEEP } =
  require(path.join(ROOT, 'tools', 'pixelate-sprites.js'));
const { readUnit, UNIT, BG } = require(path.join(ROOT, 'tools', 'make-icons.js'));

const UNIT_SCALE = 8;                    // 512 = 64×8
const CREAM = (BG[0] << 16) | (BG[1] << 8) | BG[2];

function colorAt(img, x, y) {
  const i = (y * img.width + x) * 4;
  return { color: (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2], alpha: img.data[i + 3] };
}

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

/** ตาราง 64×64 ของท่าหนึ่ง: ตารางทึบ (1/0) + แมปสี hex รายพิกเซล */
function gridOf(status) {
  const img = decodePng(path.join(ROOT, 'sprites', status + '.png'));
  const unit = img.width / UNIT;
  const opaque = new Uint8Array(UNIT * UNIT);
  const colors = new Map();
  for (let y = 0; y < UNIT; y++) {
    for (let x = 0; x < UNIT; x++) {
      const i = ((y * unit) * img.width + x * unit) * 4;
      if (img.data[i + 3] !== 255) continue;
      opaque[y * UNIT + x] = 1;
      colors.set(y * UNIT + x, hex((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]));
    }
  }
  return { opaque, colors };
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

test('cleanSpecks: ลบเฉพาะกลุ่มเล็กกว่า 3 ที่แยกจากตัวหลัก และเคารพกรอบกัน', () => {
  const size = 16;
  const make = () => {
    const buf = Buffer.alloc(size * size * 4);
    const paint = (x, y) => {
      const o = (y * size + x) * 4;
      buf[o] = 10; buf[o + 1] = 10; buf[o + 2] = 10; buf[o + 3] = 255;
    };
    for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) paint(x, y);   // ตัวหลัก 8×8
    paint(12, 3); paint(12, 4);                                               // กลุ่ม 2px (ต้องลบ)
    paint(12, 12); paint(13, 12); paint(13, 13);                              // กลุ่ม 3px (ต้องเก็บ)
    return buf;
  };

  const noKeep = make();
  assert.equal(cleanSpecks(noKeep, size, null), 2, 'ต้องลบเฉพาะกลุ่ม 2px');
  assert.equal(noKeep[(3 * size + 12) * 4 + 3], 0, 'พิกเซลเศสถูกลบ');
  assert.equal(noKeep[(4 * size + 12) * 4 + 3], 0, 'พิกเซลเศสถูกลบ');
  assert.equal(noKeep[(12 * size + 12) * 4 + 3], 255, 'กลุ่ม 3px ต้องอยู่');
  assert.equal(noKeep[(5 * size + 5) * 4 + 3], 255, 'ตัวหลักต้องอยู่');
  assert.equal(cleanSpecks(noKeep, size, null), 0, 'รันซ้ำรอบสองไม่เหลืออะไรให้ลบ (idempotent)');

  const kept = make();
  assert.equal(cleanSpecks(kept, size, [{ x0: 12, y0: 3, x1: 12, y1: 4 }]), 0, 'อยู่ในกรอบกัน → ไม่ลบ');
  assert.equal(kept[(3 * size + 12) * 4 + 3], 255, 'พิกเซลในกรอบกันยังอยู่');
  assert.equal(kept[(4 * size + 12) * 4 + 3], 255, 'พิกเซลในกรอบกันยังอยู่');
});

test('ไม่มีเศษหลุดรอด: เศษที่แยกจากตัวหลักต้องอยู่ในกรอบกัน องค์ประกอบหลักยังอยู่ครบ', () => {
  const INK = '#4c291f';      // อักขระ Zzz ของ idle
  const BLUE = '#8dd0eb';     // หยดน้ำ coding / น้ำตา error
  const GREEN = '#8db74f';    // ใบไม้/ดอกไม้ด้านล่างของ success

  const counts = {};   // สีในกรอบกัน + สีทั้งภาพ ของแต่ละท่า
  for (const status of STATUSES) {
    const { opaque, colors } = gridOf(status);
    const groups = componentsOf(opaque, UNIT);
    const keep = CLEANUP_KEEP[status] || [];
    const inRect = (p) => keep.some((r) => {
      const x = p % UNIT;
      const y = (p / UNIT) | 0;
      return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
    });

    for (const cells of groups.slice(1)) {                 // 0 = ตัวหลักของท่า
      if (cells.length >= SPECK_MIN) continue;
      assert.ok(cells.some(inRect),
        `${status}: เศษ ${cells.length}px ที่ (${cells[0] % UNIT},${(cells[0] / UNIT) | 0}) ไม่ได้อยู่ในกรอบกันของ CLEANUP_KEEP`);
    }
    for (const rect of keep) {
      const hits = [...colors.keys()].filter((p) => {
        const x = p % UNIT;
        const y = (p / UNIT) | 0;
        return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
      });
      assert.ok(hits.length > 0, `${status}: กรอบกัน (${rect.x0},${rect.y0})-(${rect.x1},${rect.y1}) ไม่มีพิกเซลเลย`);
    }

    counts[status] = { keepColors: new Set(), allColors: new Set(colors.values()) };
    for (const p of colors.keys()) if (inRect(p)) counts[status].keepColors.add(colors.get(p));
  }

  assert.ok(counts.idle.keepColors.has(INK), 'Zzz ของ idle ต้องยังอยู่');
  assert.ok(counts.coding.keepColors.has(BLUE), 'หยดน้ำของ coding ต้องยังอยู่');
  // น้ำตา error ติดกับตัวแมว (ไม่มีกรอบกัน) → เช็กการมีอยู่จากสีทั้งภาพ
  assert.ok(counts.error.allColors.has(BLUE), 'น้ำตาของ error ต้องยังอยู่');
  assert.ok(counts.success.allColors.has(GREEN), 'ใบไม้/ดอกไม้ของ success ต้องยังอยู่');
});

test('กรอบกันไม่เปลืองที่: พื้นที่ห้ามเกิน 4 เท่าขององค์ประกอบลอยที่มันคุ้มจริง', () => {
  const WASTE_LIMIT = 4;
  for (const status of STATUSES) {
    const { opaque } = gridOf(status);
    const floating = new Set(componentsOf(opaque, UNIT).slice(1).flat());   // ทุกกลุ่มที่แยกจากตัวหลัก
    for (const rect of CLEANUP_KEEP[status] || []) {
      const area = (rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1);
      const targets = [...floating].filter((p) => {
        const x = p % UNIT;
        const y = (p / UNIT) | 0;
        return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
      });
      assert.ok(targets.length > 0,
        `${status}: กรอบ (${rect.x0},${rect.y0})-(${rect.x1},${rect.y1}) ไม่ได้คุ้้องค์ประกอบลอยเลย`);
      assert.ok(area <= WASTE_LIMIT * targets.length,
        `${status}: กรอบ (${rect.x0},${rect.y0})-(${rect.x1},${rect.y1}) ${area} เซลล์ คุ้ม ${targets.length}px ` +
        `= ${(area / targets.length).toFixed(1)}x เกิน ${WASTE_LIMIT}x — ต้องหดให้พอดี`);
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
