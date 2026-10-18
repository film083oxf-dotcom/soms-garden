#!/usr/bin/env node
'use strict';
/**
 * tools/pixelate-sleepy.js — แปลงสไปรต์ชีตหลับ 2×2 ให้เป็นพิกเซลอาร์ตชุดเดียวกับ 6 ท่าหลัก
 *
 * ต้นฉบับ: assets/soms-garden-fat-lazy-cat-sleepy-spritesheet.png (1920×1920 · 4 เฟรม 960×960)
 * ผลลัพธ์: ไฟล์เดิม ทับด้วย 1024×1024 — 4 เฟรม เฟรมละ 512 (= 64×64 ×8 nearest)
 *
 * ขั้นตอน:
 *  1. สำรองต้นฉบับไป assets/original/ (ถ้ามีแล้วใช้ไฟล์นั้นเป็นต้นฉบับ — รันซ้ำได้)
 *  2. แยก 4 เฟรมตามลำดับอ่าน (บนซ้าย → บนขวา → ล่างซ้าย → ล่างขวา)
 *  3. ย่อภาพทั้งกรอบด้วย area filter แบบ premultiplied alpha โดยสเกลต่อเฟรมคำนวณจาก
 *     "ความสูงตัวแมวคงที่" ที่วัดจากคอมโพเนนต์ใหญ่สุด (ไม่นับ Zzz / เส้นเคลื่อนไหวลอย)
 *     → ตัวแมวสูงเท่ากันทุกเฟรม สัดส่วนของแต่ละท่าคงเดิม ความกว้างไม่เกิน 56 พิกเซล
 *  4. วางบนผืน 64×64 โดยให้ "เส้นพื้น" และ "จุดกึ่งกลาง" ตรงกับ sprites/idle.png
 *     → สลับ idle ↔ sleepy แล้วตัวแมวไม่กระโดด
 *  5. alpha เป็น 0/255 (ตัดที่ --alpha) แล้ว map เข้าพาเลตต์ 24 สีที่อ่านมาจาก sprites/*.png
 *     (ไม่สร้างสีใหม่ และไม่เปลี่ยนสีของ 6 ท่าเดิม)
 *  6. ขยาย nearest ×8 แล้วต่อเป็นชีต 2×2 → 1024×1024
 *
 * ใช้: node tools/pixelate-sleepy.js [--size=64] [--scale=8] [--alpha=128]
 */

const fs = require('node:fs');
const path = require('node:path');
const { decodePng, encodePng, collectPixels, nearestColor, STATUSES } = require('./pixelate-sprites.js');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const ORIGINALS = path.join(ASSETS, 'original');
const SHEET = path.join(ASSETS, 'soms-garden-fat-lazy-cat-sleepy-spritesheet.png');
const SPRITES = path.join(ROOT, 'sprites');
const IDLE = path.join(SPRITES, 'idle.png');

function parseArgs(argv) {
  const opts = { size: 64, scale: 8, alpha: 128 };
  for (const arg of argv) {
    const m = /^--(size|scale|alpha)=(\d+)$/.exec(arg);
    if (m) opts[m[1]] = Number(m[2]);
    else if (arg === '--help' || arg === '-h') {
      console.log('node tools/pixelate-sleepy.js [--size=64] [--scale=8] [--alpha=128]');
      process.exit(0);
    } else {
      console.error('ไม่รู้จัก argument: ' + arg);
      process.exit(1);
    }
  }
  if (!(opts.size > 0) || !(opts.scale > 0) || !(opts.alpha >= 0 && opts.alpha <= 255)) {
    console.error('size / scale ต้องเป็นจำนวนเต็มบวก และ alpha อยู่ใน 0–255');
    process.exit(1);
  }
  return opts;
}

