#!/usr/bin/env node
// Freebuff watcher for Som's Garden - auto status updates
'use strict';
/**
 * adapters/freebuff/watch.js — เฝ้าดู Freebuff ทำงาน แล้วอัปเดต status.json ให้เอง
 * (ไม่ต้องให้เอเจนต์เรียก set-status.js ด้วยมือ)
 *
 * หลักการ:
 *  - ไม่มี dependency ภายนอก (ใช้ node:sqlite ที่มากับ Node ≥ 22 เฉพาะตอนเปิดฐานข้อมูล)
 *  - อ่านอย่างเดียว: เปิดฐานข้อมูลของ Freebuff แบบ readOnly ห้ามเขียน/แก้ไฟล์ของ Freebuff
 *  - ไม่ส่งข้อมูลออกเครือข่ายเลย (ไม่มี fetch/http/net ในไฟล์นี้)
 *  - เขียนเฉพาะ status.json / garden.json (ผ่าน set-status.js) และ trace.log ของตัวเอง
 *  - เนื้อหาข้อความ/คำสั่ง/โค้ด ของผู้ใช้-เอเจนต์ "ห้ามพิมพ์หรือเก็บลงไฟล์" — อ่านในหน่วยความจำ
 *    ตอนจำแนกสถานะอย่างเดียว (เช่น ดูว่าคำสั่งเป็นคำสั่งทดสอบไหม) แล้วทิ้งทันที
 *
 * สัญญาณที่อ่านได้จาก desktop-v2.db (โหมดละเอียด — ค่าเริ่มต้น):
 *   threads.turn_state (idle|running), threads.last_turn_finished_at, threads.last_turn_outcome
 *   messages.parts_json[].kind: reasoning (คิด) | tool (รันคำสั่ง/แก้ไฟล์) | text | changes | ...
 *   messages.parts_json[].toolName / status (success|failure) / exitCode
 *   threads.harness_state → sessionState.mainAgentState.messageHistory = สัญญาณ "สด" ระหว่างเทิร์น
 *     (ตาราง messages ถูก flush ตอนจบเทิร์น — กลางเทิร์นจึงแมปจาก messageHistory แทน)
 *     อ่านแค่โครงสร้าง role/type/toolName/exitCode/errorMessage + จำแนกคำสั่งเทสต์ในหน่วยความจำ
 *   → คิด→thinking · แก้ไฟล์/รันคำสั่ง→coding · คำสั่งล้มเหลว→error · เทสต์ผ่าน→success
 *   → จบเทิร์น→done (ครั้งเดียวต่อเทิร์น) · เงียบเกินเวลา→idle
 *
 * โหมดสำรอง (fallback): ถ้าเปิด DB ไม่ได้ (ไม่มี node:sqlite / ไฟล์หาย / พัง)
 *   ให้ดูเฉพาะ "มีไฟล์เปลี่ยนแปลงไหม" — มี→coding · เงียบครบเวลา→done (ครั้งเดียว) แล้ว idle
 *
 * วิธีใช้:
 *   node adapters/freebuff/watch.js                 เริ่มเฝ้าดู
 *   node adapters/freebuff/watch.js --pet           เริ่มเฝ้าดู + เปิด desktop pet ด้วย
 *   node adapters/freebuff/watch.js --once          สุ่มดู 1 ครั้งแล้วจบ (ใช้ดีบัก)
 *   node adapters/freebuff/watch.js --idle=60       เงียบ 60 วินาทีค่อยเข้า idle (ค่าเริ่มต้น 45)
 *   node adapters/freebuff/watch.js --window="ชื่อหน้าต่าง"   ชื่อหน้าต่างให้ desktop pet กระโดดไปหา
 *   node adapters/freebuff/watch.js --fallback      ข้าม DB ไปใช้โหมดสำรอง (ดูแค่ไฟล์เปลี่ยน) ตั้งแต่ต้น
 *
 * หรือใช้ npm script:  npm run freebuff
 *
 * ต้องเปิดเองเสมอ: ไม่มีอะไรในโปรเจกต์นี้เรียกไฟล์นี้ให้อัตโนมัติ — `npm start` (desktop pet) และ
 * `npx serve .` ไม่ได้เปิดมัน
 *
 * ถ้าโครงสร้างฐานข้อมูลของ Freebuff เปลี่ยน (ตาราง/คอลัมน์ที่ใช้หายไป) ตัวเฝ้าดูจะ "หยุดตัวเอง"
 * พร้อมบอกว่าอะไรหายไป ไม่เดาสถานะต่อ — ถ้ายังอยากใช้โหมดสำรองให้สั่ง --fallback เอง
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const STOP_FILE = path.join(__dirname, 'watch.stop');   // แตะไฟล์นี้ = สั่งหยุดรอบนั้น (จบสะอาด ปิด pet ให้ด้วย)
const { setStatus } = require(path.join(ROOT, 'set-status.js'));

/* ============================ ค่าตั้ง ============================ */
const DEFAULT_WINDOW = 'Freebuff Desktop';       // ชื่อหน้าต่าง Freebuff (ให้คลิกน้องส้มแล้วกระโดดไป)
const DEFAULT_INTERVAL_MS = 1500;                // ถี่สุดที่จะ poll (ms) — กันไม่เขียน status.json ถี่เกินไป
const DEFAULT_IDLE_S = 45;                       // เงียบนานเท่าไรถึงเข้า idle (วินาที)
const HEARTBEAT_MS = 120 * 1000;                 // รีเฟรช updatedAt ของสถานะเดิมทุก 2 นาที (กันหน้าเว็บหลับกลางคัน)
const DB_RESOLVE_EVERY = 60;                     // หา path ของ DB ใหม่ทุกกี่ tick (~90 วินาที)

