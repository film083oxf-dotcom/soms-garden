#!/usr/bin/env node
'use strict';
/**
 * tools/pixelate-sprites.js — แปลง sprites/<สถานะ>.png ทั้ง 6 ท่าเป็นพิกเซลอาร์ต
 *
 * ขั้นตอน (ทำเหมือนกันทุกท่า เพื่อให้ชุดสีตรงกัน):
 *  1. สำรองต้นฉบับไปที่ sprites/original/ ก่อน (ถ้ามีอยู่แล้วจะใช้ไฟล์นั้นเป็นต้นฉบับ
 *     ไม่ทับด้วยภาพพิกเซลอาร์ตที่แปลงแล้ว — รันซ้ำได้โดยภาพไม่เสื่อม)
 *  2. ย่อลง 64×64 ด้วย area/box filter แบบ premultiplied alpha
 *     (เฉลี่ยทุกพิกเซลในบล็อก 8×8 ของภาพ 512 — สัดส่วนไม่บิด)
 *  3. สร้างพาเลตต์ 24 สีจากทุกท่ารวมกัน (median cut + k-means) แล้ว map ทุกพิกเซล
 *     เข้าพาเลตต์ชุดเดียวกัน
 *  4. alpha เป็น 0 หรือ 255 เท่านั้น (ตัดที่ค่า --alpha, ค่าเริ่มต้น 128)
 *  5. ขยายกลับแบบ nearest-neighbor ×8 → 512×512 แล้วเขียนทับ sprites/<สถานะ>.png
 *     (มี fix เฉพาะจุดที่ย่อแล้วอ่านไม่ออก — ดู TOUCHUPS และ KEEP_DETAILS)
 *
 * ใช้: node tools/pixelate-sprites.js [--size=64] [--scale=8] [--colors=24] [--alpha=128]
 * ไม่ต้องติดตั้ง dependency ใด ๆ (ถอด/เขียน PNG เองด้วย node:zlib)
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');
const SPRITES = path.join(ROOT, 'sprites');
const ORIGINALS = path.join(SPRITES, 'original');
const STATUSES = ['thinking', 'coding', 'success', 'error', 'done', 'idle'];

function parseArgs(argv) {
  const opts = { size: 64, scale: 8, colors: 24, alpha: 128 };
  for (const arg of argv) {
    const m = /^--(size|scale|colors|alpha)=(\d+)$/.exec(arg);
    if (m) opts[m[1]] = Number(m[2]);
    else if (arg === '--help' || arg === '-h') {
      console.log('node tools/pixelate-sprites.js [--size=64] [--scale=8] [--colors=24] [--alpha=128]');
      process.exit(0);
    } else {
      console.error('ไม่รู้จัก argument: ' + arg);
      process.exit(1);
    }
  }
  if (!(opts.size > 0) || !(opts.scale > 0) || !(opts.colors > 0)) {
    console.error('size / scale / colors ต้องเป็นจำนวนเต็มบวก');
    process.exit(1);
  }
  return opts;
}

/* ============================ PNG ============================ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** อ่าน PNG 8-bit RGBA/RGB (ไม่รองรับ interlaced) → RGBA 4 ไบต์/พิกเซล */
function decodePng(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error(file + ': ไม่ใช่ PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(file + ': รองรับเฉพาะ 8-bit');
  if (interlace) throw new Error(file + ': ไม่รองรับ interlaced PNG');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(file + ': color type ' + colorType + ' ยังไม่รองรับ');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      cur[x] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      if (channels === 4) {
        out[d] = cur[s];
        out[d + 1] = cur[s + 1];
        out[d + 2] = cur[s + 2];
        out[d + 3] = cur[s + 3];
      } else if (channels === 3) {
        out[d] = cur[s];
        out[d + 1] = cur[s + 1];
        out[d + 2] = cur[s + 2];
        out[d + 3] = 255;
      } else if (channels === 2) {
        out[d] = out[d + 1] = out[d + 2] = cur[s];
        out[d + 3] = cur[s + 1];
      } else {
        out[d] = out[d + 1] = out[d + 2] = cur[s];
        out[d + 3] = 255;
      }
    }
    prev = cur;
  }
  return { width, height, data: out };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** เขียน PNG RGBA 8-bit (filter 0 ทุกบรรทัด) */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rows[y * (width * 4 + 1)] = 0;
    rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ====================== ย่อภาพแบบ area ====================== */