/**
 * bbox ของ "ตัวแมวล้วน ๆ " — คอมโพเนนต์ที่ใหญ่ที่สุด (เชื่อม 8 ทิศ)
 *
 * แต่ละเฟรมมีวัตถุลอยที่ไม่ใช่ตัวแมวปนอยู่: Zzz ของเฟรมนอนขด, เส้นเคลื่อนไหวของเฟรมกลิ้ง
 * ถ้าเอา bbox รวมพวกนี้ สเกลของเฟรมจะถูก "ดัน" ตามของลอย ทำให้ตัวแมวเล็ก/ใหญ่ไม่เท่ากัน
 * ตัวแมวเป็นก้อนเดียวที่ใหญ่กว่าของลอยเสมอ (เช็คแล้วทั้ง 4 เฟรม) จึงใช้ก้อนใหญ่สุดเป็นเส้นอ้างอิง
 *
 * คืน null ถ้าภาพโปร่งใสทั้งหมด
 */
function catBox(img, threshold) {
  const { width: w, height: h, data } = img;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let best = null;
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || data[start * 4 + 3] < threshold) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let count = 0;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    while (top > 0) {
      const p = stack[--top];
      count++;
      const px = p % w;
      const py = (p / w) | 0;
      if (px < x0) x0 = px;
      if (py < y0) y0 = py;
      if (px > x1) x1 = px;
      if (py > y1) y1 = py;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (!seen[q] && data[q * 4 + 3] >= threshold) {
            seen[q] = 1;
            stack[top++] = q;
          }
        }
      }
    }
    if (!best || count > best.count) {
      best = { count, x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 };
    }
  }
  return best;
}

/** bbox ของพิกเซลที่ alpha ≥ threshold (คืน null ถ้าโปร่งใสทั้งภาพ) */
function contentBox(img, threshold) {
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] < threshold) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

function crop(img, box) {
  const out = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const from = ((box.y0 + y) * img.width + box.x0) * 4;
    img.data.copy(out, y * box.width * 4, from, from + box.width * 4);
  }
  return { width: box.width, height: box.height, data: out };
}

/**
 * ย่อภาพแบบ area filter (premultiplied alpha) — รองรับอัตราส่วนที่ไม่ลงตัว
 * แต่ละพิกเซลปลายทางเฉลี่ยพื้นที่ต้นทางที่ทับกันจริง (คำนวณน้ำหนักเป็นเศษส่วน)
 */
function areaResample(img, width, height) {
  const out = new Float64Array(width * height * 4);
  const sx = img.width / width;
  const sy = img.height / height;
  for (let oy = 0; oy < height; oy++) {
    const y0 = oy * sy;
    const y1 = (oy + 1) * sy;
    for (let ox = 0; ox < width; ox++) {
      const x0 = ox * sx;
      const x1 = (ox + 1) * sx;
      let sumA = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let area = 0;
      for (let iy = Math.floor(y0); iy < Math.ceil(y1); iy++) {
        const wy = Math.min(y1, iy + 1) - Math.max(y0, iy);
        if (wy <= 0) continue;
        for (let ix = Math.floor(x0); ix < Math.ceil(x1); ix++) {
          const wx = Math.min(x1, ix + 1) - Math.max(x0, ix);
          if (wx <= 0) continue;
          const w = wx * wy;
          const i = (iy * img.width + ix) * 4;
          const a = img.data[i + 3] / 255;
          sumA += a * w;
          sumR += img.data[i] * a * w;
          sumG += img.data[i + 1] * a * w;
          sumB += img.data[i + 2] * a * w;
          area += w;
        }
      }
      const o = (oy * width + ox) * 4;
      if (sumA > 0) {
        out[o] = sumR / sumA;
        out[o + 1] = sumG / sumA;
        out[o + 2] = sumB / sumA;
      }
      out[o + 3] = (sumA / area) * 255;
    }
  }
  return out;
}

