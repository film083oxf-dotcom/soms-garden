'use strict';
/**
 * tests/freebuff-watch.test.js — เทสต์หน่วยส่วนแมปสัญญาณของ adapters/freebuff/watch.js
 *
 * ใช้ "ข้อมูลจำลอง" ล้วน ๆ (สร้าง parts/threads ปลอมในเทสต์)
 * ไม่แตะฐานข้อมูลจริง ไม่อ่านข้อความสนทนาจริงใด ๆ ทั้งสิ้น
 *
 * รัน: node --test "tests/*.test.js"
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  classify, decide, createState, buildEvents, buildLiveEvents, isTestCommand, msgForTool, msgForOutcome,
  TEST_RE, MSG, DEFAULT_WINDOW, checkSchema, REQUIRED_SCHEMA, SchemaChangedError, parseArgs,
} = require(path.join(__dirname, '..', 'adapters', 'freebuff', 'watch.js'));
const { setStatus, STATUSES } = require(path.join(__dirname, '..', 'set-status.js'));

/* ---------- ตัวช่วยสร้างสัญญาณจำลอง ---------- */
const tool = (toolName, opts = {}) => ({ kind: 'tool', toolName, status: opts.status || null, exitCode: opts.exitCode ?? null, test: !!opts.test });
const reasoning = () => ({ kind: 'reasoning' });
const text = () => ({ kind: 'text' });

function richSample(over = {}) {
  return {
    mode: 'rich',
    turnState: 'running',
    lastPromptAt: 1000,
    turnFinishedAt: 0,
    turnOutcome: null,
    activityAt: Date.now(),
    events: [reasoning()],
    ...over,
  };
}

/* ==================== 1) classify: สัญญาณ → สถานะ ==================== */

test('classify: reasoning → thinking (กำลังคิด)', () => {
  assert.equal(classify([reasoning()]).status, 'thinking');
});

test('classify: เครื่องมืออ่าน/ค้น → thinking', () => {
  for (const t of ['read_files', 'code_search', 'glob', 'list_directory', 'web_search', 'preview_screenshot']) {
    assert.equal(classify([tool(t, { status: 'success', exitCode: 0 })]).status, 'thinking', t);
  }
});

test('classify: เครื่องมือวางแผน/ถาม → thinking', () => {
  for (const t of ['write_todos', 'ask_questions', 'suggest_prompts']) {
    assert.equal(classify([tool(t, { status: 'success' })]).status, 'thinking', t);
  }
});

test('classify: รันคำสั่งที่ไม่ใช่เทสต์ (สำเร็จ) → coding', () => {
  const r = classify([tool('run_terminal_command', { status: 'success', exitCode: 0 })]);
  assert.equal(r.status, 'coding');
});

test('classify: แก้ไฟล์ str_replace / write_file → coding', () => {
  assert.equal(classify([tool('str_replace', { status: 'success' })]).status, 'coding');
  assert.equal(classify([tool('write_file', { status: 'success' })]).status, 'coding');
});

test('classify: เครื่องมือไม่รู้จัก → coding (ปลอดภัยสุด = ลงมือทำ)', () => {
  assert.equal(classify([tool('some_future_tool', { status: 'success' })]).status, 'coding');
});

test('classify: คำสั่งล้มเหลว (status=failure / exit≠0) → error', () => {
  assert.equal(classify([tool('run_terminal_command', { status: 'failure' })]).status, 'error');
  assert.equal(classify([tool('run_terminal_command', { exitCode: 1 })]).status, 'error');
  assert.equal(classify([tool('str_replace', { status: 'failure', exitCode: 1 })]).status, 'error');
});

test('classify: เทสต์ผ่าน (test + exit=0) → success', () => {
  const r = classify([tool('run_terminal_command', { status: 'success', exitCode: 0, test: true })]);
  assert.equal(r.status, 'success');
  assert.equal(r.reason, 'test-pass');
});

test('classify: เทสต์ยังวิ่งอยู่ (exitCode ยังไม่มา) → coding ไม่ใช่ success', () => {
  const r = classify([tool('run_terminal_command', { status: null, exitCode: null, test: true })]);
  assert.equal(r.status, 'coding');
});

test('classify: เทสต์พัง (test + exit≠0) → error (ความล้มเหลวมาก่อน)', () => {
  const r = classify([tool('run_terminal_command', { status: 'failure', exitCode: 1, test: true })]);
  assert.equal(r.status, 'error');
});

