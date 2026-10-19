'use strict';
/**
 * tools/gif-decode.js — ถอดรหัส GIF แบบไม่มี dependency (ใช้ตรวจ docs/demo.gif ในเทสต์)
 *
 * รองรับ GIF87a/GIF89a, color table ทั้งแบบ global/local, transparency,
 * interlace และ disposal method 0–3 — พอสำหรับไฟล์ที่โปรเจกต์นี้สร้างเอง
 *
 * ใช้แบบสตรีมมิ่ง (แนะนำกับไฟล์ใหญ่):
 *   decodeGif(buf, { onFrame: (frame) => { ... } })
 * หรือเก็บทุกเฟรมไว้ในหน่วยความจำ:
 *   const { width, height, frames } = decodeGif(buf);
 */

function readColorTable(buf, at, entries) {
  const table = new Uint8Array(entries * 3);
  table.set(buf.subarray(at, at + entries * 3));
  return table;
}

/** อ่าน sub-block chain (รูปแบบ length-prefixed ของ GIF) แล้วต่อกันเป็น buffer เดียว */
function readSubBlocks(buf, at) {
  const parts = [];
  let total = 0;
  for (;;) {
    if (at >= buf.length) throw new Error('GIF: sub-block ขาดกลางทาง');
    const len = buf[at++];
    if (len === 0) break;
    parts.push(buf.subarray(at, at + len));
    total += len;
    at += len;
  }
  return { data: Buffer.concat(parts, total), next: at };
}

/** LZW ตามสเปก GIF: คืนดัชนีสี (1 ไบต์/พิกเซล) ตามจำนวนที่ต้องการ */
function lzwDecode(minCodeSize, data, expectedPixels) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const out = new Uint8Array(expectedPixels);
  const prefix = new Int32Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4096);
  for (let i = 0; i < clearCode; i++) { prefix[i] = -1; suffix[i] = i; }

  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  let old = -1;
  let outPos = 0;
  let bitBuf = 0;
  let bitCnt = 0;
  let bytePos = 0;

  const expand = (code) => {
    let sp = 0;
    let c = code;
    while (c >= clearCode) {
      if (sp >= stack.length) throw new Error('GIF: LZW stack overflow');
      stack[sp++] = suffix[c];
      c = prefix[c];
      if (c < 0) throw new Error('GIF: LZW code เสีย');
    }
    stack[sp++] = suffix[c];
    return { sp, first: suffix[c] };
  };

  for (;;) {
    while (bitCnt < codeSize) {
      if (bytePos >= data.length) return { pixels: out, truncated: true };
      bitBuf |= data[bytePos++] << bitCnt;
      bitCnt += 8;
    }
    const code = bitBuf & ((1 << codeSize) - 1);
    bitBuf >>>= codeSize;
    bitCnt -= codeSize;

    if (code === clearCode) {
      codeSize = minCodeSize + 1;
      nextCode = endCode + 1;
      old = -1;
      continue;
    }
    if (code === endCode) break;
    if (code > nextCode) throw new Error('GIF: LZW code เกินตาราง');

    if (old === -1) {
      if (code >= clearCode) throw new Error('GIF: LZW เริ่มด้วย code ที่ไม่ใช่ literal');
      if (outPos < expectedPixels) out[outPos++] = code;
      old = code;
      continue;
    }

    // เคส KwKwK (code === nextCode): สายอักขระ = สายของ old + อักขระแรกของ old
    const kwkwk = code === nextCode;
    const expanded = expand(kwkwk ? old : code);
    const emit = expanded.sp + (kwkwk ? 1 : 0);

    if (outPos + emit <= expectedPixels) {
      // stack[sp-1] คืออักขระตัวแรกของสาย → ปล่อยออกตามลำดับปกติก่อน
      for (let i = expanded.sp - 1; i >= 0; i--) out[outPos++] = stack[i];
      if (kwkwk) out[outPos++] = expanded.first;   // อักขระที่ต่อท้ายอยู่ท้ายสุด
    } else {
      outPos = expectedPixels;            // เกินเฟรม = ข้อมูลเสีย ปล่อยให้ผู้เรียกตรวจเอง
    }

    if (nextCode < 4096) {
      prefix[nextCode] = old;
      suffix[nextCode] = expanded.first;
      nextCode++;
      if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
    }
    old = code;
    if (outPos >= expectedPixels) break;
  }

  return { pixels: out, truncated: false };
}

/**
 * @param {Buffer} buf  ข้อมูลไฟล์ GIF
 * @param {{onFrame?: (frame: {index:number, left:number, top:number, width:number, height:number, delayMs:number, rgba:Uint8Array}) => void}} [opts]
 * @returns {{width:number, height:number, frames:Array}}
 */