/* คำสั่งทดสอบ — ใช้ "จำแนกในหน่วยความจำ" เท่านั้น ห้ามพิมพ์/เก็บคำสั่งจริงลงไฟล์ */
const TEST_RE = /\b(?:node\s+--test|npm\s+(?:run\s+)?test|npx\s+(?:vitest|jest|mocha|ava|playwright\s+test)|yarn\s+(?:test|jest)|pnpm\s+(?:run\s+)?test|vitest|jest|mocha|ava|pytest|py\.test|cargo\s+test|go\s+test|make\s+test|ctest|mvn\s+test|gradle\s+(?:test|check)|dotnet\s+test|phpunit|rspec|bundle\s+exec\s+rspec)\b/i;

/* เครื่องมือที่เป็นการ "อ่าน/ค้น" → thinking · ที่เหลือ (จริงลงมือ) → coding */
const READ_TOOLS = new Set([
  'read_files', 'code_search', 'glob', 'list_directory', 'read_url', 'web_search',
  'researcher_web', 'browser_check', 'preview_snapshot', 'preview_status',
  'preview_logs', 'preview_screenshot', 'terminal_list', 'terminal_read',
]);
const SOFT_TOOLS = new Set([       // เครื่องมือวางแผน/ถาม/ร่าง → thinking
  'write_todos', 'ask_questions', 'suggest_prompts', 'connect_integration',
]);

/* ข้อความบนฟอง — สั้น ≤40 ตัวอักษร ไม่มีเครื่องหมายคำพูดซ้ำ ไม่ขึ้นบรรทัดใหม่ (ตาม AGENTS.md) */
const MSG = {
  think: 'กำลังคิดดูโครงสร้างก่อน',
  read: 'กำลังอ่านและค้นข้อมูล',
  text: 'กำลังเรียบเรียงคำตอบ',
  start: 'รับงานใหม่ กำลังดูโจทย์',
  term: 'กำลังรันคำสั่งในเทอร์มินัล',
  edit: 'กำลังแก้ไฟล์อยู่',
  preview: 'กำลังตรวจหน้าเว็บ',
  plan: 'กำลังจัดลำดับงาน',
  ask: 'กำลังรอคุณตอบคำถาม',
  suggest: 'กำลังร่างข้อเสนอแนะ',
  agentHelp: 'มีเอเจนต์ช่วยงาน',
  changes: 'กำลังตรวจไฟล์ที่เปลี่ยน',
  work: 'กำลังทำงานต่อเนื่อง',
  err: 'คำสั่งล้มเหลว ขอดูก่อน',
  success: 'เทสต์ผ่านแล้ว เย้',
  doneOk: 'จบเทิร์นแล้ว เสร็จงาน',
  doneErr: 'จบเทิร์นแบบมีข้อผิดพลาด',
  doneStop: 'เทิร์นถูกหยุดไว้',
  idle: 'ไม่มีความเคลื่อนไหว พักก่อน',
  fbCoding: 'มีความเคลื่อนไหวในไฟล์',
  fbDone: 'หยุดเคลื่อนไหวแล้ว เสร็จงาน',
  fbIdle: 'เงียบสนิท น้องส้มพัก',
};

/* ============================ ฟังก์ชันล้วน (มีเทสต์) ============================ */

/** คำสั่งนี้คือคำสั่งรันเทสต์ไหม — ใช้กับสตริงในหน่วยความจำเท่านั้น */
function isTestCommand(cmd) {
  return typeof cmd === 'string' && TEST_RE.test(cmd);
}

function msgForTool(toolName) {
  if (toolName === 'run_terminal_command') return MSG.term;
  if (toolName === 'str_replace' || toolName === 'write_file') return MSG.edit;
  if (toolName && toolName.startsWith('preview_')) return MSG.preview;
  if (toolName === 'write_todos') return MSG.plan;
  if (toolName === 'ask_questions') return MSG.ask;
  if (toolName === 'suggest_prompts') return MSG.suggest;
  if (toolName === 'spawn_agents') return MSG.agentHelp;
  return MSG.work;
}

/**
 * แปลงข้อความล่าสุดของเทิร์น → อีเวนต์เรียงจากใหม่ไปเก่า
 * @param {Array<{ts:number, role:string, parts_json:string}>} msgs เรียง seq มาก→น้อย (ใหม่→เก่า)
 * @param {number} turnStart ts ของเทิร์นนี้ (ข้ามข้อความเก่าของเทิร์นก่อน)
 * @returns {Array<{kind,toolName,status,exitCode,test}>}
 * อ่านเฉพาะ "โครงสร้าง" (kind/toolName/status/exitCode) + จำแนกคำสั่งทดสอบในหน่วยความจำ
 */