/**
 * average แบบ premultiplied alpha ต่อบล็อก factor×factor → RGBA float
 *
 * `keep` (ไม่บังคับ) = { test, minCount, minShare } สำหรับ "รายละเอียดสีที่ต้องรอด":
 * ถ้าในบล็อกมีพิกเซลที่ test ผ่านอย่างน้อย minCount พิกเซล และคิดเป็นสัดส่วน
 * ไม่น้อยกว่า minShare ของบล็อก จะใช้ค่าเฉลี่ยของเฉพาะพิกเซลเหล่านั้นแบบทึบ (alpha 255)
 * แทนการเฉลี่ยทั้งบล็อก — กันรายละเอียดเล็ก ๆ อย่างน้ำตาสีฟ้าจมหายไปในสีผิว
 */
function areaDownsample(img, size, keep) {
  const { width, height, data } = img;
  if (width !== height) throw new Error('ต้องเป็นภาพสี่เหลี่ยมจัตุรัส');
  if (width % size !== 0) {
    throw new Error(`ความกว้าง ${width} หารด้วย ${size} ไม่ลงตัว — ต้องใช้ integer box filter`);
  }
  const factor = width / size;
  const out = new Float64Array(size * size * 4);
  const n = factor * factor;
  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      let sumA = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let keepA = 0;
      let keepR = 0;
      let keepG = 0;
      let keepB = 0;
      let keepN = 0;
      for (let sy = oy * factor; sy < (oy + 1) * factor; sy++) {
        for (let sx = ox * factor; sx < (ox + 1) * factor; sx++) {
          const i = (sy * width + sx) * 4;
          const a = data[i + 3] / 255;
          sumA += a;
          sumR += data[i] * a;
          sumG += data[i + 1] * a;
          sumB += data[i + 2] * a;
          if (keep && keep.test(data[i], data[i + 1], data[i + 2], a)) {
            keepN++;
            keepA += a;
            keepR += data[i] * a;
            keepG += data[i + 1] * a;
            keepB += data[i + 2] * a;
          }
        }
      }
      const o = (oy * size + ox) * 4;
      if (keep && keepN >= keep.minCount && keepN / n >= keep.minShare && keepA > 0) {
        out[o] = keepR / keepA;
        out[o + 1] = keepG / keepA;
        out[o + 2] = keepB / keepA;
        out[o + 3] = 255;
        continue;
      }
      if (sumA > 0) {
        out[o] = sumR / sumA;
        out[o + 1] = sumG / sumA;
        out[o + 2] = sumB / sumA;
      }
      out[o + 3] = (sumA / n) * 255;
    }
  }
  return out;
}

/**
 * สีที่ต้อง "รอด" ตอนย่อ — ใช้กับท่าที่มีรายละเอียดสีสันน้อย ๆ แต่สำคัญต่ออารมณ์
 * error: น้ำตาสีฟ้า (b สูงกว่า r ชัดเจน) ใต้ตา ถ้าเฉลี่ยรวมกับผิวสีส้มจะกลายเป็นเขียวหม่น
 */
const KEEP_DETAILS = {
  error: {
    minCount: 2,
    minShare: 0.25,
    test: (r, g, b, a) => a >= 0.5 && b - r >= 12 && b - g >= 4 && b >= 120,
  },
};

/* =================== พาเลตต์ 24 สี (shared) =================== */

function collectPixels(downsampled, alphaThreshold) {
  const hist = new Map();
  for (const px of downsampled) {
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < alphaThreshold) continue;
      const r = Math.round(px[i]);
      const g = Math.round(px[i + 1]);
      const b = Math.round(px[i + 2]);
      const key = (r << 16) | (g << 8) | b;
      hist.set(key, (hist.get(key) || 0) + 1);
    }
  }
  return [...hist.entries()].map(([key, count]) => ({
    r: (key >> 16) & 0xff,
    g: (key >> 8) & 0xff,
    b: key & 0xff,
    count,
  }));
}

