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

เขียนลง `status.json` — ทุกค่ามี `updatedAt` เป็นเวลา ISO (ถ้าไม่อัปเดตเกิน **10 นาที** น้องส้มจะหลับเอง
และปรับเวลาได้ด้วย `ttlMinutes` ถ้างานของคุณใช้เวลานานกว่านั้น)

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
  "updatedAt": "2026-10-15T09:12:30.000Z",
  "ttlMinutes": 30                    // ไม่บังคับ: เงียบเกินกี่นาทีถือว่าหลับ (1–1440, ค่าเริ่มต้น 10)
}
```

อยากให้เข้างานยาว ๆ ไม่หลับกลางคัน ก็สั่งด้วย `--ttl` ได้เลย

```bash
node set-status.js coding "รันเทสต์ทั้งโปรเจกต์" --ttl=45
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

## 🧪 เทสต์

ใช้ `node:test` ในตัว Node — ไม่ต้องติดตั้งอะไรเลย (25 เทสต์)

```bash
node --test "tests/*.test.js"
```

| ไฟล์ | ครอบอะไร |
|---|---|
| `tests/set-status.test.js` | การเขียนสถานะ, ปลูกต้นไม้ตามชนิดงาน, สตรีคต่อเนื่อง/ขาดช่วง, `garden.json` พัง, ช่วงค่า `--ttl` |
| `tests/browser-smoke.test.js` | เปิด **หน้าเว็บจริงใน Chrome/Edge headless** แล้วเช็กทีละท่า (ภาพ/ฟองคำพูด/ป้ายสถานะ), `ttlMinutes`, สถานะที่ไม่รู้จัก, การวาดสวน, ใบเหลืองจาก ISO เต็ม, `aria-live`/`aria-pressed`, การขยับ (หายใจ/น้ำหยด/ประกาย/หัวใจ), กดลูบหัว, `prefers-reduced-motion`, และ fallback `.png → .svg` |

เทสต์ทุกตัวสร้างสำเนาเว็บในโฟลเดอร์ชั่วคราวแล้วเสิร์ฟเอง — **ไม่แตะ `status.json` / `garden.json` ของจริง**
และเก็บกวาดโฟลเดอร์ทิ้งเมื่อจบ

> 💡 เทสต์เบราว์เซอร์จะ **skip** (ไม่ใช่ pass) ถ้าเครื่องไม่มี Chrome/Edge
> ตั้ง path เองได้ด้วย `CHROME_PATH="/path/to/chrome" node --test "tests/*.test.js"`

## 🎬 ขยับได้ + ลูกเล่น

ภาพน้องส้มเป็น PNG นิ่ง ๆ แต่หน้าเว็บเติมชีวิตให้ด้วย CSS ล้วน — ไม่ต้องแก้รูปเลย

- **หายใจ** — ตัวยืด/หดเบา ๆ ตลอดเวลา (ท่า `coding` = ถี่ขึ้น · ท่า `idle` = ช้าลง)
- **เงาใต้ตัว** — หด/ขยายตามจังหวะตอนกระโดดดีใจ
- **เอียงหัว** — เอาเมาส์ไปชี้ที่ตัวน้องส้ม
- **เอฟเฟกต์ตามท่า** — น้ำหยดจากบัวรดน้ำ (`coding`) · ประกายรอบหัว (`success`) · หัวใจลอย (`done`)
- **ลูบหัว** — คลิกที่ตัวน้องส้ม (หรือ `Tab` ไปที่ตัวแล้วกด `Enter` / `Space`)
  → ตัวย่นนิด ๆ, หัวใจลอยขึ้น, แล้วพูดคำอ้อน ๆ 2 วินาที จากนั้นกลับไปพูดตามสถานะจริง
- **ชี้ที่ต้นไม้ในสวน** — เห็นชื่อต้นไม้และวันที่ปลูก
- เคารพ `prefers-reduced-motion` — ผู้ใช้ที่ตั้งให้ลดการเคลื่อนไหวจะเห็นทุกอย่างนิ่ง (ไม่มีอนิเมชันวน)