function decodeGif(buf, opts = {}) {
  if (buf.length < 13) throw new Error('GIF: ไฟล์สั้นเกินไป');
  const sig = buf.toString('latin1', 0, 6);
  if (sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error('GIF: signature ไม่ถูกต้อง: ' + sig);

  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  const packed = buf[10];
  const bgIndex = buf[11];
  let at = 13;

  let globalTable = null;
  if (packed & 0x80) {
    const entries = 2 << (packed & 7);
    globalTable = readColorTable(buf, at, entries);
    at += entries * 3;
  }

  const bgRGB = globalTable && (bgIndex * 3 + 2) < globalTable.length
    ? [globalTable[bgIndex * 3], globalTable[bgIndex * 3 + 1], globalTable[bgIndex * 3 + 2]]
    : [0, 0, 0];

  const canvas = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    canvas[i * 4] = bgRGB[0];
    canvas[i * 4 + 1] = bgRGB[1];
    canvas[i * 4 + 2] = bgRGB[2];
    canvas[i * 4 + 3] = 255;
  }

  const frames = [];
  let gce = { delayMs: 0, transparent: -1, dispose: 0 };
  let pendingGCE = null;

  const emitFrame = (left, top, fw, fh, delayMs, gceInfo) => {
    const frame = {
      index: frames.length,
      left, top, width: fw, height: fh,
      delayMs,
      transparentIndex: gceInfo.transparent,
      dispose: gceInfo.dispose,
      rgba: new Uint8Array(canvas),      // สำเนาไว้ก่อน เผื่อ disposal รอบหน้าเขียนทับ
    };
    frames.push(frame);
    if (opts.onFrame) opts.onFrame(frame);
    return frame;
  };

  while (at < buf.length) {
    const block = buf[at++];
    if (block === 0x3b) break;                    // trailer

    if (block === 0x21) {                          // extension
      const label = buf[at++];
      const { data, next } = readSubBlocks(buf, at);
      at = next;
      if (label === 0xf9 && data.length >= 4) {    // graphic control
        const g = data[0];
        gce = {
          delayMs: data[1] | (data[2] << 8),
          transparent: g & 0x01 ? data[3] : -1,
          dispose: (g >> 2) & 0x07,
        };
        pendingGCE = gce;
      }
      continue;
    }

    if (block !== 0x2c) throw new Error('GIF: ไม่รู้จัก block 0x' + block.toString(16));

    const left = buf.readUInt16LE(at); at += 2;
    const top = buf.readUInt16LE(at); at += 2;
    const fw = buf.readUInt16LE(at); at += 2;
    const fh = buf.readUInt16LE(at); at += 2;
    const imgPacked = buf[at++];

    let table = globalTable;
    if (imgPacked & 0x80) {
      const entries = 2 << (imgPacked & 7);
      table = readColorTable(buf, at, entries);
      at += entries * 3;
    }
    if (!table) throw new Error('GIF: ไม่มี color table');

    const interlaced = Boolean(imgPacked & 0x40);
    const minCodeSize = buf[at++];
    const { data: lzwData, next: afterLzw } = readSubBlocks(buf, at);
    at = afterLzw;

    const { pixels, truncated } = lzwDecode(minCodeSize, lzwData, fw * fh);
    if (truncated) throw new Error('GIF: ข้อมูล LZW ขาดกลางทาง (เฟรม ' + frames.length + ')');

    const snapshot = gce.dispose === 3 ? new Uint8Array(canvas) : null;

    // วาดลง canvas
    const rowOrder = interlaced ? interlaceRows(fh) : null;
    for (let row = 0; row < fh; row++) {
      const destRow = rowOrder ? rowOrder[row] : row;
      const y = top + destRow;
      if (y < 0 || y >= height) continue;
      for (let x = 0; x < fw; x++) {
        const dx = left + x;
        if (dx < 0 || dx >= width) continue;
        const idx = pixels[row * fw + x];
        if (idx === gce.transparent) continue;
        const o = (y * width + dx) * 4;
        canvas[o] = table[idx * 3];
        canvas[o + 1] = table[idx * 3 + 1];
        canvas[o + 2] = table[idx * 3 + 2];
        canvas[o + 3] = 255;
      }
    }

    emitFrame(left, top, fw, fh, gce.delayMs, gce);

    // เตรียม canvas สำหรับเฟรมถัดไปตาม disposal method
    const rectFill = () => {
      for (let y = top; y < top + fh; y++) {
        if (y < 0 || y >= height) continue;
        for (let x = left; x < left + fw; x++) {
          if (x < 0 || x >= width) continue;
          const o = (y * width + x) * 4;
          canvas[o] = bgRGB[0];
          canvas[o + 1] = bgRGB[1];
          canvas[o + 2] = bgRGB[2];
          canvas[o + 3] = 255;
        }
      }
    };

    if (gce.dispose === 2) rectFill();
    else if (gce.dispose === 3 && snapshot) canvas.set(snapshot);

    gce = { delayMs: 0, transparent: -1, dispose: 0 };
  }

  return { width, height, frames, bgRGB, wasGraphicControl: Boolean(pendingGCE) };
}

function interlaceRows(fh) {
  const order = [];
  for (let y = 0; y < fh; y += 8) order.push(y);
  for (let y = 4; y < fh; y += 8) order.push(y);
  for (let y = 2; y < fh; y += 4) order.push(y);
  for (let y = 1; y < fh; y += 2) order.push(y);
  const map = new Int32Array(fh);
  for (let i = 0; i < fh; i++) map[i] = order[i];
  return map;
}

module.exports = { decodeGif, lzwDecode };
