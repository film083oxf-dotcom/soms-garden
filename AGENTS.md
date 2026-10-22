# AGENTS.md — กติกาสำหรับ AI coding agent

repo นี้มีมาสคอตชื่อ **น้องส้ม** (`index.html`) ที่อ่าน `status.json` ทุก 1 วินาที
แล้วเปลี่ยนท่าทางตามสถานะ — หน้าที่ของคุณคือ **เล่าสถานะการทำงานให้มันรู้** ด้วยคำสั่งด้านล่าง

## ทางลัด: ตัวเฝ้าดู Freebuff อัตโนมัติ (`npm run freebuff`)

ไม่อยากเรียก `set-status.js` เองทุกครั้ง? รันคำสั่งเดียว เปิด desktop pet พร้อมตัวเฝ้าดู:

```bash
npm run freebuff        # = node adapters/freebuff/watch.js --pet
```

ตัวเฝ้า (`adapters/freebuff/watch.js` · Node ล้วน ไม่มี dependency) อ่านสัญญาณจาก Freebuff desktop
แบบ **อ่านอย่างเดียว** (ฐานข้อมูล `desktop-v2.db` ใต้ `~/.config/freebuff-desktop/` — ไม่แตะไฟล์ Freebuff
ไม่ส่งข้อมูลออกเครือข่าย) แล้วเขียน `status.json` ให้เองตามตาราง (กลางเทิร์นอ่านสัญญาณสดจาก
`threads.harness_state.messageHistory` · ตอนจบเทิร์นอ่านตาราง `messages` + `turn_state`):

| สัญญาณจาก Freebuff | สถานะที่ได้ |
|---|---|
| กำลังคิด / อ่าน / ค้น (reasoning, read_files, web_search …) | `thinking` |
| รันคำสั่ง / แก้ไฟล์ (run_terminal_command, str_replace, write_file …) | `coding` |
| คำสั่งล้มเหลว (status=failure / errorMessage หรือ exit ≠ 0) | `error` |
| รันคำสั่งเทสต์แล้วผ่าน | `success` |
| จบเทิร์น (turn_state running→idle / last_turn_finished_at ขยับ) | `done` — **ครั้งเดียวต่อเทิร์น** |
| เงียบเกิน 45 วินาที (ปรับ `--idle=`) | `idle` |

ข้อควรรู้:

- **watcher ไม่ได้ติดมาอัตโนมัติ** — `npm start` (desktop pet) และ `npx serve .` ไม่เปิดมัน ต้องสั่ง `npm run freebuff` เอง
- **ระหว่าง watcher รันอยู่ อย่าเรียก `set-status.js` เอง** — สองฝ่ายเขียน status.json ทับกันได้
  (ถ้าไม่ได้เปิด watcher ก็ใช้ตารางด้านบนเรียกเองตามเดิม)
- ทุกสถานะที่ watcher เขียนแนบ `window: "Freebuff Desktop"` อยู่แล้ว — คลิกน้องส้มแล้วกระโดดไปหน้าต่าง Freebuff เลย
- สั่งหยุด: `echo > adapters/freebuff/watch.stop` (หรือ Ctrl+C) — ปิด DB + desktop pet ให้เรียบร้อย
- ดูประวัติการเปลี่ยนสถานะ: `adapters/freebuff/trace.log` (มีเฉพาะ เวลา + สถานะ + เหตุผล + โหมด — ไม่มีเนื้อหาสนทนา/คำสั่ง/โค้ด)
- เปิดฐานข้อมูลไม่ได้ → ทำงานต่อในโหมดสำรอง: ดูแค่ว่ามีไฟล์เปลี่ยนแปลง (มี→`coding` · เงียบครบเวลา→`done` ครั้งเดียว แล้ว `idle`)
- **โครงสร้างฐานข้อมูลของ Freebuff เปลี่ยน** (ตาราง/คอลัมน์ที่ใช้หายไป) → watcher **หยุดตัวเอง** พร้อมบอกว่าอะไรขาด
  (exit 2, ไม่เดาสถานะต่อ) — ถ้าจำเป็นให้ใช้โหมดสำรองต่อ สั่ง `--fallback` เอง
- อ่านเนื้อหาคำสั่งในหน่วยความจำเฉพาะตอนจำแนกว่าเป็นเทสต์หรือไม่ แล้วทิ้งทันที — ไม่พิมพ์ไม่เก็บลงไฟล์ใด ๆ

## เรียกเมื่อไหร่

