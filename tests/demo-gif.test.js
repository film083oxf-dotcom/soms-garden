'use strict';
/**
 * tests/demo-gif.test.js — ตรวจ docs/demo.gif ที่ฝังใน README
 *
 *  - ถอด GIF ด้วยโค้ดของโปรเจกต์เอง (tools/gif-decode.js · ไม่มี dependency)
 *  - ทุกเฟรมต้องเป็นสไปรต์ 64×64 ขยาย nearest ×16 → 1024×1024: ทุกบล็อก 16×16 ต้องสีเดียว
 *  - สีทุกสีต้องอยู่ในพาเลตต์พิกเซลของสไปรต์ (24 สี) รวมสีพื้นครีม #FFF4E4
 *  - เรียงท่า thinking → coding → success → error → done → idle ท่าละ 1.2 วินาที
 *
 * ไม่ต้องมี PhotoCraft/FilmCraft ติดตั้ง — อ่านเฉพาะไฟล์ที่ commit ไว้
 * รัน: node --test "tests/*.test.js"
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { decodePng } = require(path.join(ROOT, 'tools', 'pixelate-sprites.js'));
const { UNIT, BG } = require(path.join(ROOT, 'tools', 'make-icons.js'));
const { decodeGif } = require(path.join(ROOT, 'tools', 'gif-decode.js'));

const GIF = path.join(ROOT, 'docs', 'demo.gif');
const POSES = ['thinking', 'coding', 'success', 'error', 'done', 'idle'];
const FRAMES_PER_POSE = 12;             // 12 × 100 ms = 1.2 วิ ต่อท่า
const CANVAS = 1024;                    // 64 × 16
const SCALE = CANVAS / UNIT;            // = 16
const CREAM = (BG[0] << 16) | (BG[1] << 8) | BG[2];
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

/** ตารางสี 64×64 ของสไปรต์หนึ่งท่า (null = โปร่งใส → เห็นพื้นครีม) */
function spriteGrid(status) {
  const img = decodePng(path.join(ROOT, 'sprites', status + '.png'));
  const step = img.width / UNIT;
  const grid = new Array(UNIT * UNIT).fill(null);
  for (let y = 0; y < UNIT; y++) {
    for (let x = 0; x < UNIT; x++) {
      const i = ((y * step) * img.width + x * step) * 4;
      if (img.data[i + 3] === 0) continue;
      grid[y * UNIT + x] = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
    }
  }
  return grid;
}

function spritePalette() {
  const set = new Set();
  for (const pose of POSES) {
    const img = decodePng(path.join(ROOT, 'sprites', pose + '.png'));
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3]) set.add((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]);
    }
  }
  return set;
}

const grids = POSES.map(spriteGrid);
const palette = spritePalette();

test('docs/demo.gif: 72 เฟรม 1024×1024 · ท่าละ 12 เฟรม × 100 ms เรียงตามลำดับท่า', (t) => {
  assert.ok(fs.existsSync(GIF), 'ต้องมี docs/demo.gif');

  const frames = [];
  const info = decodeGif(fs.readFileSync(GIF), { onFrame: (f) => frames.push({
    index: f.index, width: f.width, height: f.height, delayMs: f.delayMs, rgba: f.rgba,
  }) });

  assert.equal(info.width, CANVAS, 'canvas กว้าง ' + CANVAS);
  assert.equal(info.height, CANVAS, 'canvas สูง ' + CANVAS);
  assert.equal(frames.length, POSES.length * FRAMES_PER_POSE, 'จำนวนเฟรมรวม');

  const totalMs = frames.reduce((a, f) => a + f.delayMs * 10, 0);
  for (const f of frames) {
    assert.equal(f.width, CANVAS, 'เฟรม ' + f.index + ' กว้าง ' + CANVAS);
    assert.equal(f.height, CANVAS, 'เฟรม ' + f.index + ' สูง ' + CANVAS);
    assert.equal(f.delayMs, 10, 'เฟรม ' + f.index + ' ต้องหน่วง 100 ms');
  }

  t.diagnostic(`เฟรม ${frames.length} · ${CANVAS}×${CANVAS} · ${totalMs / 1000} วิ · ${(fs.statSync(GIF).size / 1048576).toFixed(2)} MB`);
});