test('classify: อีเวนต์ใหม่สุดตัดสินก่อน (เรียงใหม่→เก่า)', () => {
  // ใหม่สุด = เหตุการณ์แรกในอาร์เรย์
  const errThenRun = classify([tool('run_terminal_command', { exitCode: 0 }), tool('run_terminal_command', { exitCode: 1 })]);
  assert.equal(errThenRun.status, 'coding');           // คำสั่งล่าสุดสำเร็จ → coding ทับความล้มเหลวเก่า
  const runThenErr = classify([tool('run_terminal_command', { exitCode: 1 }), tool('run_terminal_command', { exitCode: 0 })]);
  assert.equal(runThenErr.status, 'error');            // ล่าสุดพัง → error
});

test('classify: text → thinking, changes → coding, agent:done ถูกข้าม', () => {
  assert.equal(classify([text()]).status, 'thinking');
  assert.equal(classify([{ kind: 'changes' }]).status, 'coding');
  assert.equal(classify([{ kind: 'agent', status: 'done' }, reasoning()]).status, 'thinking');
});

test('classify: ไม่มีสัญญาณ → null (ค่าเริ่มต้นด้วย turn-start)', () => {
  assert.equal(classify([]), null);
  assert.equal(classify([{ kind: 'notice' }]), null);   // notice/ad/compaction ไม่ใช่สัญญาณ
});

/* ==================== 2) isTestCommand: จำแนกคำสั่งทดสอบ ==================== */

test('isTestCommand: จำแนกคำสั่งเทสต์ยอดนิยม', () => {
  for (const cmd of [
    'node --test "tests/*.test.js"',
    'set -o pipefail; node --test "tests/*.test.js" 2>&1 | tail -5',
    'npm test',
    'cd desktop && npm test',
    'npx vitest run',
    'pytest -q',
    'cargo test',
    'go test ./...',
  ]) {
    assert.equal(isTestCommand(cmd), true, cmd);
  }
});

test('isTestCommand: คำสั่งปกติไม่ใช่เทสต์ / ค่าไม่ใช่สตริง → false', () => {
  assert.equal(isTestCommand('git status'), false);
  assert.equal(isTestCommand('ls -la'), false);
  assert.equal(isTestCommand(undefined), false);
  assert.equal(isTestCommand(null), false);
  assert.equal(isTestCommand(42), false);
});

/* ==================== 3) buildEvents: แปลงข้อความจำลอง → อีเวนต์ ==================== */

test('buildEvents: เรียงใหม่→เก่า ข้ามเทิร์นเก่า และกรอง kind ที่ไม่ใช่สัญญาณ', () => {
  const msgs = [
    { ts: 5000, role: 'assistant', parts_json: JSON.stringify([{ kind: 'tool', toolName: 'str_replace', status: 'success' }, { kind: 'notice' }]) },
    { ts: 4000, role: 'assistant', parts_json: JSON.stringify([{ kind: 'reasoning' }]) },
    { ts: 900, role: 'user', parts_json: JSON.stringify([{ kind: 'text', text: 'ข้อความเก่าจากเทิร์นก่อน' }]) }, // เก่ากว่า turnStart
  ];
  const ev = buildEvents(msgs, 1000);
  assert.deepEqual(ev.map((e) => e.kind), ['tool', 'reasoning']);   // notice ถูกกรอง, เทิร์นเก่าถูกตัด
  assert.equal(ev[0].toolName, 'str_replace');
});

test('buildEvents: ตั้ง flag test จากคำสั่งจำลอง (ไม่เก็บเนื้อหา แค่ true/false)', () => {
  const msgs = [{
    ts: 5000, role: 'assistant',
    parts_json: JSON.stringify([
      { kind: 'tool', toolName: 'run_terminal_command', status: 'success', exitCode: 0, input: { command: 'node --test "tests/*.test.js"' } },
      { kind: 'tool', toolName: 'run_terminal_command', status: 'success', exitCode: 0, input: { command: 'git status --short' } },
    ]),
  }];
  const ev = buildEvents(msgs, 1000);
  assert.deepEqual(ev.map((e) => e.test), [false, true]);           // ใหม่→เก่า
  assert.equal(classify(ev).status, 'coding');                      // ล่าสุดไม่ใช่เทสต์
});