/** พาเลตต์ 24 สีร่วม: อ่านสีจริงที่ใช้ใน sprites/*.png (ผลจาก pixelate-sprites.js) */
function sharedPalette() {
  const map = new Map();
  for (const status of STATUSES) {
    const file = path.join(SPRITES, status + '.png');
    if (!fs.existsSync(file)) throw new Error('ไม่พบ ' + file + ' — รัน node tools/pixelate-sprites.js ก่อน');
    for (const px of collectPixels([decodePng(file).data], 128)) {
      map.set((px.r << 16) | (px.g << 8) | px.b, [px.r, px.g, px.b]);
    }
  }
  if (map.size > 24) {
    throw new Error(`sprites/*.png ใช้ ${map.size} สี (มากกว่า 24) — รัน node tools/pixelate-sprites.js ใหม่ก่อน`);
  }
  return [...map.values()];
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  fs.mkdirSync(ORIGINALS, { recursive: true });
  const backup = path.join(ORIGINALS, path.basename(SHEET));
  if (!fs.existsSync(backup)) {
    if (!fs.existsSync(SHEET)) throw new Error('ไม่พบสไปรต์ชีต ' + SHEET);
    fs.copyFileSync(SHEET, backup);
    console.log('💾 สำรองต้นฉบับ → assets/original/' + path.basename(SHEET));
  }

  const sheet = decodePng(backup);
  if (sheet.width !== sheet.height || sheet.width % 2 !== 0) {
    throw new Error(`สไปรต์ชีตต้องเป็นสี่เหลี่ยมจัตุรัสและแบ่ง 2×2 ลงตัว (ได้ ${sheet.width}×${sheet.height})`);
  }
  if (sheet.width % (2 * opts.size) !== 0) {
    throw new Error(`เฟรม ${sheet.width / 2} หารด้วย ${opts.size} ไม่ลงตัว`);
  }

  const idle = decodePng(IDLE);
  const idleBox = contentBox(idle, opts.alpha);
  if (!idleBox) throw new Error('sprites/idle.png โปร่งใสทั้งภาพ');
  // idle เป็นภาพ 512 (64×8) — แปลง bbox กลับมาเป็นพิกเซลอาร์ต 64 ก่อนเพื่อใช้เป็นเส้นอ้างอิง
  const idleUnit = idle.width / opts.size;
  const centerX = Math.round((idleBox.x0 + idleBox.x1) / 2 / idleUnit);
  const bottom = Math.floor(idleBox.y1 / idleUnit);
  const maxW = opts.size - 8;                          // เว้นขอบข้างละ 4 พิกเซล
  const maxH = Math.round(idleBox.height / idleUnit);  // สูงเท่าท่า idle → สลับแล้วหัว/ตัวไม่กระโดด

  // แยก 4 เฟรม (ลำดับอ่าน) + bbox
  const fw = sheet.width / 2;
  const fh = sheet.height / 2;
  const frames = [];
  for (let fy = 0; fy < 2; fy++) {
    for (let fx = 0; fx < 2; fx++) {
      const data = Buffer.alloc(fw * fh * 4);
      for (let y = 0; y < fh; y++) {
        const from = ((fy * fh + y) * sheet.width + fx * fw) * 4;
        sheet.data.copy(data, y * fw * 4, from, from + fw * 4);
      }
      const img = { width: fw, height: fh, data };
      const box = contentBox(img, opts.alpha);        // กรอบรวม Zzz/ของลอย — ใช้ตอนครอบก่อนย่อ
      const body = catBox(img, opts.alpha);           // ตัวแมวล้วน — ใช้ตอนคิดสเกล/จัดตำแหน่ง
      if (!box || !body) throw new Error(`เฟรม ${fy * 2 + fx + 1} โปร่งใสทั้งภาพ`);
      frames.push({ img, box, body });
    }
  }

  /* สเกลต่อเฟรม: ทำให้ "ความสูงตัวแมว" เท่ากันทุกเฟรม (วัดจากตัวแมวล้วน ไม่นับ Zzz/ของลอย)
     โดยเลือกความสูงที่สูงสุดที่ยังไม่เกินสองเงื่อนไข: ไม่เกินความกว้าง maxW และไม่เกิน maxH (เท่า idle) */
  const targetH = Math.max(
    1,
    Math.min(maxH, Math.floor(Math.min(...frames.map((f) => (maxW * f.body.height) / f.body.width)))),
  );

  const palette = sharedPalette();
  console.log('🎨 พาเลตต์ร่วม ' + palette.length + ' สีจาก sprites/*.png');

  const cell = opts.size * opts.scale;
  const out = Buffer.alloc(cell * 2 * cell * 2 * 4);

  frames.forEach((frame, index) => {
    // สเกลเฉพาะเฟรม จากความสูงตัวแมวคงที่ (targetH) — สัดส่วนเดิมถูกเก็บไว้ทุกแกน
    const s = targetH / frame.body.height;
    const dh = targetH;                                   // ความสูงตัวแมวเท่ากันทุกเฟรม
    const dw = Math.min(maxW, Math.round(frame.body.width * s));
    const rw = Math.max(1, Math.round(frame.box.width * s));   // กรอบทั้งเฟรม (รวม Zzz/ของลอย)
    const rh = Math.max(1, Math.round(frame.box.height * s));
    const resampled = areaResample(crop(frame.img, frame.box), rw, rh);

    // ตำแหน่งตัวแมวในกรอบต้นฉบับ → หลังย่อ → แล้ววางให้เส้นพื้น/กึ่งกลางตรงกับ idle
    const bodyLeft = Math.round((frame.body.x0 - frame.box.x0) * s);
    const bodyTop = Math.round((frame.body.y0 - frame.box.y0) * s);
    const ox = Math.round(centerX - dw / 2) - bodyLeft;
    const oy = bottom - dh + 1 - bodyTop;

    const px = Buffer.alloc(opts.size * opts.size * 4);
    const cache = new Map();
    let opaque = 0;
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        const i = (y * rw + x) * 4;
        if (resampled[i + 3] < opts.alpha) continue;       // alpha 0/255 เท่านั้น
        const c = nearestColor(
          Math.round(resampled[i]),
          Math.round(resampled[i + 1]),
          Math.round(resampled[i + 2]),
          palette,
          cache,
        );
        const px1 = x + ox;
        const py1 = y + oy;
        if (px1 < 0 || py1 < 0 || px1 >= opts.size || py1 >= opts.size) continue;
        const o = (py1 * opts.size + px1) * 4;
        px[o] = c[0];
        px[o + 1] = c[1];
        px[o + 2] = c[2];
        px[o + 3] = 255;
        opaque++;
      }
    }

    // ต่อเข้าชีต 2×2 พร้อมขยาย nearest
    const cx = (index % 2) * cell;
    const cy = Math.floor(index / 2) * cell;
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const si = (Math.floor(y / opts.scale) * opts.size + Math.floor(x / opts.scale)) * 4;
        const di = ((cy + y) * cell * 2 + cx + x) * 4;
        out[di] = px[si];
        out[di + 1] = px[si + 1];
        out[di + 2] = px[si + 2];
        out[di + 3] = px[si + 3];
      }
    }

    const used = new Set();
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 255) used.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
    }
    console.log(
      `✅ เฟรม ${index + 1} → ตัวแมว ${dw}×${dh} @ (${Math.round(centerX - dw / 2)}, ${bottom - dh + 1})` +
      ` · ภาพที่วาง ${rw}×${rh} · ${opaque} พิกเซลทึบ · ใช้ ${used.size} สี`,
    );
  });

  fs.writeFileSync(SHEET, encodePng(cell * 2, cell * 2, out));
  console.log(`🎉 ${path.relative(ROOT, SHEET)} → ${cell * 2}×${cell * 2} (4 เฟรม ${cell}×${cell} · สูงตัวแมวคงที่ ${targetH}px · พื้น y=${bottom} · กลาง x=${centerX})`);
}

if (require.main === module) main();

module.exports = { contentBox, catBox, crop, areaResample, sharedPalette };