> อยากได้ “กะพริบตา” จริง ๆ ต้องแยกชั้นดวงตาเป็นอีกรูป (ภาพชุดนี้วาดตาติดกับหน้า)
> — แจ้งได้เลยถ้าอยากได้สไปรท์แบบแยกชั้นสำหรับกะพริบตา

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
| เครื่องมือที่ไม่ได้อ่าน `AGENTS.md` เอง | ใส่คำสั่งเดียวกันนี้ใน **system prompt** หรือ **hooks / pre-commit** ของเครื่องมือ |
| GitHub Actions | รัน `node set-status.js coding "${{ github.job }}"` ในแต่ละ step ของ workflow |
| สคริปต์ของคุณเอง | เขียน `status.json` ตรง ๆ ก็ได้ ดูรูปแบบได้จาก `examples/status.json` |

> ไม่ต้องใช้ Node ก็ได้ — เขียน `status.json` ด้วย `echo`, Python, หรืออะไรก็ตามที่เขียน JSON เป็น

### 🤝 ให้เอเจนต์อัปเดตสถานะเองด้วย `AGENTS.md`

repo นี้มีไฟล์ [`AGENTS.md`](AGENTS.md) ที่เขียนเป็นกติกาให้ AI coding agent อ่านแล้ว
เรียก `set-status.js` เองตอนเปลี่ยนช่วงงาน — **ไม่ต้องมาเขียน hook เองทุกครั้ง**

| เครื่องมือ | อ่าน `AGENTS.md` เองไหม | ต้องทำอะไรใน repo นี้ |
|---|---|---|
| **Codex** (OpenAI) | ✅ อ่านเอง — *“Codex reads AGENTS.md files before doing any work”* ไล่จากราก repo ลงมาถึงโฟลเดอร์ที่กำลังทำงาน | ไม่ต้องทำอะไร |
| **Cursor** | ✅ อ่านเอง — รองรับ `AGENTS.md` ทั้งราก repo และโฟลเดอร์ย่อย | ไม่ต้องทำอะไร |
| **GitHub Copilot** (cloud agent / VS Code / Copilot CLI) | ✅ อ่านเอง — รองรับ `AGENTS.md` ในฐานะ agent instructions | ไม่ต้องทำอะไร |
| **Claude Code** | ⚠️ อ่าน**ก็ต่อเมื่อไม่มี `CLAUDE.md`** ในโฟลเดอร์ปัจจุบันหรือชั้นเหนือขึ้นไป (ตั้งแต่ v2.1.277) — ถ้ามี `CLAUDE.md` การ fallback ไปอ่าน `AGENTS.md` จะถูกยกเลิก | repo นี้มี [`CLAUDE.md`](CLAUDE.md) ที่สั่ง import `@AGENTS.md` ให้แล้ว จึงใช้ได้ทุกเวอร์ชัน |
| **Gemini CLI** | ❌ ไม่อ่าน — ค่าเริ่มต้นอ่านเฉพาะไฟล์ชื่อ `GEMINI.md` | repo นี้มี [`GEMINI.md`](GEMINI.md) ที่สั่ง import `@./AGENTS.md` ให้แล้ว (ทางเลือก: ตั้ง `context.fileName` ใน `.gemini/settings.json`) |
| เครื่องมือที่ไม่รู้จักไฟล์นี้ | ❌ ไม่ | เริ่มบทสนทนาด้วย: **“อ่าน `AGENTS.md` แล้วทำตาม”** |
| เอเจนต์ที่รันใน sandbox อ่านไฟล์นอกโปรเจกต์ไม่ได้ | — | วาง `AGENTS.md` ไว้ที่ราก repo เดียวกัน (ไฟล์อยู่ในโปรเจกต์แล้ว) |