function buildEvents(msgs, turnStart) {
  const events = [];
  for (const m of msgs || []) {
    if (m && m.role === 'user') continue;         // ข้อความผู้ใช้ = คำสั่งงาน ไม่ใช่กิจกรรมของเอเจนต์ (ข้ามไม่จัดอันดับ)
    if (turnStart && typeof m.ts === 'number' && m.ts < turnStart) break; // คนละเทิร์น (ข้อความของเทิร์นนี้ต้องใหม่กว่าคำสั่ง)
    let parts;
    try { parts = JSON.parse(m.parts_json); } catch { continue; }
    if (!Array.isArray(parts)) continue;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (!p || typeof p !== 'object' || !p.kind) continue;
      if (p.kind !== 'tool' && p.kind !== 'reasoning' && p.kind !== 'text' &&
          p.kind !== 'changes' && p.kind !== 'agent') continue;   // notice/ad/compaction/... ไม่ใช่สัญญาณ
      const ev = { kind: p.kind, toolName: p.toolName || null, status: p.status || null, exitCode: typeof p.exitCode === 'number' ? p.exitCode : null, test: false };
      if (ev.kind === 'tool' && ev.toolName === 'run_terminal_command' && p.input && typeof p.input.command === 'string') {
        ev.test = isTestCommand(p.input.command);   // เท่านี้ที่แตะเนื้อหา — จำแนกแล้วทิ้ง ไม่เก็บ
      }
      events.push(ev);
      if (events.length >= 40) return events;
    }
  }
  return events;
}

/**
 * แปลง harness_state (messageHistory สดระหว่างเทิร์น — ยังไม่ลงตาราง messages) → อีเวนต์ใหม่→เก่า
 * ขอบเทิร์น: entry ที่มี sentAt (epoch ms นาฬิกาเดียวกับ last_prompt_at) เก่ากว่าเทิร์นนี้ = ตัดทิ้ง
 *   (entry ประเภท tool result กับคำแทรก user บางตัวไม่มี sentAt — ตัดจากขอบที่หาได้)
 * คำแทรก role='user' (system/reminder) ไม่ใช่กิจกรรมเอเจนต์ → ข้าม
 * อ่านเฉพาะโครงสร้าง: role / content[].type / toolName / exitCode / errorMessage / sentAt
 * แตะเนื้อหาคำสั่งแค่ตอนจำแนกว่าเป็นเทสต์ แล้วทิ้งทันที (ไม่เก็บไม่พิมพ์)
 * @returns {Array<{kind,toolName,status,exitCode,test}>}
 */
function buildLiveEvents(harnessState, turnStart) {
  if (typeof harnessState !== 'string' || !harnessState) return [];
  let h;
  try { h = JSON.parse(harnessState); } catch { return []; }
  const mh = h && h.sessionState && h.sessionState.mainAgentState && h.sessionState.mainAgentState.messageHistory;
  if (!Array.isArray(mh)) return [];
  const tsOf = (m) => (m && typeof m.sentAt === 'number') ? m.sentAt : null;

  // หาขอบเทิร์น: index หลัง entry ที่มี sentAt ล่าสุดซึ่งยังเก่ากว่าเทิร์นนี้
  let start = 0;
  if (turnStart) {
    for (let i = 0; i < mh.length; i++) { const ts = tsOf(mh[i]); if (ts != null && ts < turnStart) start = i + 1; }
    // ข้าม tool result/คำแทรกไร้ timestamp ที่ค้างติดขอบ (เป็นของเทิร์นก่อน) — หยุดที่ entry แรกที่เป็นของเทิร์นนี้
    while (start < mh.length && tsOf(mh[start]) == null && (!mh[start] || mh[start].role !== 'assistant')) start++;
  }

  const events = [];
  for (let i = mh.length - 1; i >= start && events.length < 40; i--) {
    const m = mh[i];
    if (!m || typeof m !== 'object') continue;
    if (m.role === 'user') continue;               // พรอมป์ต/คำแทรก user = ไม่ใช่กิจกรรมเอเจนต์

    if (m.role === 'tool') {                       // ผลลัพธ์เครื่องมือที่เพิ่งเสร็จ
      const c = Array.isArray(m.content) ? m.content[0] : null;
      let status = 'success', exitCode = null, test = false;
      if (c && c.type === 'json' && c.value && typeof c.value === 'object') {
        if ('errorMessage' in c.value) status = 'failure';
        if (typeof c.value.exitCode === 'number') {
          exitCode = c.value.exitCode;
          if (exitCode !== 0) status = 'failure';
        }
        if (typeof c.value.command === 'string') test = isTestCommand(c.value.command);  // จำแนกแล้วทิ้ง
      }
      events.push({ kind: 'tool', toolName: m.toolName || null, status, exitCode, test });
      continue;
    }

    if (m.role === 'assistant' && Array.isArray(m.content)) {
      for (let j = m.content.length - 1; j >= 0; j--) {
        const b = m.content[j];
        if (!b || typeof b !== 'object' || !b.type) continue;
        if (b.type === 'reasoning') events.push({ kind: 'reasoning', toolName: null, status: null, exitCode: null, test: false });
        else if (b.type === 'text') events.push({ kind: 'text', toolName: null, status: null, exitCode: null, test: false });
        else if (b.type === 'tool-call') {
          const ev = { kind: 'tool', toolName: b.toolName || null, status: null, exitCode: null, test: false };
          if (ev.toolName === 'run_terminal_command' && b.input && typeof b.input.command === 'string') {
            ev.test = isTestCommand(b.input.command);   // แตะเนื้อหาแค่นี้ แล้วทิ้ง
          }
          events.push(ev);
        }
      }
    }
  }
  return events;
}