เรียก **เฉพาะตอนเปลี่ยนช่วงงาน** (ไม่ใช่ทุกคำสั่งที่รัน) โดยประมาณนี้

| จังหวะ | คำสั่ง |
|---|---|
| เริ่มวางแผน อ่านโค้ด สำรวจโปรเจกต์ | `node set-status.js thinking "ข้อความสั้น ๆ ว่ากำลังคิดเรื่องอะไร"` |
| เริ่มลงมือแก้/เขียนไฟล์จริง | `node set-status.js coding "ข้อความสั้น ๆ ว่ากำลังทำอะไร"` |
| รันเทสต์/บิลด์ **ผ่าน** | `node set-status.js success "ข้อความสั้น ๆ"` |
| รันเทสต์/บิลด์ **ไม่ผ่าน** | `node set-status.js error "ข้อความสั้น ๆ"` |
| **จบงานทั้งหมด** | `node set-status.js done "สรุปสั้น ๆ" <fix\|feature\|docs>` |

## บอกชื่อหน้าต่างของตัวเอง (`--window` · ใช้กับ desktop pet)

ถ้าผู้ใช้เปิด desktop pet ไว้ (`cd desktop && npm start`) ให้แนบ `--window "<ชื่อหน้าต่างที่เอเจนต์ตัวนี้ทำงานอยู่>"`
ต่อท้าย **ทุก**คำสั่ง — น้องส้มจะกระโดดไปหน้าต่างนั้นเมื่อถูกคลิก (ดูชื่อที่เปิดอยู่ด้วย `node set-status.js --list-windows`)

| จังหวะ | คำสั่ง (ตัวอย่าง) |
|---|---|
| วางแผน | `node set-status.js thinking "ข้อความ" --window "Codex"` |
| ลงมือแก้ | `node set-status.js coding "ข้อความ" --window "Codex"` |
| เทสต์ผ่าน / พัง | `node set-status.js success "ข้อความ" --window "Codex"` / `node set-status.js error "ข้อความ" --window "Codex"` |
| จบงาน | `node set-status.js done "สรุป" fix --window "Codex"` |

- ชื่อ **ไม่ต้องตรงเป๊ะ** ใส่บางส่วนก็ได้ และไม่สนตัวพิมพ์เล็กใหญ่
- ไม่ส่ง `--window` → อ่านค่าเริ่มต้นจาก `soms.config.json` (คีย์ `window`) ถ้ามีไฟล์
- ไม่รู้ชื่อหน้าต่าง / ไม่ได้เปิด desktop pet → **ตัด flag ทิ้งได้** ห้ามทำให้งานสะดุด

## กติกาข้อความ

- **สั้น** — ไม่เกิน ~40 ตัวอักษร (มันไปอยู่ในฟองคำพูดเล็ก ๆ เหนือหัวแมว)
- **ภาษาไทย** อ่านรู้เรื่อง บอกว่า *กำลังทำอะไร* ไม่ใช่ทวนคำสั่งทั้งบรรทัด
- ห้ามใส่เครื่องหมายคำพูดซ้อนในข้อความ และห้ามขึ้นบรรทัดใหม่
- `done` ต้องมีชนิดงานต่อท้ายเสมอ: `fix` (ดอกไม้) · `feature` (ต้นไม้ใหญ่) · `docs` (พุ่มไม้)

## ตัวอย่างลำดับทั้งงาน

```bash
node set-status.js thinking "อ่านโครงสร้างโปรเจกต์ก่อน"
node set-status.js coding "แก้ฟังก์ชันนับสตรีค"
node set-status.js error "เทสต์สตรีคยังพังอยู่"
node set-status.js coding "แก้ต่อจนผ่าน"
node set-status.js success "เทสต์ผ่านหมดแล้ว"
node set-status.js done "ซ่อมสตรีคและเพิ่มเทสต์" fix
```

## ข้อควรระวัง

- **อย่าเรียกถี่** — สถานะเดิมซ้ำ ๆ ไม่มีประโยชน์ เรียกตอนเปลี่ยนช่วงเท่านั้น
- **`done` ครั้งเดียวตอนจบจริง** — ทุกครั้งที่ `done` สวนจะงอกต้นไม้ 1 ต้น (ไม่ใช่รางวัลสำหรับทุกคำสั่ง)
- งานที่ใช้เวลานานกว่า 10 นาที ให้ต่อท้ายด้วย `--ttl=<นาที>` ไม่งั้นน้องส้มจะหลับก่อน
  ```bash
  node set-status.js coding "รันเทสต์ทั้งชุด" --ttl=45
  ```