/** median cut: แตกกล่องสีตามช่วงที่กว้างที่สุด จนได้จำนวนสีที่ต้องการ */
function medianCut(pixels, wanted) {
  const boxes = [{ colors: pixels }];
  while (boxes.length < wanted) {
    let pick = -1;
    let best = 0;
    boxes.forEach((box, i) => {
      if (box.colors.length < 2) return;
      let lo = 255;
      let hi = 0;
      for (const c of box.colors) {
        lo = Math.min(lo, c.r, c.g, c.b);
        hi = Math.max(hi, c.r, c.g, c.b);
      }
      const score = (hi - lo) * Math.sqrt(box.colors.reduce((s, c) => s + c.count, 0));
      if (score > best) {
        best = score;
        pick = i;
      }
    });
    if (pick < 0) break;
    const box = boxes[pick];
    let channel = 'r';
    let range = 0;
    for (const ch of ['r', 'g', 'b']) {
      const vals = box.colors.map((c) => c[ch]);
      const r = Math.max(...vals) - Math.min(...vals);
      if (r > range) {
        range = r;
        channel = ch;
      }
    }
    const sorted = [...box.colors].sort((a, b) => a[channel] - b[channel] || a.r - b.r || a.g - b.g);
    const total = sorted.reduce((s, c) => s + c.count, 0);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      acc += sorted[i].count;
      if (acc >= total / 2) {
        cut = i + 1;
        break;
      }
    }
    boxes.splice(pick, 1, { colors: sorted.slice(0, cut) }, { colors: sorted.slice(cut) });
  }
  return boxes.map((box) => {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let sw = 0;
    for (const c of box.colors) {
      sr += c.r * c.count;
      sg += c.g * c.count;
      sb += c.b * c.count;
      sw += c.count;
    }
    return [Math.round(sr / sw), Math.round(sg / sw), Math.round(sb / sw)];
  });
}

function dist2(r, g, b, p) {
  const dr = r - p[0];
  const dg = g - p[1];
  const db = b - p[2];
  return dr * dr + dg * dg + db * db;
}