/**
 * จำแนกสถานะจากอีเวนต์ (ใหม่→เก่า): เจออันแรกที่ตัดสินได้ = ใช้เลย
 * @returns {{status,message,reason}|null} null = ไม่มีสัญญาณตัดสิน (ข้ามไปเทิร์นเริ่ม)
 */
function classify(events) {
  for (const e of events || []) {
    if (e.kind === 'tool') {
      if (e.status === 'failure' || (e.exitCode != null && e.exitCode !== 0)) {
        return { status: 'error', message: MSG.err, reason: `tool-fail:${e.toolName || '?'}${e.exitCode != null ? `(exit=${e.exitCode})` : ''}` };
      }
      if (e.test && e.exitCode === 0) {
        return { status: 'success', message: MSG.success, reason: 'test-pass' };
      }
      if (e.toolName && (READ_TOOLS.has(e.toolName) || SOFT_TOOLS.has(e.toolName))) {
        return { status: 'thinking', message: msgForTool(e.toolName), reason: `tool:${e.toolName}` };
      }
      return { status: 'coding', message: msgForTool(e.toolName), reason: `tool:${e.toolName || '?'}` };
    }
    if (e.kind === 'reasoning') return { status: 'thinking', message: MSG.think, reason: 'reasoning' };
    if (e.kind === 'text') return { status: 'thinking', message: MSG.text, reason: 'text' };
    if (e.kind === 'changes') return { status: 'coding', message: MSG.changes, reason: 'changes' };
    if (e.kind === 'agent') {
      if (e.status === 'done') continue;
      return { status: 'coding', message: MSG.agentHelp, reason: 'agent' };
    }
  }
  return null;
}

function msgForOutcome(outcome) {
  if (outcome === 'error') return MSG.doneErr;
  if (outcome === 'stopped') return MSG.doneStop;
  return MSG.doneOk;
}

/** สถานะเริ่มต้นของตัวเครื่อง (เอาไว้สร้างใหม่ในเทสต์ได้) */
function createState(opts = {}) {
  return {
    idleAfterMs: opts.idleAfterMs ?? DEFAULT_IDLE_S * 1000,
    doneType: opts.doneType || 'feature',      // ชนิดต้นไม้ตอน done (ปลูกครั้งเดียวต่อเทิร์น)
    mode: null,                                // 'rich' | 'fallback'
    initialized: false,
    running: false,                            // turn_state ของ tick ก่อนหน้า
    current: null,                             // สถานะล่าสุดที่ตัดสินแล้ว
    written: null,                             // {status,message} ที่เขียนลงไฟล์ล่าสุด
    lastWriteAt: 0,
    seenTurnFinishedAt: 0,
    seenDoneKey: null,
    lastDonePromptAt: null,               // lastPromptAt ของเทิร์นที่ปลูก done ไปแล้ว (กัน done ซ้ำสองทาง)
    lastActivityAt: 0,
    lastMtimes: 0,
    fallbackDone: false,                       // fallback: เคยปลูก done แล้วหรือยัง (ครั้งเดียว)
  };
}

/**
 * หัวใจของการแมป: sample (สัญญาณรอบนี้) + st (ความจำ) + now → การตัดสินใจ 1 ครั้ง หรือ null (ไม่เปลี่ยน)
 *
 * sample rich:   { mode:'rich', turnState, lastPromptAt, turnFinishedAt, turnOutcome, activityAt, events }
 * sample fallback:{ mode:'fallback', mtimesMax }
 */
