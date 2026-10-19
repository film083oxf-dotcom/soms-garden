#!/usr/bin/env node
'use strict';
/**
 * tools/artcraft/make-demo-gif.js — ประกอบ docs/demo.gif จากสไปรต์ทั้ง 6 ท่า
 *
 * ⚠️ สคริปต์นี้เป็น "ตัวเลือก" (optional) — ไม่ใช่ส่วนของบิลด์หรือเทสต์ของโปรเจกต์
 *    ต้องมี PhotoCraft และ FilmCraft (ติดตั้งผ่าน ArtCraft Launcher) ในเครื่องนี้เท่านั้น
 *    ถ้าไม่มี ให้ข้ามไฟล์นี้ไป — `npm test` และหน้าเว็บทำงานได้ปกติโดยไม่ต้องพึ่งมัน
 *
 *    PhotoCraft  : ขยายสไปรต์ด้วย nearest + วางบนพื้นครีม (ได้ PNG 6 เฟรม)
 *    FilmCraft   : เรียง 6 เฟรมเป็น sequence ท่าละ 1.2 วิ แล้ว export เป็น GIF
 *
 * ใช้:
 *   node tools/artcraft/make-demo-gif.js
 *
 * กำหนดที่อยู่ CLI เองได้ด้วย env: PHOTOCRAFT_CLI / FILMCRAFT_CLI
 * ไฟล์กลางทางทั้งหมดอยู่ใน .artcraft-out/ (ถูก .gitignore ไว้) — ไม่แตะ sprites/ ต้นฉบับ
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const POSES = ['thinking', 'coding', 'success', 'error', 'done', 'idle'];
const HOLD_SECONDS = 1.2;         // เวลาต่อท่า
const FPS = 10;                   // 10 fps × 1.2 วิ = 12 เฟรม/ท่า (ภาพนิ่ง ไม่ต้องลื่นกว่านี้)
const SCALE = 2;                  // 512 → 1024 ด้วย nearest
const BG = '#FFF4E4';             // สีครีมเดียวกับหน้าเว็บ
const SIZE_LIMIT = 1.5 * 1024 * 1024;
const OUT = path.join(ROOT, 'docs', 'demo.gif');
const WORK = path.join(ROOT, '.artcraft-out', 'work');

const toPosix = (p) => p.replace(/\\/g, '/');

function findCli(envName, winDefault, exeName) {
  const fromEnv = process.env[envName];
  if (fromEnv) {
    if (!fs.existsSync(fromEnv)) throw new Error(`${envName} ชี้ไปยังไฟล์ที่ไม่มีอยู่: ${fromEnv}`);
    return fromEnv;
  }
  if (process.platform === 'win32' && fs.existsSync(winDefault)) return winDefault;

  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of exts) {
      const candidate = path.join(dir, exeName + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  throw new Error(
    `ไม่พบ ${exeName} — ติดตั้งผ่าน ArtCraft Launcher ก่อน ` +
    `หรือชี้เองด้วย ${envName}=<path>`
  );
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    const detail = (res.stderr || res.stdout || '').trim().split('\n').slice(-4).join('\n');
    throw new Error(`${path.basename(cmd)} ${args[0]} ล้มเหลว (exit ${res.status})\n${detail}`);
  }
  return (res.stdout || '').trim();
}

function json(text) {
  return JSON.parse(text);
}

function main() {
  const pc = findCli('PHOTOCRAFT_CLI', 'C:/Program Files/PhotoCraft/photocraft-cli.exe', 'photocraft-cli');
  const fc = findCli('FILMCRAFT_CLI', 'C:/Program Files/FilmCraft/filmcraft-cli.exe', 'filmcraft-cli');

  fs.rmSync(WORK, { recursive: true, force: true });
  const framesDir = path.join(WORK, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const canvas = 512 * SCALE;
  const frames = [];

  // 1) PhotoCraft: ขยาย nearest 2× แล้ววางกลางพื้นครีม → PNG 1024×1024 ต่อท่า
  POSES.forEach((pose, i) => {
    const sprite = path.join(ROOT, 'sprites', pose + '.png');
    if (!fs.existsSync(sprite)) throw new Error(`ไม่พบสไปรต์: ${sprite}`);

    const scaled = path.join(framesDir, pose + '-2x.png');
    run(pc, ['run', toPosix(sprite), '--cmd', 'image.imageSize',
      '--params', JSON.stringify({ width: canvas, height: canvas, resample: 'nearest' }),
      '--out', toPosix(scaled)]);

    const frame = path.join(framesDir, String(i + 1).padStart(2, '0') + '-' + pose + '.png');
    run(pc, ['run', '--new',
      JSON.stringify({ width: canvas, height: canvas, background: BG, mode: 'rgb', depth: 8 }),
      '--cmd', 'file.placeEmbedded',
      '--params', JSON.stringify({ path: toPosix(scaled), scale: 100, center: [canvas / 2, canvas / 2] }),
      '--cmd', 'layer.flattenImage',
      '--out', toPosix(frame)]);
    frames.push(frame);
  });
  console.log(`PhotoCraft: ${frames.length} เฟรม ${canvas}×${canvas} พื้น ${BG} (nearest ×${SCALE})`);

  // 2) FilmCraft: sequence 10 fps ท่าละ 12 เฟรม แล้ว export GIF
  const project = path.join(WORK, 'demo.fcproj');
  const withProject = ['--project', toPosix(project), '--save'];

  run(fc, ['exec', 'file.newProject', JSON.stringify({ name: "Som's Garden demo" }),
    '--save-as', toPosix(project)]);
  run(fc, [...withProject, 'exec', 'file.import',
    JSON.stringify({ paths: frames.map(toPosix) })]);

  const tree = json(run(fc, ['--project', toPosix(project), 'inspect', 'project', '--compact']));
  const items = [];
  (function walk(node) {
    for (const child of node.children || []) {
      if (child.item !== undefined && child.type) items.push(child);
      walk(child);
    }
  })(tree.root);

  // เรียงตามชื่อไฟล์ 01-… 06-… เพื่อให้ลำดับท่าตรงกับ POSES
  const orderedIds = items
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map((it) => it.item);
  if (orderedIds.length !== frames.length) {
    throw new Error(`นำเข้าได้ ${orderedIds.length} คลิป แต่คาดไว้ ${frames.length}`);
  }

  run(fc, [...withProject, 'exec', 'file.newSequenceFromClip',
    JSON.stringify({ items: orderedIds })]);
  run(fc, [...withProject, 'exec', 'sequence.settings',
    JSON.stringify({ name: "Som's Garden demo", fps: FPS })]);

  const clipsOf = () => {
    const seq = json(run(fc, ['--project', toPosix(project), 'inspect', 'sequence', '--compact']));
    const clips = [];
    for (const track of seq.video || []) clips.push(...(track.items || []));
    return clips.sort((a, b) => a.start - b.start);
  };

  // ย่อแต่ละคลิปให้เหลือ 12 เฟรมด้วย ripple trim → คลิปถัดไปขยับต่อกันพอดี
  // คลิปแรกตัดเพิ่ม 1 เฟรม: trim ของ FilmCraft เผื่อเศษ ~0.05 เฟรมไว้ ทำให้ขอบคลิป
  // เลื่อนไปตกกลางเฟรมถัดไป ถ้าไม่ชดเชย เฟรมแรกจะกลายเป็น 13 เฟรม (1.3 วิ) และท้ายขาด 1
  const holdFrames = Math.round(HOLD_SECONDS * FPS);
  clipsOf().forEach((clip, i) => {
    const delta = holdFrames - clip.durationFrames - (i === 0 ? 1 : 0);
    if (delta === 0) return;
    run(fc, [...withProject, 'exec', 'timeline.trim',
      JSON.stringify({ clip: clip.clip, edge: 'out', mode: 'ripple', deltaFrames: delta })]);
  });

  const totalSeconds = (POSES.length * holdFrames) / FPS;
  run(fc, ['--project', toPosix(project), 'export', toPosix(OUT),
    '--format', 'gif', '--start', '0', '--end', String(totalSeconds), '--scale', '1']);

  const bytes = fs.statSync(OUT).size;
  const mb = (bytes / (1024 * 1024)).toFixed(2);
  console.log(`FilmCraft: ${POSES.length} ท่า × ${HOLD_SECONDS}s @ ${FPS} fps → ${path.relative(ROOT, OUT)} (${mb} MB)`);
  if (bytes > SIZE_LIMIT) {
    console.warn(`⚠️  ใหญ่กว่าเป้า ${(SIZE_LIMIT / (1024 * 1024)).toFixed(1)} MB — ลด FPS หรือขนาดภาพ`);
  }
}

try {
  main();
} catch (err) {
  console.error('สร้าง GIF ไม่สำเร็จ:', err.message);
  process.exitCode = 1;
}