test('buildEvents: parts_json พัง → ข้ามไม่ crash', () => {
  const ev = buildEvents([{ ts: 5000, role: 'assistant', parts_json: '{not json' }, { ts: 6000, role: 'assistant', parts_json: JSON.stringify([{ kind: 'reasoning' }]) }], 0);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].kind, 'reasoning');
});

test('buildEvents: ข้อความ user (role=user) ไม่ใช่กิจกรรมเอเจนต์ → ไม่กลายเป็น event (กลางเทิร์นต้องไม่ค้าง thinking/text)', () => {
  // เทิร์นเพิ่งเริ่ม: มีแค่ข้อความผู้ใช้ (ts == turnStart) → ต้องได้ [] ไม่ใช่ text event
  assert.deepEqual(buildEvents([
    { ts: 6000, role: 'user', parts_json: JSON.stringify([{ kind: 'text', text: 'คำสั่งงานของผู้ใช้' }]) },
  ], 6000).map((e) => e.kind), []);

  // มีทั้งสอง: ใช้เฉพาะของ assistant
  const ev = buildEvents([
    { ts: 6005, role: 'assistant', parts_json: JSON.stringify([{ kind: 'tool', toolName: 'str_replace', status: 'success' }]) },
    { ts: 6000, role: 'user', parts_json: JSON.stringify([{ kind: 'text' }]) },
  ], 6000);
  assert.deepEqual(ev.map((e) => e.kind), ['tool']);
});

/* ============ 3b) buildLiveEvents: สัญญาณสดจาก harness_state.messageHistory ============ */

const hs = (entries) => JSON.stringify({ sessionState: { mainAgentState: { messageHistory: entries } } });
const asst = (content, sentAt) => ({ role: 'assistant', content, ...(typeof sentAt === 'number' ? { sentAt } : {}) });
const toolResult = (toolName, value) => ({ role: 'tool', toolName, content: [{ type: 'json', value }] });  // tool result จริงไม่มี sentAt
const prompt = (sentAt) => ({ role: 'user', content: [{ type: 'text', text: 'งาน' }], sentAt });
const keylessUser = () => ({ role: 'user', content: [{ type: 'text', text: 'คำแทรกไร้ timestamp' }] });
const TURN = 1000;

test('buildLiveEvents: เทสต์ผ่าน (exit=0 + คำสั่งเทสต์) → classify = success สดระหว่างเทิร์น', () => {
  const h = hs([
    asst([{ type: 'reasoning' }], 500),                                   // เทิร์นก่อน (เก่ากว่า TURN) → ตัด
    prompt(TURN),
    asst([{ type: 'reasoning' }], 1100),
    asst([{ type: 'tool-call', toolName: 'run_terminal_command', input: { command: 'node --test "tests/*.test.js"' } }], 1200),
    toolResult('run_terminal_command', { command: 'node --test "tests/*.test.js"', stdout: '...', exitCode: 0 }),
    keylessUser(),                                                        // คำแทรกท้าย array (ของจริงเป็นแบบนี้) → ข้าม
  ]);
  const ev = buildLiveEvents(h, TURN);
  assert.equal(ev.length, 3);
  assert.equal(ev[0].kind, 'tool');
  assert.equal(ev[0].exitCode, 0);
  assert.equal(ev[0].test, true);          // จำแนกในหน่วยความจำ ไม่เก็บเนื้อหาคำสั่ง
  assert.equal(ev[1].kind, 'tool');        // tool-call ระหว่างรอผล (status=null → ยังไม่ตัดสิน)
  assert.equal(ev[1].status, null);
  assert.equal(ev[2].kind, 'reasoning');
  assert.equal(classify(ev).status, 'success');
});

test('buildLiveEvents: คำสั่งล้มเหลว (errorMessage / exit≠0) → error', () => {
  const failExit = buildLiveEvents(hs([
    prompt(TURN),
    toolResult('run_terminal_command', { command: 'x', stdout: '', exitCode: 2 }),
  ]), TURN);
  assert.equal(classify(failExit).status, 'error');

  const failMsg = buildLiveEvents(hs([
    prompt(TURN),
    toolResult('str_replace', { file: 'a.txt', errorMessage: 'boom' }),
  ]), TURN);
  assert.equal(classify(failMsg).status, 'error');
});