function decide(sample, st, now) {
  if (!st.initialized) {
    st.initialized = true;
    st.mode = sample.mode;
    if (sample.mode === 'rich') {
      st.seenTurnFinishedAt = sample.turnFinishedAt || 0;
      st.seenDoneKey = null;              // ยังไม่เคยปลูก done ให้เทิร์นไหนในรอบนี้ (done ปลอมตอนเริ่ม = ห้าม)
      st.lastDonePromptAt = null;
      st.running = sample.turnState === 'running';
      st.lastActivityAt = sample.activityAt || now;
      if (sample.turnState === 'running') {
        const r = classify(sample.events) || { status: 'thinking', message: MSG.start, reason: 'turn-start' };
        st.current = r.status;
        return { ...r, first: true };
      }
      st.current = 'idle';
      return { status: 'idle', message: MSG.idle, reason: 'start-idle', first: true };
    }
    // fallback init: มีไฟล์เพิ่งเปลี่ยน (อายุไม่เกิน idleAfter) → ถือว่ากำลังทำงาน ไม่งั้น idle เฉย ๆ (ไม่ปลูก done ปลอม)
    st.lastMtimes = sample.mtimesMax || 0;
    const fresh = st.lastMtimes > 0 && now - st.lastMtimes < st.idleAfterMs;
    st.current = fresh ? 'coding' : 'idle';
    st.lastActivityAt = now;
    return fresh
      ? { status: 'coding', message: MSG.fbCoding, reason: 'start-active', first: true }
      : { status: 'idle', message: MSG.fbIdle, reason: 'start-idle', first: true };
  }

  if (sample.mode === 'rich') {
    // 1) จบเทิร์น → done "ครั้งเดียวต่อเทิร์น":
    //    - เงื่อนไข A: last_turn_finished_at มากขึ้น (เทิร์นเพิ่งจบจริง)
    //    - เงื่อนไข B: turn_state กระโดด running→idle (ค่า finished อาจยังไม่ถูกเขียน)
    //    - กันซ้ำสองชั้น: คีย์ dedupe + จำ lastPromptAt ของเทิร์นที่ปลูก done ไปแล้ว
    const finishedGrew = (sample.turnFinishedAt || 0) > st.seenTurnFinishedAt;
    const flippedToIdle = st.running && sample.turnState !== 'running';
    const notYetDoneThisTurn = st.lastDonePromptAt !== (sample.lastPromptAt || 0);
    if ((finishedGrew || flippedToIdle) && notYetDoneThisTurn) {
      st.seenTurnFinishedAt = Math.max(st.seenTurnFinishedAt, sample.turnFinishedAt || 0);
      st.seenDoneKey = sample.turnFinishedAt ? `f${sample.turnFinishedAt}` : `t${sample.lastPromptAt || 0}`;
      st.lastDonePromptAt = sample.lastPromptAt || 0;
      st.running = sample.turnState === 'running';
      st.current = 'done';
      return { status: 'done', message: msgForOutcome(sample.turnOutcome), reason: flippedToIdle && !finishedGrew ? 'turn-idle' : 'turn-finished', taskType: st.doneType };
    }
    st.running = sample.turnState === 'running';

    // 2) ยังทำงานอยู่ → แมปจากอีเวนต์ล่าสุด
    if (sample.turnState === 'running') {
      const r = classify(sample.events) || { status: 'thinking', message: MSG.start, reason: 'turn-start' };
      st.current = r.status;
      st.lastActivityAt = sample.activityAt || now;
      return r;
    }

    // 3) เทิร์นว่าง + เงียบครบเวลา → idle
    const quiet = now - (sample.activityAt || 0);
    if (quiet >= st.idleAfterMs && st.current !== 'idle') {
      st.current = 'idle';
      return { status: 'idle', message: MSG.idle, reason: `quiet:${Math.round(quiet / 1000)}s` };
    }
    return null;
  }

  /* ---------- fallback: ดูแค่ว่ามีไฟล์เปลี่ยนไหม ---------- */
  if ((sample.mtimesMax || 0) > st.lastMtimes) {
    st.lastMtimes = sample.mtimesMax;
    st.lastActivityAt = now;
    st.fallbackDone = false;   // มีงานใหม่ → อนุญาตให้ปลูก done อีกได้ในรอบเงียบถัดไป
    if (st.current !== 'coding') {
      st.current = 'coding';
      return { status: 'coding', message: MSG.fbCoding, reason: 'file-changed' };
    }
    return null;
  }
  const quiet = now - st.lastActivityAt;
  if (quiet >= st.idleAfterMs) {
    if (st.current === 'coding' && !st.fallbackDone) {
      st.fallbackDone = true;
      st.current = 'done';
      return { status: 'done', message: MSG.fbDone, reason: `quiet:${Math.round(quiet / 1000)}s`, taskType: st.doneType };
    }
    if (st.current !== 'idle') {
      st.current = 'idle';
      return { status: 'idle', message: MSG.fbIdle, reason: `quiet:${Math.round(quiet / 1000)}s` };
    }
  }
  return null;
}

/* ============================ ชั้นอ่านข้อมูล Freebuff (อ่านอย่างเดียว) ============================ */

let sqliteWarnSilenced = false;
function silenceSqliteWarning() {
  if (sqliteWarnSilenced) return;
  sqliteWarnSilenced = true;
  const orig = process.emit;
  process.emit = function (name, data) {
    if (name === 'warning' && data && data.name === 'ExperimentalWarning' && /sqlite/i.test(String(data.message))) return false;
    return orig.apply(process, arguments);
  };
}

/** หา desktop-v2.db ล่าสุดใต้ ~/.config/freebuff-desktop/projects/ (หรือตาม FREEBUFF_DB) */
function findDb() {
  const forced = process.env.FREEBUFF_DB;
  if (forced) { try { fs.accessSync(forced); return forced; } catch { return null; } }
  const base = path.join(os.homedir(), '.config', 'freebuff-desktop', 'projects');
  let best = null, bestM = -1;
  try {
    for (const ent of fs.readdirSync(base, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const p = path.join(base, ent.name, 'desktop-v2.db');
      try { const s = fs.statSync(p); if (s.mtimeMs > bestM) { bestM = s.mtimeMs; best = p; } } catch { /* ข้าม */ }
    }
  } catch { /* ไม่มีโฟลเดอร์ → null */ }
  return best;
}

function openDb(dbPath) {
  silenceSqliteWarning();
  const { DatabaseSync } = require('node:sqlite');   // มาพร้อม Node ≥ 22 — ไม่ใช่ dependency ภายนอก
  return new DatabaseSync(dbPath, { readOnly: true }); // readOnly = ไม่มีทางเขียนแตะไฟล์ Freebuff
}

/*
 * ตาราง/คอลัมน์ที่โค้ดข้างล่างใช้จริง — ถ้าตัวใดหายไป แปลว่า Freebuff เปลี่ยนรูปแบบข้อมูล
 * และคิวรีของเราจะพังเงียบ ๆ (หรือได้ค่าเปล่า) จึงตรวจก่อนเริ่มอ่านทุกครั้ง
 * (เก็บแค่ "ชื่อ" ตาราง/คอลัมน์ ไม่มีข้อมูลของผู้ใช้)
 */
const REQUIRED_SCHEMA = {
  threads: ['id', 'status', 'turn_state', 'last_prompt_at', 'last_turn_finished_at', 'last_turn_outcome', 'turn_alive_at', 'harness_state'],
  messages: ['thread_id', 'seq', 'ts', 'role', 'parts_json'],
};

class SchemaChangedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SchemaChangedError';
  }
}

