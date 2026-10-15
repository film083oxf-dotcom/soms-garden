# 🍊 Som's Garden · น้องส้มทำสวน

<div align="center">

แมวส้มอ้วนชื่อ **"ส้ม"** ที่มานั่งดูแลสวนหน้าโต๊ะทำงานแทนคุณ
เปลี่ยนท่าทางตามสถานะของ AI coding agent — **ตัวไหนก็ใช้ได้**
แค่เขียนสถานะลง `status.json`

</div>

---

## 🌱 คืออะไร

Som's Garden เป็นมาสคอตหน้าจอง่าย ๆ ที่เปิดทิ้งไว้ข้างจอได้เลย
น้องส้มจะ **นั่งคิด 🤔 / รดน้ำต้นกล้า ✍️ / กระโดดดีใจ 🎉 / นอนแผ่ 😿 / นอนหงายท้อง 😸 / หลับ Zzz 😴**
ตามสถานะที่เอเจนต์ของคุณเขียนลงไป

- ✅ ไม่ใช้ framework ไม่ต้อง build ไม่ต้อง `npm install` อะไรทั้งนั้น
- ✅ HTML + CSS + JS ล้วน เปิดผ่าน local server เบา ๆ ได้เลย
- ✅ ไม่ผูกกับเอเจนต์ไหน — เขียนไฟล์ JSON เป็นก็ใช้ได้ทุกตัว
- 🌳 ทุกครั้งที่งาน **done** สวนจะงอกต้นไม้ขึ้นมา 1 ต้น (พร้อมวันที่)
- 🔥 มีสตรีครายวัน — ถ้าขาดไป 1 วัน ใบไม้ในสวนจะเริ่มเหลืองให้รู้ตัว

## 🚀 เริ่มใช้ใน 3 คำสั่ง

```bash
git clone https://github.com/film083oxf-dotcom/soms-garden.git && cd soms-garden
npx serve .                                    # เปิด http://localhost:3000
node set-status.js coding "กำลังเขียนของดี"      # สั่งน้องส้มทำงาน
```

เท่านี้น้องส้มก็จะลุกขึ้นมารดน้ำต้นกล้าให้คุณดูทุก ๆ 1 วินาที 🌿

> 💡 ไม่อยากลง `npx`? ใช้ `python3 -m http.server 3000` หรือเปิดด้วย `live-server` ก็ได้
> (ต้องเปิดผ่าน server เพราะหน้าเว็บอ่านไฟล์ JSON ด้วย `fetch`)

### ทดสอบแบบไม่ต้องเขียนเอง

```bash
node demo.js        # สลับสถานะเองทุก 3 วินาที (Ctrl+C เพื่อหยุด)
node demo.js 1      # รันแค่ 1 รอบให้เห็นครบทุกท่า
```

## 😸 ตารางสถานะ

เขียนลง `status.json` — ทุกค่ามี `updatedAt` เป็นเวลา ISO (ถ้าไม่อัปเดตเกิน **2 นาที** น้องส้มจะหลับเอง)

| ค่าใน `status.json` | ท่าทางของน้องส้ม | คำพูดเริ่มต้น |
|---|---|---|
| `thinking` | นั่งเท้าคาง หางส่ายช้า ๆ 🤔 | อืม... ขอคิดแป๊บนะ 🐾 |
| `coding` | ถือบัวรดน้ำ เดินต้วมเตี้ยม รดน้ำต้นกล้า ✍️ | กำลังทำอยู่นะ~ รอหน่อยสักครู่ 🌱 |
| `success` | กระโดดตัวลอยนิดเดียวแล้วตกตุ้บ ดอกไม้บานรอบตัว 🎉 | เย้! ผ่านทุกอย่างแล้ว 🎉 |
| `error` | นอนแผ่ ตาแบะ น้ำตาเม็ดเล็ก ๆ ใบไม้เหี่ยวชั่วคราว 😿 | แง... มีอะไรพังง่ะ 😿 |
| `done` | ยืดเส้นยืดสาย แล้วนอนหงายท้องบนสนามหญ้า 😸 | เสร็จแล้ว! ขอพักเหนื่อยหน่อย 😸 |
| `idle` | หลับ มี Zzz ลอย (ใช้เมื่อไม่อัปเดตเกิน 2 นาที) 😴 | ไม่มีใครอยู่เลย... ขอหลับก่อน Zzz 😴 |

รูปแบบไฟล์:

```json
{
  "status": "coding",
  "message": "กำลังเขียนหน้าล็อกอิน",   // ภาษาไทย สั้น ๆ แสดงบนฟองเหนือหัว (ว่าง = ใช้คำพูดเริ่มต้น)
  "updatedAt": "2026-10-15T09:12:30.000Z"
}
```

## 🌳 สวนของน้องส้ม (`garden.json`)