- ถ้ารันคำสั่งไม่สำเร็จ (ไม่มี Node / ไม่ได้อยู่ใน repo นี้) **ให้ข้ามไปทำงานหลักต่อ** ห้ามหยุดงานเพราะมาสคอต
- สถานะเป็นแค่ของประดับ — **ห้ามรอผลลัพธ์หรือถามผู้ใช้เกี่ยวกับมัน**

---

# AGENTS.md (English)

This repo ships a mascot, **Som** (`index.html`), which polls `status.json` every second and
changes pose accordingly. Report your work phase with the commands below.

## Shortcut: the automatic Freebuff watcher (`npm run freebuff`)

Skip the manual calls — one command opens the desktop pet together with the watcher:

```bash
npm run freebuff        # = node adapters/freebuff/watch.js --pet
```

The watcher (`adapters/freebuff/watch.js` · plain Node, zero dependencies) reads signals from the
Freebuff desktop app **read-only** (its `desktop-v2.db` under `~/.config/freebuff-desktop/` — it
ever modifies Freebuff files and never sends anything over the network) and writes `status.json`
for you (mid-turn it reads live signals from `threads.harness_state.messageHistory`; at turn end it
reads the `messages` table plus `turn_state`):

| Freebuff signal | Status |
|---|---|
| Thinking / reading / searching (reasoning, read_files, web_search …) | `thinking` |
| Running commands / editing files (run_terminal_command, str_replace, write_file …) | `coding` |
| Failed command (status=failure / errorMessage or exit ≠ 0) | `error` |
| A test command just passed | `success` |
| Turn finished (turn_state running→idle / last_turn_finished_at moves) | `done` — **once per turn** |
| Quiet for 45 s (tune with `--idle=`) | `idle` |

Good to know:

- **The watcher is never started for you** — `npm start` (desktop pet) and `npx serve .` do not launch
  it; only `npm run freebuff` does.
- **While the watcher runs, do NOT call `set-status.js` yourself** — both would write `status.json`.
  (Manual calls from the table below stay valid whenever the watcher is off.)
- Every watcher write carries `window: "Freebuff Desktop"`, so clicking Som jumps to the Freebuff window.
- Stop it: `echo > adapters/freebuff/watch.stop` (or Ctrl+C) — closes the DB and the pet cleanly.
- Transition history: `adapters/freebuff/trace.log` (timestamp + status + reason + mode only —
  never conversation text, commands, or code).
- If the database cannot be opened it degrades to a fallback mode: any file change → `coding`,
  quiet for the configured time → `done` once, then `idle`.
- **If Freebuff's data layout changes** (a table or column it reads disappears) the watcher **stops
  itself** and names what is missing (exit 2) instead of guessing; pass `--fallback` to keep running
  in change-only mode.
- Command text is inspected in memory only to decide “was that a test run?”, then discarded —
  it is never printed or stored.

Call them **only when the phase changes**, never for every command you run:

| When | Command |
|---|---|
| Planning, reading code, exploring | `node set-status.js thinking "short Thai note"` |
| Starting to edit/write files | `node set-status.js coding "short Thai note"` |
| Tests or build **pass** | `node set-status.js success "short note"` |
| Tests or build **fail** | `node set-status.js error "short note"` |
| **All work finished** | `node set-status.js done "short summary" <fix\|feature\|docs>` |

## Name your window (`--window` · for the desktop pet)

If the user runs the desktop pet (`cd desktop && npm start`), append
`--window "<the window this agent is working in>"` to **every** command — Som will jump to that
window when clicked (list open windows with `node set-status.js --list-windows`).

| Phase | Command (example) |
|---|---|
| Planning | `node set-status.js thinking "note" --window "Codex"` |
| Editing | `node set-status.js coding "note" --window "Codex"` |
| Tests pass / fail | `node set-status.js success "note" --window "Codex"` / `node set-status.js error "note" --window "Codex"` |
| Done | `node set-status.js done "summary" fix --window "Codex"` |

- The name does **not** need to be exact — a fragment works, case does not matter
- No `--window` → falls back to the `window` key in `soms.config.json` when that file exists
- Unknown window / no pet running → **just drop the flag**; it must never block the task

Rules: messages stay **short (~40 chars) and in Thai**, `done` always carries a task type
(`fix` flower · `feature` tree · `docs` bush) and is called **once**, only when the whole task is
really finished — every `done` grows one plant. Add `--ttl=<minutes>` for tasks longer than
10 minutes so Som does not fall asleep. If the command fails (no Node, wrong directory), ignore it
and keep working; the mascot must never block the task.