/**
 * ตรวจว่า DB ยังมีตาราง/คอลัมน์ที่ต้องใช้ครบ (ดูอย่างเดียว — PRAGMA อ่าน schema ไม่แตะข้อมูล)
 * @throws {SchemaChangedError} เมื่อรูปแบบข้อมูลเปลี่ยนจนอ่านไม่ได้
 */
function checkSchema(db) {
  for (const [table, columns] of Object.entries(REQUIRED_SCHEMA)) {
    let rows;
    try {
      rows = db.prepare(`PRAGMA table_info(${table})`).all();
    } catch (e) {
      throw new SchemaChangedError(`อ่านตาราง ${table} ไม่ได้ (${e.message})`);
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new SchemaChangedError(`ไม่พบตาราง ${table}`);
    }
    const have = new Set(rows.map((r) => r && r.name));
    const missing = columns.filter((c) => !have.has(c));
    if (missing.length) {
      throw new SchemaChangedError(`ตาราง ${table} ขาดคอลัมน์: ${missing.join(', ')}`);
    }
  }
  return true;
}

/**
 * อ่านสัญญาณรอบนี้จาก DB: เธรดที่กำลังทำงาน (หรือล่าสุด) + อีเวนต์ล่าสุดของเทิร์น
 * คิวรีเล็ก (LIMIT) ถี่แค่ไหนก็ไม่หนัก — ไม่เขียนอะไรทั้งสิ้น
 */
function sampleFromDb(db) {
  const thread = db.prepare(
    `SELECT id, turn_state, last_prompt_at, last_turn_finished_at, last_turn_outcome, turn_alive_at,
            CASE WHEN turn_state = 'running' THEN harness_state ELSE NULL END AS harness_state
       FROM threads WHERE status = 'open'
      ORDER BY (turn_state = 'running') DESC, COALESCE(last_prompt_at, 0) DESC
      LIMIT 1`
  ).get();

  if (!thread) {
    return { mode: 'rich', turnState: 'idle', lastPromptAt: 0, turnFinishedAt: 0, turnOutcome: null, activityAt: 0, events: [] };
  }

  const turnStart = thread.last_prompt_at || 0;
  const msgs = db.prepare(
    `SELECT seq, ts, role, parts_json FROM messages
      WHERE thread_id = ? ORDER BY seq DESC LIMIT 6`
  ).all(thread.id);

  const running = (thread.turn_state || 'idle') === 'running';
  const msgEvents = buildEvents(msgs, turnStart);          // ข้อมูลที่ flush แล้ว (แม่นยำ รวมเหตุการณ์จบเทิร์น)
  // ยังวิ่งอยู่ → เสริมด้วย messageHistory สด (ตาราง messages ยังไม่ flush) · เทิร์นจบแล้ว → messages พอ
  const events = running ? buildLiveEvents(thread.harness_state, turnStart).concat(msgEvents) : msgEvents;
  const newestTs = msgs.length && turnStart && msgs[0].ts >= turnStart ? msgs[0].ts : 0;

  let activityAt = Math.max(turnStart, thread.last_turn_finished_at || 0, newestTs);
  if (running) activityAt = Math.max(activityAt, thread.turn_alive_at || 0);

  return {
    mode: 'rich',
    turnState: thread.turn_state || 'idle',
    lastPromptAt: turnStart,
    turnFinishedAt: thread.last_turn_finished_at || 0,
    turnOutcome: thread.last_turn_outcome || null,
    activityAt,
    events,
  };
}

/** โหมดสำรอง: mtime ล่าสุดของไฟล์ข้อมูล Freebuff (ไม่ต้องพึ่ง sqlite) */
function sampleFromMtimes(dbPath) {
  const candidates = [];
  if (dbPath) candidates.push(dbPath, dbPath + '-wal');
  candidates.push(path.join(os.homedir(), '.config', 'freebuff-desktop', 'state.json'));
  let max = 0;
  for (const p of candidates) {
    try { const s = fs.statSync(p); if (s.mtimeMs > max) max = s.mtimeMs; } catch { /* ข้าม */ }
  }
  return { mode: 'fallback', mtimesMax: max };
}

/* ============================ เครื่องหลัก ============================ */