test('buildLiveEvents: ขอบเทิร์นด้วย sentAt — งานเทิร์นก่อน (รวม tool result ไร้ timestamp ติดขอบ) ไม่ปน', () => {
  const h = hs([
    asst([{ type: 'tool-call', toolName: 'str_replace' }], 500),          // เทิร์นก่อน
    toolResult('str_replace', { file: 'old', errorMessage: 'เก่าไม่เกี่ยว' }), // ไร้ sentAt แต่ติดขอบเก่า → ตัดด้วย
    prompt(TURN),
    asst([{ type: 'reasoning' }], 1200),
  ]);
  const ev = buildLiveEvents(h, TURN);
  assert.deepEqual(ev.map((e) => e.kind), ['reasoning']);
  assert.equal(classify(ev).status, 'thinking');
});

test('buildLiveEvents: อ่านเครื่องมือ → thinking · แก้ไฟล์ → coding · ค่าเพี้ยนไม่ crash', () => {
  const read = buildLiveEvents(hs([
    prompt(TURN),
    toolResult('read_files', [{ path: 'a' }]),
  ]), TURN);
  assert.equal(classify(read).status, 'thinking');

  const edit = buildLiveEvents(hs([
    prompt(TURN),
    toolResult('str_replace', { file: 'a', message: 'ok' }),
  ]), TURN);
  assert.equal(classify(edit).status, 'coding');

  assert.deepEqual(buildLiveEvents('{broken json', TURN), []);
  assert.deepEqual(buildLiveEvents(null, TURN), []);
  assert.deepEqual(buildLiveEvents(JSON.stringify({ sessionState: {} }), TURN), []);
});

/* ==================== 4) decide: สถานะของเครื่อง (ทำซ้ำได้ ไม่ปลูก done ซ้ำ) ==================== */

test('decide: เริ่มตอนเทิร์นกำลังวิ่ง → ใช้ classify; เริ่มตอนว่าง → idle (ไม่ปลูก done ปลอม)', () => {
  const now = Date.now();
  const st1 = createState({ idleAfterMs: 45000 });
  const d1 = decide(richSample({ events: [reasoning()] }), st1, now);
  assert.equal(d1.status, 'thinking');

  const st2 = createState({ idleAfterMs: 45000 });
  const d2 = decide(richSample({ turnState: 'idle', events: [], activityAt: now - 999999 }), st2, now);
  assert.equal(d2.status, 'idle');
  assert.notEqual(d2.status, 'done');
});

test('decide: จบเทิร์น → done ครั้งเดียว รอบถัดไปไม่ส่งซ้ำ (ไม่ปลูกต้นไม้ซ้ำ)', () => {
  const now = Date.now();
  const st = createState({ idleAfterMs: 45000 });
  decide(richSample(), st, now);                                     // init (running)

  const finished = richSample({ turnState: 'idle', turnFinishedAt: now, turnOutcome: 'completed', events: [] });
  const d1 = decide(finished, st, now + 1500);
  assert.equal(d1.status, 'done');
  assert.equal(d1.taskType, 'feature');

  assert.equal(decide(finished, st, now + 3000), null);              // ซ้ำ → ไม่มีอะไรเปลี่ยน
  assert.equal(decide(finished, st, now + 4500), null);
});

test('decide: turn_state running→idle โดยไม่เพิ่ม turnFinishedAt ก็ยังได้ done 1 ครั้ง', () => {
  const now = Date.now();
  const st = createState({ idleAfterMs: 45000 });
  decide(richSample(), st, now);
  const d1 = decide(richSample({ turnState: 'idle', events: [] }), st, now + 1500);
  assert.equal(d1.status, 'done');
  const d2 = decide(richSample({ turnState: 'idle', events: [] }), st, now + 3000);
  assert.equal(d2, null);                                            // ครั้งเดียวเท่านั้น
});

test('decide: เทิร์นยังวิ่งแต่เงียบนาน → ไม่เข้า idle (รอจบเทิร์นก่อน)', () => {
  const now = Date.now();
  const st = createState({ idleAfterMs: 45000 });
  decide(richSample({ events: [tool('str_replace', { status: 'success' })] }), st, now);
  const d = decide(richSample({ events: [tool('str_replace', { status: 'success' })], activityAt: now - 120000 }), st, now + 999999);
  assert.equal(d.status, 'coding');                                  // ยัง coding ไม่ใช่ idle
});