> 📖 เอกสารทางการที่ใช้ตรวจสอบ (ต.ค. 2026): [Codex · AGENTS.md](https://developers.openai.com/codex/agent-configuration/agents-md) · [Cursor · Rules](https://cursor.com/docs/rules) · [Claude Code · Memory](https://code.claude.com/docs/en/memory) · [Gemini CLI · GEMINI.md](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md) · [GitHub Copilot · Custom instructions support](https://docs.github.com/en/copilot/reference/custom-instructions-support)

กติกาหลักในไฟล์นั้น: `thinking` ตอนวางแผน → `coding` ตอนลงมือแก้ → `success` / `error` ตามผลเทสต์
→ `done <fix|feature|docs>` ตอนจบงาน **ครั้งเดียว** ข้อความสั้น เป็นภาษาไทย
และ **เรียกเฉพาะตอนเปลี่ยนช่วงงาน** ไม่ใช่ทุกคำสั่ง

> 🧠 ถ้าเอเจนต์ของคุณยังไม่ทำตาม ลองถามกลับว่า “ตอนนี้นายทำอะไรอยู่ เขียนลง status.json ให้หน่อย”
> แล้วมันจะเริ่มใช้คำสั่งเอง

## 📲 ติดตั้งเป็นแอปแยกหน้าต่าง

เปิดหน้าเว็บครั้งเดียว แล้วกดปุ่ม **⬇ ติดตั้ง** ที่มุมขวาบน
น้องส้มจะกลายเป็นแอปของตัวเอง (ไม่มีแถบที่อยู่ มีไอคอนแมวบน Dock/Taskbar)
เปิดค้างข้างจอได้เหมือนแอปจริง ๆ

- **Chrome / Edge (คอมพิวเตอร์):** กดปุ่มติดตั้ง หรือไอคอน ⊕ ในแถบที่อยู่
- **มือถือ / แท็บเล็ต:** เมนูเบราว์เซอร์ → "เพิ่มไปที่หน้าจอโฮม"
- **Safari (macOS/iOS):** แชร์ → "เพิ่มไปยัง Dock" / "เพิ่มไปที่หน้าจอโฮม"

หลังติดตั้งแล้ว ตัวเพจยังอ่าน `status.json` จาก server เดิมทุก 1 วินาทีเหมือนเคย
(ปุ่มติดตั้งจะโผล่เมื่อเบราว์เซอร์รองรับเท่านั้น — เปิดผ่าน `file://` จะไม่เห็นปุ่มนี้)

> 🔌 ไฟล์ `sw.js` แคชแค่ "เปลือกแอป" (หน้าเว็บ + รูปน้องส้ม) ไว้เปิดได้แม้เน็ตหลุด
> ส่วน `status.json` / `garden.json` **ไม่แคชเด็ดขาด** สถานะจึงสดใหม่เสมอ

## 🎨 วิธีเปลี่ยนภาพน้องส้ม

ภาพน้องส้มเป็น **PNG โปร่งใสที่เจนจาก AI** แยกไฟล์ตามท่าในโฟลเดอร์ `sprites/`
(ส่วนไฟล์ SVG ตัว-original ยังเก็บไว้เป็นสำรอง — หน้าเว็บจะโหลด `.png` ก่อน แล้วค่อยใช้ `.svg` ถ้าไม่พบ PNG)

```
sprites/thinking.png   sprites/coding.png   sprites/success.png
sprites/error.png      sprites/done.png     sprites/idle.png
(+ sprites/*.svg  ไฟล์สำรอง)
```

อยากใช้ภาพ AI ที่เจนเอง? แค่ **แทนที่ไฟล์ชื่อเดิม** ไม่ต้องแก้โค้ดอะไรเลย

1. เจนภาพน้องส้มท่าทางต่าง ๆ ด้วย AI (เช่น แมวส้มตัวกลมอ้วน ตาโต แก้มป่อง โทนพาสเทล)
2. ลบพื้นหลังให้โปร่งใส (กันขอบเหลือรอยขาว) แล้วบันทึกเป็น **ชื่อไฟล์เดิม** เช่น `sprites/thinking.png`
3. รีเฟรชหน้าเว็บ — เสร็จ 🎉

> แอนิเมชันที่ฝังในไฟล์ SVG ตัว-original (หางส่าย, Zzz) จะหายไปเมื่อใช้ภาพ PNG
> แต่แอนิเมชันระดับหน้าเว็บทั้งหมด (หายใจ, เงา, เดิน, เด้ง, นอน, น้ำหยด, ประกาย, หัวใจ, ลูบหัว)
> ยังทำงานเหมือนเดิม เพราะวาดด้วย CSS ทับรูปทุกท่า

## 🗂 โครงสร้างไฟล์

```
index.html          ← หน้าเว็บหลัก (HTML+CSS+JS ล้วน)
status.json         ← เขียนสถานะที่นี่ (อ่านทุก 1 วินาที)
garden.json         ← ส่วนตัวของสวน (งอกเองตอน done)
set-status.js       ← คำสั่งเขียนสถานะจาก terminal
demo.js             ← สคริปต์ทดสอบ สลับสถานะเองทุก 3 วินาที
tests/              ← เทสต์หน่วย + เทสต์เบราว์เซอร์ headless (node --test ไม่ต้องลงอะไรเพิ่ม)
sprites/            ← ภาพน้องส้ม 6 ท่า (png หลัก + svg สำรอง เปลี่ยนไฟล์ชื่อเดิมได้)
icons/              ← ไอคอนแอป (favicon / 192 / 512 / apple-touch) เจนจาก sprites/idle.png
manifest.webmanifest← ข้อมูลแอปสำหรับติดตั้ง (ชื่อ, ไอคอน, สีพื้น)
sw.js               ← service worker (แคชเปลือกแอป แต่ไม่แคช status.json)
AGENTS.md           ← กติกาให้เอเจนต์อ่าน (Codex / Cursor / Copilot อ่านอัตโนมัติ)
CLAUDE.md           ← ตัวชี้ของ Claude Code (สั่ง import @AGENTS.md)
GEMINI.md           ← ตัวชี้ของ Gemini CLI (สั่ง import @./AGENTS.md)
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
if nothing updates for **10 minutes**, Som falls asleep on their own — tune that window with `ttlMinutes`
if your tasks run longer.

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
`ttlMinutes` (optional, 1–1440, default 10) is how long Som waits before dozing off.

```json
{
  "status": "coding",
  "message": "running the long test suite",
  "updatedAt": "2026-10-15T09:12:30.000Z",
  "ttlMinutes": 45
}
```

```bash
node set-status.js coding "running the full suite" --ttl=45
```

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

## 🧪 Tests

Built-in `node:test` — nothing to install (25 tests):

```bash
node --test "tests/*.test.js"
```

| File | Covers |
|---|---|
| `tests/set-status.test.js` | status writing, plant kinds, streak continuity/gaps, broken `garden.json`, `--ttl` clamping |
| `tests/browser-smoke.test.js` | drives the **real page in headless Chrome/Edge**: every pose (sprite, bubble, pill), `ttlMinutes`, unknown status, garden rendering, ISO date yellowing, `aria-live`/`aria-pressed`, motion (breathing, drops, sparkles, hearts), click-to-pet, `prefers-reduced-motion`, `.png → .svg` fallback |

Each test builds a throwaway copy of the site and serves it itself, so the real
`status.json` / `garden.json` are never touched, and temp folders are cleaned up.

> 💡 The browser test **skips** (it does not pass) when no Chrome/Edge is found.
> Point at one with `CHROME_PATH="/path/to/chrome" node --test "tests/*.test.js"`.

## 🎬 Motion & interactions

Som's art is static PNG, but the page adds life with pure CSS — no art edits needed.

- **Breathing** — the body gently stretches (faster while `coding`, slower while `idle`)
- **Ground shadow** — squashes and stretches with the victory hop
- **Head tilt** — hover the cat
- **Per-pose effects** — water drops from the can (`coding`), sparkles (`success`), floating hearts (`done`)
- **Petting** — click the cat (or `Tab` to it and press `Enter` / `Space`): it squishes, hearts float up,
  and it says something affectionate for two seconds before returning to the real status line
- **Hover a garden plant** — see its name and planting date
- Respects `prefers-reduced-motion`: everything goes still for users who ask for less motion

> Real **eye blinking** would need the eyes on a separate art layer (this art set draws the eyes into the
> face) — happy to produce a layered sprite set if you want it.

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
| Tools that don't read `AGENTS.md` themselves | Put the same lines in the tool's **system prompt** or **hooks / pre-commit** |
| GitHub Actions | Run `node set-status.js coding "${{ github.job }}"` in each workflow step |
| Your own scripts | Write `status.json` directly — see `examples/status.json` |

No Node required — any tool that can write JSON (`echo`, Python, …) works.

### 🤝 Let the agent drive it with `AGENTS.md`

This repo ships [`AGENTS.md`](AGENTS.md) with instructions an AI coding agent reads and follows,
calling `set-status.js` on its own as the work phase changes — no per-tool hook wiring needed.

| Tool | Reads `AGENTS.md` by itself? | What to do in this repo |
|---|---|---|
| **Codex** (OpenAI) | ✅ Yes — *“Codex reads AGENTS.md files before doing any work”*, walking from the repo root down to the working directory | Nothing |
| **Cursor** | ✅ Yes — supports `AGENTS.md` at the project root and in subdirectories | Nothing |
| **GitHub Copilot** (cloud agent / VS Code / Copilot CLI) | ✅ Yes — `AGENTS.md` is supported as agent instructions | Nothing |
| **Claude Code** | ⚠️ Only **when there is no `CLAUDE.md`** in the working directory or above (v2.1.277+) — a `CLAUDE.md` suppresses the `AGENTS.md` fallback | This repo ships [`CLAUDE.md`](CLAUDE.md) with an `@AGENTS.md` import, so it works on every version |
| **Gemini CLI** | ❌ No — by default it only loads files named `GEMINI.md` | This repo ships [`GEMINI.md`](GEMINI.md) importing `@./AGENTS.md` (alternative: set `context.fileName` in `.gemini/settings.json`) |
| Tools that ignore this file | ❌ No | Start with: **“read AGENTS.md and follow it”** |
| Agents sandboxed away from the project | — | `AGENTS.md` lives at the repo root, so it travels with the checkout |

> 📖 Official docs checked (Oct 2026): [Codex · AGENTS.md](https://developers.openai.com/codex/agent-configuration/agents-md) · [Cursor · Rules](https://cursor.com/docs/rules) · [Claude Code · Memory](https://code.claude.com/docs/en/memory) · [Gemini CLI · GEMINI.md](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md) · [GitHub Copilot · Custom instructions support](https://docs.github.com/en/copilot/reference/custom-instructions-support)

The rules are: `thinking` while planning → `coding` while editing → `success` / `error` for the
build result → `done <fix|feature|docs>` once, when the whole task is done. Messages stay short and
in Thai, and the status is only reported when the phase changes — not for every command.

> 🧠 If your agent still ignores it, ask “what are you doing right now? write it to status.json”
> and it will start using the commands.

## 📲 Install it as its own app

Open the page once, then hit **⬇ ติดตั้ง** (Install) in the top-right corner.
Som becomes a standalone app: no address bar, a cat icon in your Dock or Taskbar,
and a window you can park beside your editor.

- **Chrome / Edge (desktop):** click the install button, or the ⊕ icon in the address bar
- **Android / tablet:** browser menu → "Add to Home screen"
- **Safari (macOS / iOS):** Share → "Add to Dock" / "Add to Home Screen"

The installed app still reads `status.json` from your server every second.
The install button only appears when the browser supports installing
(opening the page via `file://` will not show it).

> 🔌 `sw.js` caches only the app shell (page + cat sprites) so it opens offline.
> `status.json` and `garden.json` are **never** cached, so the state stays live.

## 🎨 Replacing the cat art

Som is **AI-generated PNG art with a transparent background**, one file per pose in `sprites/`
(the original SVGs stay as fallback — the page loads `.png` first and falls back to `.svg` when a PNG is missing)

```
sprites/thinking.png   sprites/coding.png   sprites/success.png
sprites/error.png      sprites/done.png     sprites/idle.png
(+ sprites/*.svg  fallback files)
```

Using your own AI-generated art? Just **overwrite the same file names** — no code changes:

1. Generate Som in each pose (chubby round orange cat, big eyes, puffy cheeks, pastel tones)
2. Remove the background so it is transparent (no white edge halo), then save with the **same file name** (e.g. `sprites/thinking.png`)
3. Refresh — done 🎉

> Animations baked into the original SVG files (tail sway, Zzz) disappear with a replacement, but every
> page-level motion (breathing, shadow, waddle, hop, water drops, sparkles, hearts, petting) is drawn in CSS
> on top of whichever art you use, so it keeps working.

## 📄 License

MIT — use it, modify it, share it, just keep the license. 🐾