const USAGE = `วิธีใช้: node adapters/freebuff/watch.js [ตัวเลือก]

  เฝ้าดู Freebuff แล้วอัปเดต status.json ให้เอง (อ่านอย่างเดียว ไม่แตะไฟล์ Freebuff ไม่ออกไปเน็ต)

  --interval=<ms>   รอบที่ตรวจ (ค่าเริ่มต้น ${DEFAULT_INTERVAL_MS})
  --idle=<วินาที>     เงียบนานเท่านี้เข้า idle (ค่าเริ่มต้น ${DEFAULT_IDLE_S})
  --window="<ชื่อ>"  ชื่อหน้าต่างให้ desktop pet กระโดดไป (ค่าเริ่มต้น "${DEFAULT_WINDOW}")
  --trace=<path>    ไฟล์บันทึกการเปลี่ยนสถานะ (ค่าเริ่มต้น adapters/freebuff/trace.log)
  --pet             เปิด desktop pet (npm start ใน desktop/) พร้อมกัน
  --once            สุ่ม 1 ครั้งแล้วจบ (ดีบัก)
  --no-plant        ตอน done ไม่ปลูกต้นไม้ลง garden.json
  --fallback        ไม่เปิด DB เลย ใช้โหมดสำรอง (ดูแค่เวลาแก้ไขไฟล์) ตั้งแต่ต้น
  --help            ดูวิธีใช้

  สั่งหยุด:  echo > adapters/freebuff/watch.stop   (หรือกด Ctrl+C) — จะปิด DB + desktop pet ให้เรียบร้อย

  env: FREEBUFF_DB / FREEBUFF_WINDOW / FREEBUFF_IDLE_S / FREEBUFF_INTERVAL_MS / FREEBUFF_DONE_TYPE
  หรือเรียงกล้วย: npm run freebuff`;