test('decide: เทิร์นว่าง + เงียบครบเวลา → idle', () => {
  const now = Date.now();
  const st = createState({ idleAfterMs: 45000 });
  decide(richSample(), st, now);                                     // init running
  decide(richSample({ turnState: 'idle', turnFinishedAt: now, events: [] }), st, now + 1500);  // done
  const d = decide(richSample({ turnState: 'idle', turnFinishedAt: now, events: [], activityAt: now }), st, now + 50000);
  assert.equal(d.status, 'idle');
  assert.match(d.reason, /^quiet:/);
  assert.equal(decide(richSample({ turnState: 'idle', turnFinishedAt: now, events: [], activityAt: now }), st, now + 60000), null);
});

test('decide: outcome ของเทิร์นเปลี่ยนข้อความ done', () => {
  assert.equal(msgForOutcome('error'), MSG.doneErr);
  assert.equal(msgForOutcome('stopped'), MSG.doneStop);
  assert.equal(msgForOutcome('completed'), MSG.doneOk);
  assert.equal(msgForOutcome(null), MSG.doneOk);
});

/* ---------- fallback: ไม่มี DB → ดูแค่ว่ามีไฟล์เปลี่ยนไหม ---------- */

test('decide fallback: มีไฟล์เปลี่ยน→coding · เงียบครบเวลา→done ครั้งเดียว→idle', () => {
  const now = Date.now();
  const st = createState({ idleAfterMs: 30000 });

  const d0 = decide({ mode: 'fallback', mtimesMax: now - 1000 }, st, now);   // init: เพิ่งมีไฟล์เปลี่ยน
  assert.equal(d0.status, 'coding');

  assert.equal(decide({ mode: 'fallback', mtimesMax: 100 }, st, now + 1500), null);   // ยังไม่เงียบครบ

  const d1 = decide({ mode: 'fallback', mtimesMax: 100 }, st, now + 31000);           // เงียบครบ → done
  assert.equal(d1.status, 'done');
  assert.equal(d1.taskType, 'feature');

  const d2 = decide({ mode: 'fallback', mtimesMax: 100 }, st, now + 62000);           // ต่อ → idle
  assert.equal(d2.status, 'idle');
  assert.equal(decide({ mode: 'fallback', mtimesMax: 100 }, st, now + 99000), null);  // ไม่ done ซ้ำ

  decide({ mode: 'fallback', mtimesMax: now + 50000 }, st, now + 100000);              // มีไฟล์อีก (mtime ใหม่กว่าเดิม) → coding
  assert.equal(st.current, 'coding');
});

test('decide fallback: เริ่มมาเงียบอยู่แล้ว → idle เฉย ๆ ไม่ปลูก done ปลอม', () => {
  const now = Date.now();
  const st = createState({ idleAfterMs: 30000 });
  const d = decide({ mode: 'fallback', mtimesMax: now - 600000 }, st, now);
  assert.equal(d.status, 'idle');
  assert.equal(st.fallbackDone, false);
});

/* ==================== 5) ข้อความ/status ถูกต้องตามกติกา AGENTS.md ==================== */

test('ข้อความทุกสถานะ: ≤40 ตัวอักษร ไม่มีเครื่ององคำพูดซ้ำ ไม่ขึ้นบรรทัดใหม่', () => {
  for (const [key, msg] of Object.entries(MSG)) {
    assert.ok(msg.length <= 40, `${key} ยาว ${msg.length} ตัวอักษร`);
    assert.ok(!msg.includes('"') && !msg.includes("'"), `${key} มีเครื่องหมายคำพูด`);
    assert.ok(!msg.includes('\n'), `${key} มีขึ้นบรรทัดใหม่`);
  }
});

test('สถานะที่ adapter เขียนได้ = ชุดสถานะที่ set-status รับ', () => {
  const produced = new Set(['thinking', 'coding', 'success', 'error', 'done', 'idle']);
  for (const s of produced) assert.ok(STATUSES.includes(s), s);
});

test('msgForTool: ตรงชนิดเครื่องมือ', () => {
  assert.equal(msgForTool('run_terminal_command'), MSG.term);
  assert.equal(msgForTool('str_replace'), MSG.edit);
  assert.equal(msgForTool('write_file'), MSG.edit);
  assert.equal(msgForTool('preview_click'), MSG.preview);
  assert.equal(msgForTool('unknown'), MSG.work);
});