/** k-means แบบปรับปรุงพาเลตต์จาก median cut (ทำซ้ำได้ผลเดิมทุกครั้ง) */
function refinePalette(pixels, palette, iterations) {
  let pal = palette.map((p) => p.slice());
  for (let it = 0; it < iterations; it++) {
    const clusters = pal.map(() => ({ r: 0, g: 0, b: 0, w: 0 }));
    for (const c of pixels) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < pal.length; i++) {
        const d = dist2(c.r, c.g, c.b, pal[i]);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      const cl = clusters[best];
      cl.r += c.r * c.count;
      cl.g += c.g * c.count;
      cl.b += c.b * c.count;
      cl.w += c.count;
    }
    pal = pal.map((p, i) => {
      const cl = clusters[i];
      if (!cl.w) return p;
      return [Math.round(cl.r / cl.w), Math.round(cl.g / cl.w), Math.round(cl.b / cl.w)];
    });
  }
  // ตัดสีซ้ำ และเติมสีที่หายไปจาก median cut กลับ (ถ้ามี)
  const seen = new Set();
  const out = [];
  for (const p of pal) {
    const key = (p[0] << 16) | (p[1] << 8) | p[2];
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  for (const p of palette) {
    if (out.length >= palette.length) break;
    const key = (p[0] << 16) | (p[1] << 8) | p[2];
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

function nearestIndex(r, g, b, palette) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = dist2(r, g, b, palette[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { index: best, dist: Math.sqrt(bestD) };
}

/**
 * รวมสีที่ใกล้กันเกินไป (เช่นส้มอ่อน 6 เฉดที่แทบแยกไม่ออก) แล้วเอาช่องสีที่ว่าง
 * ไปเติมสีที่ยังไม่มีใครเป็นตัวแทน (ดำสนิท / ฟ้า / เขียวสว่าง) — สำคัญกับรายละเอียดเล็ก ๆ
 * อย่างตาดำ น้ำตา และบัวรดน้ำ
 */
function mergeAndFill(pixels, palette, wanted, mergeDist = 26) {
  let pal = palette.map((p) => p.slice());
  const weightOf = (list) => {
    const w = new Array(pal.length).fill(0);
    for (const c of list) w[nearestIndex(c.r, c.g, c.b, pal).index] += c.count;
    return w;
  };

  const css = (p) => '#' + p.map((v) => v.toString(16).padStart(2, '0')).join('');
  for (;;) {
    const w = weightOf(pixels);
    let pair = null;
    let pairD = Infinity;
    for (let i = 0; i < pal.length; i++) {
      for (let j = i + 1; j < pal.length; j++) {
        const d = Math.sqrt(dist2(pal[i][0], pal[i][1], pal[i][2], pal[j]));
        if (d < pairD) {
          pairD = d;
          pair = [i, j];
        }
      }
    }
    if (!pair || pairD >= mergeDist) break;
    const [i, j] = pair;
    const drop = w[i] >= w[j] ? j : i;
    console.log('↔️  รวมสีใกล้กัน ' + css(pal[drop]) + ' เข้ากับ ' + css(pal[drop === i ? j : i]));
    pal.splice(drop, 1);
  }

  while (pal.length < wanted) {
    let pick = null;
    let bestScore = 0;
    for (const c of pixels) {
      const d = nearestIndex(c.r, c.g, c.b, pal).dist;
      const score = c.count * d * d;
      if (score > bestScore) {
        bestScore = score;
        pick = c;
      }
    }
    if (!pick) break;
    pal.push([pick.r, pick.g, pick.b]);
  }
  return pal.slice(0, wanted);
}

function buildPalette(allPixels, wanted) {
  const pixels = allPixels;
  if (!pixels.length) throw new Error('ไม่พบพิกเซลทึบเลย — ตรวจ alpha threshold');
  const base = medianCut(pixels, wanted);
  const refined = refinePalette(pixels, base, 8);
  return mergeAndFill(pixels, refined, wanted);
}

/*
 * ============================ ปรับมือเฉพาะจุด ============================
 *
 * หลังย่อแล้วบางรายละเอียดเล็กลงจนอ่านไม่ออก ที่ 64px มีสามจุดที่ต้องช่วย:
 *
 *  1. idle — ตัวอักษร Zzz ในต้นฉบับเป็นเส้นบาง ~1px ที่ 64px ทำให้ขาดเป็นจุด ๆ
 *     จึงลบเศษเดิมในกรอบ Zzz แล้ววาด Z ใหม่ด้วยพิกเซล 1px (ตำแหน่งเดียวกับต้นฉบับ)
 *  2. error — น้ำตาสีฟ้าเป็นหยดเล็กใต้ตา ถ้าเฉลี่ยทั้งบล็อกจะหม่นเป็นสีเขียวเทา
 *     จึงกันสีฟ้าไว้ด้วย KEEP.error (ด้านบน) แล้วต่อหยดลงอีก 1 พิกเซลให้เห็นเป็นทางน้ำตา
 *  3. success — ปากที่ยิ้มกว้างมีในปากสีเข้มกับลิ้นสีชมพู แต่ที่ 64px เหลือเป็นก้อนสีตาล
 *     จึงขยายในปากเป็น 3 พิกเซลแล้ววางลิ้นสีชมพู 1 พิกเซล
 *
 * ทุกจุดทำ "ก่อน" quantize โดยเขียนสีตรง ๆ แล้วปล่อยให้ map เข้าพาเลตต์เอง
 * สีที่เขียนจึงยังอยู่ใน 24 สีร่วมกันเสมอ
 */
const INK = [59, 36, 24];        // หมึกเข้ม (Zzz) — quantize จะพาไปสีเข้มสุดของพาเลตต์
const TEAR = [141, 208, 235];    // ฟ้าอ่อนของน้ำตา
const MOUTH = [144, 86, 60];     // ในปาก
const TONGUE = [249, 157, 150];  // ลิ้น

const IDLE_ZZZ = {
  clear: { x0: 44, y0: 7, x1: 58, y1: 16 },
  glyphs: [
    { x: 52, y: 8, rows: ['####', '..##', '.##.', '####'] },
    { x: 48, y: 11, rows: ['###', '.#.', '###'] },
    { x: 45, y: 13, rows: ['###', '.#.', '###'] },
  ],
};

const TOUCHUPS = {
  idle(small, size, put) {
    const { x0, y0, x1, y1 } = IDLE_ZZZ.clear;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const o = (y * size + x) * 4;
        small[o] = small[o + 1] = small[o + 2] = small[o + 3] = 0;
      }
    }
    for (const glyph of IDLE_ZZZ.glyphs) {
      glyph.rows.forEach((row, dy) => {
        [...row].forEach((ch, dx) => {
          if (ch === '#') put(glyph.x + dx, glyph.y + dy, INK);
        });
      });
    }
  },

  // หยดน้ำตาต่อจากพิกเซลฟ้าที่กันไว้ ให้เห็นเป็นทางไหลลงมา
  error(small, size, put) {
    put(37, 39, TEAR);
    put(49, 38, TEAR);
  },

  // ปากยิ้มกว้าง: ในปาก 3 พิกเซล + ลิ้นสีชมพูตรงกลาง
  success(small, size, put) {
    put(34, 26, MOUTH);
    put(35, 26, MOUTH);
    put(36, 26, MOUTH);
    put(35, 27, TONGUE);
  },
};

function applyTouchup(status, small, size) {
  const touchup = TOUCHUPS[status];
  if (!touchup) return;
  const put = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const o = (y * size + x) * 4;
    small[o] = color[0];
    small[o + 1] = color[1];
    small[o + 2] = color[2];
    small[o + 3] = 255;
  };
  touchup(small, size, put);
}