function parseArgs(argv) {
  const a = { interval: DEFAULT_INTERVAL_MS * 1, idle: DEFAULT_IDLE_S * 1, window: DEFAULT_WINDOW, trace: path.join(__dirname, 'trace.log'), pet: false, once: false, plant: true, fallback: false, help: false };
  for (const raw of argv) {
    if (raw === '--pet') a.pet = true;
    else if (raw === '--once') a.once = true;
    else if (raw === '--no-plant') a.plant = false;
    else if (raw === '--fallback') a.fallback = true;
    else if (raw === '--help' || raw === '-h') a.help = true;
    else if (raw.startsWith('--interval=')) a.interval = Math.max(250, Number(raw.slice(11)) || a.interval);
    else if (raw.startsWith('--idle=')) a.idle = Math.max(1, Number(raw.slice(7)) || a.idle);
    else if (raw.startsWith('--window=')) a.window = raw.slice(9);
    else if (raw.startsWith('--trace=')) a.trace = path.resolve(raw.slice(8));
  }
  if (process.env.FREEBUFF_WINDOW) a.window = process.env.FREEBUFF_WINDOW;
  if (process.env.FREEBUFF_IDLE_S) a.idle = Math.max(1, Number(process.env.FREEBUFF_IDLE_S) || a.idle);
  if (process.env.FREEBUFF_INTERVAL_MS) a.interval = Math.max(250, Number(process.env.FREEBUFF_INTERVAL_MS) || a.interval);
  if (process.env.FREEBUFF_DONE_TYPE) a.doneType = process.env.FREEBUFF_DONE_TYPE;
  return a;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(USAGE); return; }

  const st = createState({ idleAfterMs: args.idle * 1000, doneType: args.doneType });
  let db = null, dbPath = null, tickN = 0, stopped = false;
  let pet = null;

  /* trace: เวลา + สถานะ + เหตุผล + โหมด — ไม่มีเนื้อหาข้อความ/คำสั่ง/โค้ด ทั้งสิ้น */
  const trace = (line) => {
    try { fs.appendFileSync(args.trace, `${new Date().toISOString()}\t${line}\n`, 'utf8'); } catch { /* trace พลาดได้ ไม่หยุดงาน */ }
    console.log(`[watch] ${new Date().toLocaleTimeString()} ${line}`);
  };

  const applyDecision = (d) => {
    const now = Date.now();
    const prev = st.written;
    const statusChanged = !prev || prev.status !== d.status;
    const msgChanged = !prev || prev.message !== d.message;
    if (!statusChanged && !msgChanged) return;
    if (!statusChanged && now - st.lastWriteAt < args.interval) return;   // debounce ฝั่งข้อความเปลี่ยนอย่างเดียว
    try {
      setStatus(d.status, d.message, d.taskType || undefined, {
        window: args.window,          // ← ฟิลด์ window ให้คลิกน้องส้มเด้งไปหน้าต่าง Freebuff
        plant: args.plant,
        ttlMinutes: undefined,
      });
      st.written = { status: d.status, message: d.message };
      st.lastWriteAt = now;
      if (statusChanged) trace(`${d.status}\t${d.reason || '-'}\t${st.mode || '?'}`);
    } catch (e) {
      console.error(`[watch] เขียน status.json ไม่สำเร็จ: ${e.message}`);
    }
  };

  const heartbeat = () => {
    const now = Date.now();
    if (!st.written || now - st.lastWriteAt < HEARTBEAT_MS) return;
    if (st.written.status === 'idle' || st.written.status === 'done') return; // สองสถานะนี้ไม่ต้องยืดอายุ
    try {
      setStatus(st.written.status, st.written.message, undefined, { window: args.window, plant: false });
      st.lastWriteAt = now;   // เขียนเงียบ ๆ (ไม่ trace) เพื่อคืนค่า updatedAt กันหน้าเว็บหลับ
    } catch { /* ครั้งหน้าลองใหม่ */ }
  };

  /* รูปแบบข้อมูลของ Freebuff เปลี่ยน → หยุดตัวเองทันที พร้อมบอกว่าอะไรหาย (ไม่เดาสถานะต่อ) */
  const schemaStop = (err) => {
    const lines = [
      '',
      '⚠️  รูปแบบฐานข้อมูลของ Freebuff เปลี่ยน — ตัวเฝ้าดูอ่านต่อไม่ได้ จึงหยุดตัวเองแล้ว',
      `   ${err.message}`,
      '   ที่คาดหวัง: ~/.config/freebuff-desktop/projects/<project>/desktop-v2.db (ตาราง threads + messages)',
      '   ถ้ายังอยากใช้โหมดสำรอง (ดูแค่ว่าไฟล์เปลี่ยน) ให้รันใหม่ด้วย --fallback',
      '   ระหว่างนี้ใช้ node set-status.js เองได้ตามปกติ (ไม่มีอะไรเขียนทับ)',
      '',
      '⚠️  The Freebuff database layout changed — the watcher cannot read it and cleaned up after itself.',
      `   ${err.message}`,
      '   Re-run with --fallback to use change-only (mtime) mode instead.',
      '',
    ];
    console.error(lines.join('\n'));
    try { trace(`schema-change\t${err.message}`); } catch { /* trace พลาดได้ */ }
    finish(2);
  };

  const tick = () => {
    if (stopped) return;
    if (fs.existsSync(STOP_FILE)) { finish(0); return; }   // มีไฟล์คำสั่งหยุด → ปิดตัวแบบสะอาด
    tickN++;
    let sample;
    try {
      if (args.fallback) {
        sample = sampleFromMtimes(dbPath || (dbPath = findDb()));   // ผู้ใช้เลือกโหมดสำรองเอง
      } else {
        if (!db) {
          dbPath = findDb();
          if (!dbPath) throw new Error('no-db');
          db = openDb(dbPath);
          checkSchema(db);
        }
        if (tickN % DB_RESOLVE_EVERY === 0) {           // เช็ก path ใหม่เป็นระยะ (อัปเดตแอปฯ ย้าย DB ได้)
          const fresh = findDb();
          if (fresh && fresh !== dbPath) {
            try { db.close(); } catch { /* */ }
            dbPath = fresh;
            db = openDb(dbPath);
            checkSchema(db);
          }
        }
        sample = sampleFromDb(db);
      }
    } catch (e) {
      if (e instanceof SchemaChangedError) { schemaStop(e); return; }
      if (db) { try { db.close(); } catch { /* */ } db = null; dbPath = findDb(); }
      sample = sampleFromMtimes(dbPath);   // อ่าน DB ไม่ได้ → fallback: ดูความเคลื่อนไหวของไฟล์
    }

    if (sample.mode !== st.mode && st.mode !== null) trace(`mode\t${st.mode}→${sample.mode}`);
    const decision = decide(sample, st, Date.now());
    if (decision) applyDecision(decision); else heartbeat();
  };

  trace(`start\tmode=${args.fallback ? 'fallback (บังคับด้วย --fallback)' : 'auto (rich|fallback จะระบุในบรรทัดสถานะแรก)'}\tinterval=${args.interval}ms\tidle=${args.idle}s\twindow=${args.window}`);
  try { fs.unlinkSync(STOP_FILE); } catch { /* ไม่มีไฟล์ค้างอยู่ก็ไม่เป็นไร */ }

  if (args.pet) {
    // เปิด desktop pet: เรียกไบนารี electron ตรง ๆ (ไม่ผ่าน shell) จะได้สั่งปิดได้สะอาดทุก OS
    // ถ้าหา electron ไม่เจอ → เถลไปใช้ npm start ใน desktop/ ตามเดิม
    let petCmd, petArgs;
    const petOpts = { cwd: path.join(ROOT, 'desktop'), stdio: 'inherit' };
    try {
      petCmd = require(path.join(ROOT, 'desktop', 'node_modules', 'electron'));
      petArgs = ['.'];
    } catch {
      petCmd = 'npm';
      petArgs = ['start'];
      if (process.platform === 'win32') petOpts.shell = true;
    }
    pet = spawn(petCmd, petArgs, petOpts);
    pet.on('error', (e) => console.log(`[watch] เปิด desktop pet ไม่สำเร็จ: ${e.message} — เฝ้าดูต่อเหมือนเดิม`));
    pet.on('exit', (code) => { if (!stopped) console.log(`[watch] desktop pet จบ (code=${code}) — เฝ้าดูต่อเหมือนเดิม`); });
  }

  const timer = setInterval(tick, args.interval);
  tick();

  if (args.once) { clearInterval(timer); finish(0); return; }

  function finish(code) {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    if (db) { try { db.close(); } catch { /* */ } }
    if (pet && !pet.killed) { try { pet.kill(); } catch { /* */ } }
    trace(`stop\t${code}`);
    process.exit(code);
  }
  process.on('SIGINT', () => finish(0));
  process.on('SIGTERM', () => finish(0));
}

module.exports = {
  classify, decide, createState, buildEvents, buildLiveEvents, isTestCommand, msgForTool, msgForOutcome,
  findDb, sampleFromMtimes, TEST_RE, MSG, READ_TOOLS, SOFT_TOOLS, DEFAULT_WINDOW,
  checkSchema, REQUIRED_SCHEMA, SchemaChangedError, parseArgs,
};

if (require.main === module) main();