/* ==================== 6) ฝั่งเขียนไฟล์: มีฟิลด์ window ให้กระโดดไปหน้าต่าง Freebuff ==================== */

test('setStatus (ที่ adapter เรียก) ใส่ฟิลด์ window ลง status.json ด้วย', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'som-watch-'));
  const statusFile = path.join(dir, 'status.json');
  const gardenFile = path.join(dir, 'garden.json');
  try {
    setStatus('coding', 'กำลังแก้ไฟล์อยู่', undefined, { statusFile, gardenFile, window: DEFAULT_WINDOW, plant: false });
    const rec = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    assert.equal(rec.window, 'Freebuff Desktop');
    assert.equal(rec.status, 'coding');
    assert.equal(rec.message, 'กำลังแก้ไฟล์อยู่');
    assert.ok(rec.updatedAt);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('TEST_RE ตรวจจับชุดคำสั่งทดสอบโดยไม่ต้องพึ่ง capture group', () => {
  assert.ok(TEST_RE.test('node --test "tests/*.test.js"'));
  assert.ok(!TEST_RE.test('git commit -m "add tests"'));   // คำว่า tests ลอย ๆ ไม่ใช่คำสั่งเทสต์
});

/* ============ 7) ตรวจรูปแบบฐานข้อมูล: เปลี่ยนจนอ่านไม่ได้ → หยุด ไม่เดาต่อ ============ */

/** DB ปลอม: ตอบ PRAGMA table_info(<table>) จากออบเจกต์ที่ให้มา (ไม่แตะไฟล์จริง) */
function fakeDb(tables) {
  return {
    prepare(sql) {
      const m = /PRAGMA table_info\((\w+)\)/.exec(sql);
      if (!m) throw new Error('unexpected SQL');
      const cols = tables[m[1]];
      return { all: () => (cols || []).map((name) => ({ name })) };
    },
  };
}
const goodTables = () => ({
  threads: [...REQUIRED_SCHEMA.threads],
  messages: [...REQUIRED_SCHEMA.messages],
});

test('checkSchema: ตาราง/คอลัมน์ครบตามที่โค้ดใช้ → ผ่าน', () => {
  assert.equal(checkSchema(fakeDb(goodTables())), true);
});

test('checkSchema: ตารางหาย (Freebuff เปลี่ยนโครง) → SchemaChangedError บอกชื่อตาราง', () => {
  const t = goodTables();
  delete t.messages;
  assert.throws(() => checkSchema(fakeDb(t)), (e) => e instanceof SchemaChangedError && /ไม่พบตาราง messages/.test(e.message));
});

test('checkSchema: คอลัมน์ที่ใช้หาย → SchemaChangedError บอกชื่อคอลัมน์ที่ขาด', () => {
  const t = goodTables();
  t.threads = t.threads.filter((c) => c !== 'harness_state' && c !== 'turn_state');
  assert.throws(
    () => checkSchema(fakeDb(t)),
    (e) => e instanceof SchemaChangedError && /threads/.test(e.message) && /harness_state/.test(e.message) && /turn_state/.test(e.message),
  );
});

test('checkSchema: PRAGMA พัง (SQLite อ่าน schema ไม่ได้) → SchemaChangedError', () => {
  const db = { prepare() { throw new Error('file is not a database'); } };
  assert.throws(() => checkSchema(db), (e) => e instanceof SchemaChangedError && /threads/.test(e.message));
});

/* ============ 8) ตัวเฝ้าดูต้อง "เปิดเอง" — ไม่มีค่าเริ่มต้นที่เปิด pet/โหมดสำรองให้ ============ */

test('parseArgs: ค่าเริ่มต้น = ไม่เปิด pet ไม่ใช่ fallback ไม่ใช่ once', () => {
  const a = parseArgs([]);
  assert.equal(a.pet, false);
  assert.equal(a.fallback, false);
  assert.equal(a.once, false);
  assert.equal(a.plant, true);
});

test('parseArgs: --pet / --fallback ต้องสั่งเองเท่านั้น', () => {
  assert.equal(parseArgs(['--pet']).pet, true);
  assert.equal(parseArgs(['--fallback']).fallback, true);
  assert.equal(parseArgs(['--fallback', '--once']).once, true);
});