ทุกครั้งที่สถานะเป็น `done` จะมีต้นไม้งอกขึ้น 1 ต้น ชนิดขึ้นกับ **ประเภทงาน**

| ชนิดงาน | ต้นไม้ |
|---|---|
| `fix` | 🌸 ดอกไม้ |
| `feature` | 🌳 ต้นไม้ใหญ่ |
| `docs` | 🌿 พุ่มไม้ |

```bash
node set-status.js done "เสร็จแล้ว" fix       # ปลูกดอกไม้
node set-status.js done "เพิ่มฟีเจอร์ใหม่" feature
node set-status.js done "อัปเดตเอกสาร" docs
```

หน้าเว็บจะวาดสวนจาก `garden.json` แสดงจำนวนต้นไม้รวม และ **สตรีครายวัน 🔥**
ถ้าขาดไป 1 วันไม่มีงาน `done` เลย ใบไม้ทุกต้นจะเริ่มเหลือง (พอทำเสร็จอีกครั้งก็กลับมาเขียว)

## 🤖 วิธีเชื่อมกับเอเจนต์ตัวอื่น

หลักการมีอยู่อย่างเดียว: **ให้เอเจนต์ของคุณรันคำสั่ง shell**

```bash
node set-status.js thinking "กำลังอ่านโค้ดเดิม"
node set-status.js coding "กำลังแก้บั๊กล็อกอิน"
node set-status.js success "รันเทสต์ผ่าน"
node set-status.js error "เทสต์พัง"
node set-status.js done "เสร็จแล้ว" feature
```

ตัวอย่างการตั้งค่าแต่ละตัว

| เอเจนต์ / ระบบ | วิธีต่อ |
|---|---|
| Claude Code | ตั้ง **hooks** (`PreToolUse` → `thinking`, `PostToolUse` → `done`) ให้รันคำสั่งด้านบน |
| Codex / Aider / OpenHands / Cursor | ใส่บรรทัดเดียวกันนี้ใน **system prompt** หรือ **hooks/pre-commit** ของเครื่องมือ |
| GitHub Actions | รัน `node set-status.js coding "${{ github.job }}"` ในแต่ละ step ของ workflow |
| สคริปต์ของคุณเอง | เขียน `status.json` ตรง ๆ ก็ได้ ดูรูปแบบได้จาก `examples/status.json` |

> ไม่ต้องใช้ Node ก็ได้ — เขียน `status.json` ด้วย `echo`, Python, หรืออะไรก็ตามที่เขียน JSON เป็น

## 🎨 วิธีเปลี่ยนภาพน้องส้ม

ภาพน้องส้มเป็น **SVG ล้วน** แยกไฟล์ตามท่าในโฟลเดอร์ `sprites/`

```
sprites/thinking.svg   sprites/coding.svg   sprites/success.svg
sprites/error.svg      sprites/done.svg     sprites/idle.svg
```

อยากใช้ภาพ AI ที่เจนเอง? แค่ **แทนที่ไฟล์ชื่อเดิม** ไม่ต้องแก้โค้ดอะไรเลย

1. เจนภาพน้องส้มท่าทางต่าง ๆ ด้วย AI (เช่น แมวส้มตัวกลมอ้วน ตาโต แก้มป่อง โทนพาสเทล)
2. บันทึกเป็น SVG/PNG **ชื่อไฟล์เดิม** เช่น `sprites/thinking.svg` (หรือแก้ชื่อไฟล์ใน `index.html` 6 จุด)
3. รีเฟรชหน้าเว็บ — เสร็จ 🎉

> แอนิเมชันเล็ก ๆ (หางส่าย, Zzz, น้ำหยด) อยู่ในไฟล์ SVG ตัว-original — ถ้าเปลี่ยนภาพใหม่
> แอนิเมชันจะหายไป แต่ท่าทางระดับหน้าเว็บ (เดิน, เด้ง, นอน) ยังทำงานเหมือนเดิม

## 🗂 โครงสร้างไฟล์

```
index.html          ← หน้าเว็บหลัก (HTML+CSS+JS ล้วน)
status.json         ← เขียนสถานะที่นี่ (อ่านทุก 1 วินาที)
garden.json         ← ส่วนตัวของสวน (งอกเองตอน done)
set-status.js       ← คำสั่งเขียนสถานะจาก terminal
demo.js             ← สคริปต์ทดสอบ สลับสถานะเองทุก 3 วินาที
sprites/            ← ภาพน้องส้ม 6 ท่า (เปลี่ยนไฟล์ชื่อเดิมได้)
examples/           ← ตัวอย่าง status.json / garden.json
```

## 📄 License

MIT — เอาไปใช้ แก้ไข แจกจ่าย ได้เลย ขอแค่เก็บ License ไว้ 🐾