function nearestColor(r, g, b, palette, cache) {
  const key = (r << 16) | (g << 8) | b;
  if (cache.has(key)) return cache.get(key);
  let best = palette[0];
  let bestD = Infinity;
  for (const p of palette) {
    const d = dist2(r, g, b, p);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  cache.set(key, best);
  return best;
}

/* ============================ main ============================ */

function main() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(ORIGINALS, { recursive: true });

  const sources = [];
  for (const status of STATUSES) {
    const live = path.join(SPRITES, status + '.png');
    const orig = path.join(ORIGINALS, status + '.png');
    if (!fs.existsSync(orig)) {
      if (!fs.existsSync(live)) throw new Error('ไม่พบต้นฉบับ ' + live);
      fs.copyFileSync(live, orig);
      console.log('💾 สำรองต้นฉบับ → sprites/original/' + status + '.png');
    }
    const img = decodePng(orig);
    const small = areaDownsample(img, opts.size);
    // ภาพที่กันรายละเอียดไว้ (ถ้ามี) ใช้เฉพาะตอน map สี — พาเลตต์ยังคิดจากภาพปกติ
    // เพื่อให้ชุดสียังเป็นชุดเดิมไม่ขยับ
    const detail = KEEP_DETAILS[status] ? areaDownsample(img, opts.size, KEEP_DETAILS[status]) : small;
    sources.push({ status, img, small, detail });
  }

  const allPixels = [];
  for (const s of sources) allPixels.push(...collectPixels([s.small], opts.alpha));
  const palette = buildPalette(allPixels, opts.colors);
  console.log('🎨 พาเลตต์ ' + palette.length + ' สี: ' + palette.map((p) => '#' + p.map((v) => v.toString(16).padStart(2, '0')).join('')).join(' '));

  for (const s of sources) {
    const cache = new Map();
    // ปรับรายละเอียดที่ย่อแล้วอ่านไม่ออก ก่อน map เข้าพาเลตต์ (ดู TOUCHUPS)
    applyTouchup(s.status, s.detail, opts.size);

    const small = Buffer.alloc(opts.size * opts.size * 4);
    let opaque = 0;
    for (let i = 0; i < s.detail.length; i += 4) {
      if (s.detail[i + 3] < opts.alpha) continue;   // โปร่งใสสนิท
      const idx = i / 4;
      const c = nearestColor(Math.round(s.detail[i]), Math.round(s.detail[i + 1]), Math.round(s.detail[i + 2]), palette, cache);
      small[idx * 4] = c[0];
      small[idx * 4 + 1] = c[1];
      small[idx * 4 + 2] = c[2];
      small[idx * 4 + 3] = 255;
      opaque++;
    }

    const size = opts.size * opts.scale;
    const out = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      const sy = Math.floor(y / opts.scale);
      for (let x = 0; x < size; x++) {
        const sx = Math.floor(x / opts.scale);
        const src = (sy * opts.size + sx) * 4;
        const dst = (y * size + x) * 4;
        out[dst] = small[src];
        out[dst + 1] = small[src + 1];
        out[dst + 2] = small[src + 2];
        out[dst + 3] = small[src + 3];
      }
    }

    const file = path.join(SPRITES, s.status + '.png');
    fs.writeFileSync(file, encodePng(size, size, out));
    const used = new Set();
    for (let i = 0; i < small.length; i += 4) {
      if (small[i + 3] === 255) used.add((small[i] << 16) | (small[i + 1] << 8) | small[i + 2]);
    }
    console.log(`✅ ${s.status}.png → ${size}×${size} (จาก 64×64 · ${opaque} พิกเซลทึบ · ใช้ ${used.size} สี)`);
  }
}

if (require.main === module) main();

module.exports = {
  decodePng, encodePng, areaDownsample, collectPixels, buildPalette, medianCut, refinePalette,
  mergeAndFill, nearestColor, nearestIndex, STATUSES,
};