test('ทุกเฟรมเป็นบล็อก 16×16 สีเดียว ตรงกับสไปรต์ที่ขยาย nearest (ไม่เบลอ ไม่เพี้ยนสี)', (t) => {
  let frames = 0;
  let blocks = 0;
  let pixels = 0;
  let mismatches = 0;
  const firstMismatch = [];
  const seenColors = new Set([CREAM]);
  const colorsPerFrame = [];

  decodeGif(fs.readFileSync(GIF), {
    onFrame: (f) => {
      frames++;
      const pose = Math.floor(f.index / FRAMES_PER_POSE);
      const grid = grids[pose];
      const d = f.rgba;
      const local = new Set();

      for (let by = 0; by < UNIT; by++) {
        for (let bx = 0; bx < UNIT; bx++) {
          const want = grid[by * UNIT + bx] === null ? CREAM : grid[by * UNIT + bx];
          blocks++;
          local.add(want);
          seenColors.add(want);

          // ตรวจทุกพิกเซลในบล็อก 16×16 ว่าสีเดียวกันกับ pixel ต้นแบบ
          for (let y = 0; y < SCALE; y++) {
            let o = ((by * SCALE + y) * CANVAS + bx * SCALE) * 4;
            for (let x = 0; x < SCALE; x++, o += 4) {
              pixels++;
              const got = (d[o] << 16) | (d[o + 1] << 8) | d[o + 2];
              if (got !== want || d[o + 3] !== 255) {
                mismatches++;
                if (firstMismatch.length < 5) {
                  firstMismatch.push(`เฟรม ${f.index} (${POSES[pose]}) ที่ (${bx * SCALE + x},${by * SCALE + y}): ` +
                    `${hex(got)} ≠ ${hex(want)}${d[o + 3] !== 255 ? ' alpha=' + d[o + 3] : ''}`);
                }
              }
            }
          }
        }
      }
      colorsPerFrame.push(local.size);
    },
  });

  assert.equal(mismatches, 0, 'พิกเซลไม่ตรงกับ nearest upscale:\n  ' + firstMismatch.join('\n  '));
  assert.equal(frames, POSES.length * FRAMES_PER_POSE, 'จำนวนเฟรมที่ตรวจ');

  t.diagnostic(`ตรวจ ${frames} เฟรม · ${blocks} บล็อก 16×16 · ${pixels} พิกเซล · diff ${mismatches}`);
  t.diagnostic(`สีต่อเฟรม ${Math.min(...colorsPerFrame)}–${Math.max(...colorsPerFrame)} · ใช้ร่วมกัน ${seenColors.size} สี`);
});

test('สีทั้งหมดอยู่ในพาเลตต์พิกเซลของสไปรต์ (24 สี) รวมพื้นครีม และพื้นรอบนอกเป็นครีมจริง', (t) => {
  assert.equal(palette.size, 24, 'พาเลตต์สไปรต์ต้องมี 24 สี');
  assert.ok(!palette.has(CREAM), 'ครีมต้องไม่ใช่สีของสไปรต์เอง (กันการนับซ้ำ)');

  const allowed = new Set(palette);
  allowed.add(CREAM);
  const used = new Set();
  const corners = new Set();
  let frames = 0;

  decodeGif(fs.readFileSync(GIF), {
    onFrame: (f) => {
      frames++;
      const d = f.rgba;
      for (let i = 0; i < d.length; i += 4) {
        used.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      }
      for (const [x, y] of [[0, 0], [CANVAS - 1, 0], [0, CANVAS - 1], [CANVAS - 1, CANVAS - 1]]) {
        const o = (y * CANVAS + x) * 4;
        corners.add((d[o] << 16) | (d[o + 1] << 8) | d[o + 2]);
      }
    },
  });

  const stray = [...used].filter((c) => !allowed.has(c));
  assert.deepEqual(stray.map(hex), [], 'พบสีที่ไม่อยู่ในพาเลตต์ (สัญญาณของ anti-alias/บีบอัดสีเพี้ยน)');
  assert.deepEqual([...corners].map(hex), [hex(CREAM)], 'มุมทั้งสี่ของทุกเฟรมต้องเป็นพื้นครีม');

  t.diagnostic(`${frames} เฟรม · ใช้ ${used.size} สี (พาเลตต์ 24 + พื้นครีม) · ไม่มีสีแปลกปลอม`);
});