---

<div align="center">

**English below**

</div>

---

# 🍊 Som's Garden

A chubby orange cat named **"Som"** who tends the garden on your desktop,
striking a different pose for each state of your AI coding agent.
**Works with any agent** — just write the state into `status.json`.

## 🌱 What is it

A tiny, dependency-free mascot page you can leave open beside your screen.
Som will **think 🤔 / water seedlings ✍️ / jump for joy 🎉 / flop over 😿 / lie belly-up 😸 / sleep Zzz 😴**
depending on what your agent reports.

- ✅ No framework, no build step, no `npm install`
- ✅ Plain HTML + CSS + JS, served with any simple local server
- ✅ Agent-agnostic: anything that can write a JSON file can drive it
- 🌳 Every `done` grows one new plant in the garden (with a date)
- 🔥 Daily streak — miss a day and the leaves start turning yellow

## 🚀 Start in 3 commands

```bash
git clone https://github.com/film083oxf-dotcom/soms-garden.git && cd soms-garden
npx serve .                                     # open http://localhost:3000
node set-status.js coding "working on the login page"
```

> The page uses `fetch`, so open it through a local server
> (`npx serve .`, `python3 -m http.server 3000`, or `live-server`).

### Try it without writing anything

```bash
node demo.js        # cycles a status every 3 seconds (Ctrl+C to stop)
node demo.js 1      # one single loop through all six poses
```

## 😸 Status table

Write into `status.json`. Each entry carries an ISO `updatedAt`;
if nothing updates for **2 minutes**, Som falls asleep on their own.

| `status` value | What Som does | Default line |
|---|---|---|
| `thinking` | sits, chin on paw, tail swaying slowly 🤔 | "hmm... let me think 🐾" |
| `coding` | waddles along, watering can in paw, watering seedlings ✍️ | "working on it~ 🌱" |
| `success` | little hop, lands with a plop, flowers bloom around 🎉 | "yay! everything passed 🎉" |
| `error` | lies sprawled, wide eyes, tiny tears, leaves wilt briefly 😿 | "oh no... it broke 😿" |
| `done` | stretches, then lies belly-up on the grass 😸 | "all done! nap time 😸" |
| `idle` | asleep with floating Zzz (auto after 2 min of silence) 😴 | "nobody's here... Zzz 😴" |

File format:

```json
{
  "status": "coding",
  "message": "working on the login page",
  "updatedAt": "2026-10-15T09:12:30.000Z"
}
```

`message` (optional, short, shown in the speech bubble) falls back to the default line when empty.

## 🌳 The garden (`garden.json`)

Every `done` grows one plant, whose **kind depends on the task type**

| Task type | Plant |
|---|---|
| `fix` | 🌸 flower |
| `feature` | 🌳 tree |
| `docs` | 🌿 bush |

```bash
node set-status.js done "fixed it" fix
node set-status.js done "shipped the feature" feature
node set-status.js done "updated the docs" docs
```

The page renders the garden from `garden.json`, shows the total plant count and the
**daily streak 🔥**. Skip a day with no `done` and every leaf starts turning yellow;
finish something again and the garden turns green.

## 🤖 Connecting other agents

One rule: **have your agent run a shell command**

```bash
node set-status.js thinking "reading the existing code"
node set-status.js coding "fixing the login bug"
node set-status.js success "tests are green"
node set-status.js error "tests broke"
node set-status.js done "done" feature
```

| Agent / system | How |
|---|---|
| Claude Code | Add **hooks** (`PreToolUse` → `thinking`, `PostToolUse` → `done`) that run the commands above |
| Codex / Aider / OpenHands / Cursor | Put the same lines in the tool's **system prompt** or **pre-commit hook** |
| GitHub Actions | Run `node set-status.js coding "${{ github.job }}"` in each workflow step |
| Your own scripts | Write `status.json` directly — see `examples/status.json` |

No Node required — any tool that can write JSON (`echo`, Python, …) works.

## 🎨 Replacing the cat art

Som is drawn as **pure SVG**, one file per pose in `sprites/`

```
sprites/thinking.svg   sprites/coding.svg   sprites/success.svg
sprites/error.svg      sprites/done.svg     sprites/idle.svg
```

Using your own AI-generated art? Just **overwrite the same filenames** — no code changes:

1. Generate Som in each pose (chubby round orange cat, big eyes, puffy cheeks, pastel tones)
2. Save as SVG/PNG with the **same file name** (or update the six names in `index.html`)
3. Refresh — done 🎉

> Tiny built-in animations (tail sway, Zzz, water drops) live inside the original SVG files
> and disappear with a replacement, but the page-level motion (waddle, hop, calm breathing) still works.

## 📄 License

MIT — use it, modify it, share it, just keep the license. 🐾
