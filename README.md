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
| `idle` | หลับ มี Zzz ลอย (ใช้เมื่อไม่อัปเดตเกิน 10 นาที) 😴 | ไม่มีใครอยู่เลย... ขอหลับก่อน Zzz 😴 |

รูปแบบไฟล์:

```json
{
  "status": "coding",
  "message": "กำลังเขียนหน้าล็อกอิน",   // ภาษาไทย สั้น ๆ แสดงบนฟองเหนือหัว (ว่าง = ใช้คำพูดเริ่มต้น)
  "updatedAt": "2026-10-15T09:12:30.000Z",
  "ttlMinutes": 30,                   // ไม่บังคับ: เงียบเกินกี่นาทีถือว่าหลับ (1–1440, ค่าเริ่มต้น 10)
  "window": "Codex"                   // ไม่บังคับ: ชื่อหน้าต่างเอเจนต์ (ให้ desktop pet กระโดดไปหาเมื่อคลิก)
}
```

อยากให้เข้างานยาว ๆ ไม่หลับกลางคัน ก็สั่งด้วย `--ttl` ได้เลย

```bash
node set-status.js coding "รันเทสต์ทั้งโปรเจกต์" --ttl=45
```

> 📝 `status.json` กับ `garden.json` เป็น **ข้อมูลรันไทม์** (สถานะ/สวนของคุณ) จึงถูก `.gitignore` ไว้
> และ **ไม่ได้ commit** — ครั้งแรกที่รัน `node set-status.js` หรือ `node demo.js` ไฟล์จะถูกสร้างให้เอง
> ถ้าอยากเริ่มจากข้อมูลตัวอย่าง ดูได้ที่ [`examples/status.json`](examples/status.json)
> และ [`examples/garden.json`](examples/garden.json)

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

ใช้ `node:test` ในตัว Node — ไม่ต้องติดตั้งอะไรเลย (30 เทสต์)

```bash
node --test "tests/*.test.js"
```

| ไฟล์ | ครอบอะไร |
|---|---|
| `tests/set-status.test.js` | การเขียนสถานะ, ปลูกต้นไม้ตามชนิดงาน, สตรีคต่อเนื่อง/ขาดช่วง, `garden.json` พัง, ช่วงค่า `--ttl` |
| `tests/pixel-assets.test.js` | ภาพที่เจนออกมา: 6 ท่าเป็น nearest ×8 จริง, alpha 0/255, 24 สีร่วม · ไอคอนตรงกับ `sprites/idle.png` ทุกเม็ดพิกเซล |
| `tests/browser-smoke.test.js` | เปิด **หน้าเว็บจริงใน Chrome/Edge headless** แล้วเช็กทีละท่า (ภาพ/ฟองคำพูด/ป้ายสถานะ), `ttlMinutes`, สถานะที่ไม่รู้จัก, การวาดสวน, ใบเหลืองจาก ISO เต็ม, `aria-live`/`aria-pressed`, การขยับ (หายใจ/น้ำหยด/ประกาย/หัวใจ), กดลูบหัว, `prefers-reduced-motion`, และ fallback `.png → .svg` |

เทสต์ทุกตัวสร้างสำเนาเว็บในโฟลเดอร์ชั่วคราวแล้วเสิร์ฟเอง — **ไม่แตะ `status.json` / `garden.json` ของจริง**
และเก็บกวาดโฟลเดอร์ทิ้งเมื่อจบ

> 💡 เทสต์เบราว์เซอร์จะ **skip** (ไม่ใช่ pass) ถ้าเครื่องไม่มี Chrome/Edge
> ตั้ง path เองได้ด้วย `CHROME_PATH="/path/to/chrome" node --test "tests/*.test.js"`
>
> 🖥️ เทสต์ของ desktop pet (ส่วนที่ไม่ใช้ GUI: จับคู่ชื่อหน้าต่าง/อ่านสถานะ/เมนู/สลับโหมดหลับ) รันแยก: `cd desktop && npm test`
> — ชุด `renderer-mode.test.js` รัน `renderer.js` จริงใน sandbox DOM ปลอม แล้วยืนยันว่า idle → sleepy, สถานะอื่น → normal
> และเช็กว่าสไปรต์ชีตหลับเป็น 1024, ใช้ 24 สีร่วม, alpha 0/255 และ **วางเส้นพื้น/กึ่งกลางตรงกับ `sprites/idle.png`** (สลับแล้วไม่กระโดด)

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

## 🖥️ Desktop pet (Electron · Windows)

เปิดน้องส้มเป็นหน้าต่าง **โปร่งใส ไร้กรอบ อยู่บนสุด ไม่ขึ้น taskbar** ขนาดเท่าพื้นที่ทำงานของจอหลัก
คลิกทะลุได้ทุกจุด **ยกเว้นตัวน้องส้มกับฟองคำพูด** และเดินไปมาตามขอบล่างจอเหนือ taskbar
โดยอ่าน `status.json` ทุก 1 วินาทีด้วยกติกาเดียวกับหน้าเว็บทุกประการ (กติกาหลับ, `ttlMinutes`, ภาพ `sprites/` ชุดเดียวกัน)
เพิ่มเฉพาะโหมดหลับที่ใช้สไปรต์ชีต 4 เฟรมใน `assets/` (ดูหัวข้อถัดไป)

```bash
cd desktop
npm install      # ครั้งแรก (~300MB · Electron)
npm start
```

| การกระทำ | ผล |
|---|---|
| เมาส์ชี้ที่ตัวน้องส้มหรือฟอง | จุดนั้นรับคลิก ส่วนอื่นของจอทะลุต่อ (แอปอื่นทำงานได้ตามปกติ) |
| คลิกน้องส้ม | ดึงหน้าต่างเอเจนต์ (ชื่อจาก field `window` ใน `status.json`) ขึ้นหน้าสุด — ย่ออยู่จะ restore ให้; หาไม่เจอ/ดึงไม่ขึ้น น้องส้มจะบอกในฟอง ไม่แครช |
| คลิกขวาที่น้องส้ม | เมนู **ไปหน้าต่างเอเจนต์** · **เปิดหน้าสวน** (เปิด `gardenUrl` จาก `soms.config.json`, ค่าเริ่มต้น `http://localhost:3000`) · **ปิดน้องส้ม** |

ท่าปกติใช้ภาพ PNG เดิมทั้งหมด (ทำท่าเดินด้วย CSS/JS ไม่มีสไปรต์เฟรมใหม่):
`coding` เดินไปมาตัวเด้งเอียงตามจังหวะก้าว พลิกภาพตามทิศทาง เปลี่ยนทิศที่ขอบหรือหยุดสั้น ๆ · `thinking` นั่งนิ่ง
`success` กระโดดหนึ่งครั้ง · `error` นอนแผ่ · `done` นอนหงายท้อง — และ **เคารพ `prefers-reduced-motion`**

### 😴 โหมดน้องแมวง่วงนอน (เฉพาะ desktop pet)

เมื่อสถานะเป็น `idle` — **รวมกรณีเงียบเกิน `ttlMinutes`** จน `lib/status.js` ตัดสินเป็น idle —
น้องส้มจะสลับไปใช้สไปรต์ชีต `assets/soms-garden-fat-lazy-cat-sleepy-spritesheet.png`
(ตาราง 2×2 = 4 เฟรม: นอนขด · หาว · กลิ้ง · นอนหงาย) และกลับมาท่าปกติ **ทันที** ที่มีสถานะอื่นเข้ามา

- อนิเมชัน `6s steps(1, end)` — เฟรมละ 1.5 วินาที ค้างท่าไว้แล้วตัดไปเฟรมถัดไป (ไม่ใช่การ fade)
- ชีตเป็น **พิกเซลอาร์ตชุดเดียวกับ 6 ท่าหลัก**: 4 เฟรม เฟรมละ 512 (= 64×64 ×8 nearest) รวมเป็น 1024
  `background-size` = 2 เท่าของ `--pet-size` → 1 เฟรม = `--pet-size` พอดี จึงไม่ต้องใช้ `clip-path` แล้ว
- ทุกเฟรมถูกวางให้ **เส้นพื้นและจุดกึ่งกลางตรงกับ `sprites/idle.png`** (วัดจาก bounding box ของแมว)
  → สลับ `idle` ↔ โหมดหลับแล้วตัวน้องไม่กระโดด (มีเทสต์ยืนยันไว้)
- ใช้ `image-rendering: pixelated` เหมือนสไปรต์ท่าปกติ
- `prefers-reduced-motion: reduce` → หยุดที่เฟรมแรก (ไม่มีอนิเมชัน)
- สลับเองชั่วคราวได้จาก DevTools: `window.somMode('sleepy')` / `window.somMode('normal')`

ตัวแปลงชีตหลับอยู่ใน [`tools/pixelate-sleepy.js`](tools/pixelate-sleepy.js):
สำรองต้นฉบับไป `assets/original/`, แยก 4 เฟรม, ย่อด้วย area filter, บังคับ alpha 0/255
แล้ว map เข้าพาเลตต์ 24 สีที่ **อ่านจาก `sprites/*.png`** (ไม่สร้างสีใหม่) ก่อนขยาย nearest ×8

```bash
node tools/pixelate-sleepy.js             # แปลงชีตหลับจาก assets/original (รันซ้ำได้ผลเดิม)
```

> เปลี่ยนไฟล์สไปรต์ชีตเอง? แค่แทนที่ `assets/soms-garden-fat-lazy-cat-sleepy-spritesheet.png`
> แล้วรันตัวแปลงด้านบน — ไม่ต้องแก้ CSS อีก เพราะเรขาคณิตถูกจัดให้ตรงกับ `sprites/idle.png` แล้ว

### ตั้งชื่อหน้าต่างให้น้องส้มรู้ว่าเอเจนต์อยู่ตรงไหน

```bash
node set-status.js --list-windows                          # ดูหน้าต่างที่เปิดอยู่
node set-status.js coding "กำลังเขียน" --window "Codex"      # ผูกสถานะกับหน้าต่าง
node set-status.js done "เสร็จแล้ว" fix --window "VS Code"   # ชื่อบางส่วนก็ได้ ไม่สนตัวพิมพ์
```

- ไม่ส่ง `--window` → อ่านค่าเริ่มต้นจาก `soms.config.json` ที่ราก repo ([ตัวอย่าง](examples/soms.config.json))

```json
{
  "window": "Codex",
  "gardenUrl": "http://localhost:3000",
  "petSize": 192
}
```

- `petSize` = ขนาดตัวน้องส้มบนเดสก์ท็อป ต้องเป็นจำนวนเต็มเท่าของ 64 (64/128/192/256/320/384 · ค่าเริ่มต้น 192)
  เพื่อให้พิกเซลอาร์ตคมและไม่เบี้ยวเวลาย่อ/ขยาย — แก้แล้วรีสตาร์ท `npm start`

> 💻 ทดสอบแล้วบน **Windows** — การค้น/ดึงหน้าต่างใช้ PowerShell + Win32 จึงมีเฉพาะ Windows
> (ชื่อหน้าต่างถูกส่งเข้า PowerShell เป็น argv ไม่ต่อเข้าสตริงคำสั่ง จึงกัน command injection)

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

ภาพน้องส้มทุกท่าเป็น **พิกเซลอาร์ต 64×64 ขยาย ×8 = 512×512** (โปร่งใส ไม่มีขอบกึ่งโปร่ง)
แยกไฟล์ตามท่าในโฟลเดอร์ `sprites/` พร้อมไฟล์ต้นฉบับ 512 ก่อนแปลงเก็บไว้ที่ `sprites/original/`
ส่วนสไปรต์ชีตหลับใน `assets/` และไอคอนใน `icons/` ก็เจนจากตัวแปลงชุดเดียวกัน — ใช้พาเลตต์ 24 สีร่วมกันหมด

```
sprites/thinking.png   sprites/coding.png   sprites/success.png
sprites/error.png      sprites/done.png     sprites/idle.png
sprites/original/*.png    ← ต้นฉบับก่อนแปลง (สำรองไว้ ไม่ได้ใช้ตอนรัน)
(+ sprites/*.svg  ไฟล์สำรองแบบเวกเตอร์)
assets/soms-garden-fat-lazy-cat-sleepy-spritesheet.png  ← ชีตหลับ 2×2 (พิกเซล 1024)
assets/original/…                                       ← ต้นฉบับชีตหลับ 1920
icons/*.png                                             ← ไอคอนแอป เจนจาก sprites/idle.png
```

ตัวแปลงอยู่ใน [`tools/pixelate-sprites.js`](tools/pixelate-sprites.js) — ย่อ 512 → 64 ด้วย area filter,
สร้างพาเลตต์ 24 สีที่**ใช้ร่วมกันทั้ง 6 ท่า**, บังคับ alpha เป็น 0/255 แล้วขยายกลับแบบ nearest ×8

รายละเอียดที่ย่อแล้วหายมีแก้เฉพาะจุดไว้ใน `TOUCHUPS` / `KEEP_DETAILS` ของสคริปต์:
Zzz ของ `idle` วาดใหม่, น้ำตาสีฟ้าของ `error` ถูกกันไว้ไม่ให้หม่นแล้วต่อหยดให้เห็นทางน้ำตา,
ปากยิ้มของ `success` ขยายในปากเป็น 3 พิกเซลพร้อมลิ้นสีชมพู — รันซ้ำได้ผลเดิมทุกครั้ง

```bash
node tools/pixelate-sprites.js            # แปลงทั้ง 6 ท่าจาก sprites/original
node tools/pixelate-sprites.js --help     # --size / --scale / --colors / --alpha
node tools/pixelate-sleepy.js             # แปลงชีตหลับ 2×2 ด้วยพาเลตต์ชุดเดียวกัน
node tools/make-icons.js                  # สร้างไอคอนทั้งหมดใหม่จาก sprites/idle.png
```

อยากใช้ภาพ AI ที่เจนเอง? แค่ **แทนที่ไฟล์ชื่อเดิม** ไม่ต้องแก้โค้ดอะไรเลย

1. เจนภาพน้องส้มท่าทางต่าง ๆ ด้วย AI (เช่น แมวส้มตัวกลมอ้วน ตาโต แก้มป่อง โทนพาสเทล)
2. ลบพื้นหลังให้โปร่งใส (กันขอบเหลือรอยขาว) แล้วบันทึกเป็น **ชื่อไฟล์เดิม** เช่น `sprites/thinking.png`
3. รัน `node tools/pixelate-sprites.js` เพื่อแปลงเป็นพิกเซลอาร์ตชุดเดียวกัน (ต้นฉบับเดิมจะถูกเก็บใน `sprites/original/`)
4. รัน `node tools/make-icons.js` เพื่อสร้างไอคอนใหม่จาก `sprites/idle.png` (และ `node tools/pixelate-sleepy.js` ถ้าเปลี่ยนชีตหลับด้วย)
5. รีเฟรชหน้าเว็บ — เสร็จ 🎉

> ขนาดแสดงผลของหน้าเว็บคือ **192px (3×64)** และใส่ `image-rendering: pixelated` ไว้แล้ว
> ถ้าใช้ภาพชุดใหม่ที่ยังเป็น 512 เท่าเดิม ขนาดก็ยังลงตัว

> แอนิเมชันที่ฝังในไฟล์ SVG ตัว-original (หางส่าย, Zzz) จะหายไปเมื่อใช้ภาพ PNG
> แต่แอนิเมชันระดับหน้าเว็บทั้งหมด (หายใจ, เงา, เดิน, เด้ง, นอน, น้ำหยด, ประกาย, หัวใจ, ลูบหัว)
> ยังทำงานเหมือนเดิม เพราะวาดด้วย CSS ทับรูปทุกท่า

## 🗂 โครงสร้างไฟล์

```
index.html          ← หน้าเว็บหลัก (HTML+CSS+JS ล้วน)
status.json         ← ข้อมูลรันไทม์: เขียนสถานะ (สร้างอัตโนมัติ · ไม่ track)
garden.json         ← ข้อมูลรันไทม์: สวน (งอกเองตอน done · ไม่ track)
set-status.js       ← คำสั่งเขียนสถานะจาก terminal
demo.js             ← สคริปต์ทดสอบ สลับสถานะเองทุก 3 วินาที
tests/              ← เทสต์หน่วย + เทสต์เบราว์เซอร์ headless (node --test ไม่ต้องลงอะไรเพิ่ม)
sprites/            ← ภาพน้องส้ม 6 ท่า พิกเซลอาร์ต (png หลัก 512 + svg สำรอง)
sprites/original/   ← ต้นฉบับ 512 ก่อนแปลง (สำรองไว้ให้รันตัวแปลงซ้ำได้)
assets/             ← สไปรต์ชีตหลับ 2×2 (พิกเซล 1024) + assets/original/ ต้นฉบับ 1920
tools/              ← สคริปต์แปลงภาพ (pixelate-sprites · pixelate-sleepy · make-icons + หน้าเทียบ compare-sprites.html)
icons/              ← ไอคอนแอป (favicon / 192 / 512 / apple-touch) เจนจาก sprites/idle.png
manifest.webmanifest← ข้อมูลแอปสำหรับติดตั้ง (ชื่อ, ไอคอน, สีพื้น)
sw.js               ← service worker (แคชเปลือกแอป แต่ไม่แคช status.json)
AGENTS.md           ← กติกาให้เอเจนต์อ่าน (Codex / Cursor / Copilot อ่านอัตโนมัติ)
CLAUDE.md           ← ตัวชี้ของ Claude Code (สั่ง import @AGENTS.md)
GEMINI.md           ← ตัวชี้ของ Gemini CLI (สั่ง import @./AGENTS.md)
examples/           ← ตัวอย่าง status.json / garden.json / soms.config.json
desktop/            ← desktop pet ด้วย Electron (Windows): main / preload / renderer / lib / powershell + เทสต์หน่วย
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
| `idle` | asleep with floating Zzz (auto after 10 min of silence) 😴 | "nobody's here... Zzz 😴" |

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
`window` (optional) is a partial window title of the agent's window, used by the desktop pet —
clicking Som brings that window to the front (see the desktop pet section).

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

> 📝 `status.json` and `garden.json` are **runtime data** (your status and garden), so they are
> `.gitignore`d and never committed — the first `node set-status.js` (or `node demo.js`) creates them.
> Copy the seeds from [`examples/status.json`](examples/status.json) /
> [`examples/garden.json`](examples/garden.json) if you want a starting point.

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

Built-in `node:test` — nothing to install (30 tests):

```bash
node --test "tests/*.test.js"
```

| File | Covers |
|---|---|
| `tests/set-status.test.js` | status writing, plant kinds, streak continuity/gaps, broken `garden.json`, `--ttl` clamping |
| `tests/pixel-assets.test.js` | generated art: the six poses really are nearest ×8, binary alpha, one 24-colour palette · every icon pixel matches `sprites/idle.png` |
| `tests/browser-smoke.test.js` | drives the **real page in headless Chrome/Edge**: every pose (sprite, bubble, pill), `ttlMinutes`, unknown status, garden rendering, ISO date yellowing, `aria-live`/`aria-pressed`, motion (breathing, drops, sparkles, hearts), click-to-pet, `prefers-reduced-motion`, `.png → .svg` fallback |

Each test builds a throwaway copy of the site and serves it itself, so the real
`status.json` / `garden.json` are never touched, and temp folders are cleaned up.

> 💡 The browser test **skips** (it does not pass) when no Chrome/Edge is found.
> Point at one with `CHROME_PATH="/path/to/chrome" node --test "tests/*.test.js"`.
>
> 🖥️ Desktop pet tests (the non-GUI parts: window matching, status reading, menu) run separately: `cd desktop && npm test`.

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

## 🖥️ Desktop pet (Electron · Windows)

Som as a **transparent, frameless, always-on-top** window with no taskbar entry, sized to your
primary display's work area. The whole window is click-through **except Som and the speech bubble**,
and Som waddles along the bottom edge above the taskbar. It polls `status.json` every second with the
exact same rules as the web page (sleep timer, `ttlMinutes`, the same `sprites/` files), plus one
extra 4-frame sleep sprite sheet in `assets/` (see below).

```bash
cd desktop
npm install      # first run (~300MB for Electron)
npm start
```

| Action | Result |
|---|---|
| Hover Som or the bubble | That spot takes clicks; everything else stays click-through |
| Click Som | Brings the agent's window (the `window` field in `status.json`) to the front — restores it when minimized; if it can't be found or raised, Som says so in the bubble instead of crashing |
| Right-click Som | Menu: **go to the agent window** · **open the garden** (`gardenUrl` from `soms.config.json`, default `http://localhost:3000`) · **quit Som** |

Regular poses reuse the existing PNGs (the walk is pure CSS/JS, no new sprite frames):
`coding` walks with a per-step bob and tilt, flips with direction, turns at edges or pauses briefly ·
`thinking` sits still · `success` hops once · `error` sprawls · `done` lies belly-up — and
`prefers-reduced-motion` is respected.

### 😴 Sleepy mode (desktop pet only)

When the status is `idle` — **including going quiet past `ttlMinutes`**, when `lib/status.js` turns it
into idle — Som switches to `assets/soms-garden-fat-lazy-cat-sleepy-spritesheet.png`
(a 2×2 sheet: curled up · yawning · rolling · belly-up) and switches back to the regular pose
**immediately** when any other status arrives.

- `6s steps(1, end)` — 1.5s per frame, each pose held then cut to the next (no fading)
- The sheet is **pixel art from the same set as the six poses**: 4 frames of 512 each (64×64 ×8 nearest)
  forming 1024; `background-size` is twice `--pet-size`, so one frame is exactly `--pet-size` wide
  and no `clip-path` is needed any more
- Every frame is placed so its **ground line and horizontal centre match `sprites/idle.png`**
  (measured from each cat's alpha bounding box) — switching `idle` ↔ sleepy never makes the cat jump
  (there is a test for it)
- `image-rendering: pixelated`, like the regular poses
- `prefers-reduced-motion: reduce` freezes the first frame
- Flip it manually from DevTools: `window.somMode('sleepy')` / `window.somMode('normal')`

The sheet converter lives in [`tools/pixelate-sleepy.js`](tools/pixelate-sleepy.js): it backs the
original sheet up to `assets/original/`, splits the four frames, area-downscales them, forces alpha
to 0/255, maps them onto the 24-colour palette **read back from `sprites/*.png`** (no new colours)
and upscales nearest ×8.

```bash
node tools/pixelate-sleepy.js             # convert the sheet from assets/original (deterministic)
```

> Replacing the sheet yourself? Overwrite `assets/soms-garden-fat-lazy-cat-sleepy-spritesheet.png`
> and run the converter above — no CSS edits needed, the geometry is aligned to `sprites/idle.png`.

### Tell Som which window you are in

```bash
node set-status.js --list-windows                        # list open windows
node set-status.js coding "working" --window "Codex"     # bind the status to a window
node set-status.js done "done" fix --window "VS Code"    # a fragment is fine, case-insensitive
```

- Without `--window` the default comes from `soms.config.json` at the repo root ([example](examples/soms.config.json))

```json
{
  "window": "Codex",
  "gardenUrl": "http://localhost:3000",
  "petSize": 192
}
```

- `petSize` sets the desktop pet's on-screen size and must be a whole multiple of 64
  (64/128/192/256/320/384, default 192) so the pixel art stays crisp — restart `npm start` after changing it

> 💻 Tested on **Windows** — finding/raising windows goes through PowerShell + Win32, so that part is
> Windows-only (the window name is passed as a process argument, never spliced into a command string,
> so it is safe from command injection).

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

Every pose is **64×64 pixel art upscaled ×8 = 512×512** (transparent, binary alpha, uploaded as
one file per pose in `sprites/`), with the pre-conversion 512 originals kept in `sprites/original/`
(the original SVGs stay as fallback — the page loads `.png` first and falls back to `.svg` when a PNG is missing).
The sleep sheet in `assets/` and the icons in `icons/` are generated from the same converters and
share the same 24-colour palette.

```
sprites/thinking.png   sprites/coding.png   sprites/success.png
sprites/error.png      sprites/done.png     sprites/idle.png
sprites/original/*.png    ← untouched 512 originals (not loaded at runtime)
(+ sprites/*.svg  vector fallback files)
assets/soms-garden-fat-lazy-cat-sleepy-spritesheet.png  ← 2×2 sleep sheet (1024 pixel art)
assets/original/…                                       ← untouched 1920 sheet
icons/*.png                                             ← app icons, generated from sprites/idle.png
```

The converter lives in [`tools/pixelate-sprites.js`](tools/pixelate-sprites.js): area-downscale 512 → 64,
one shared 24-colour palette for all six poses, alpha forced to 0/255, then nearest-neighbour ×8.
Details that would otherwise vanish are repaired per pose in the script's `TOUCHUPS` / `KEEP_DETAILS`:
the `idle` Zzz is redrawn, the blue `error` tears are kept from turning muddy and extended into a drip,
and the `success` smile gets a 3-pixel mouth with a pink tongue — re-running is deterministic.

```bash
node tools/pixelate-sprites.js            # convert all six poses from sprites/original
node tools/pixelate-sprites.js --help     # --size / --scale / --colors / --alpha
node tools/pixelate-sleepy.js             # convert the 2×2 sleep sheet onto the same palette
node tools/make-icons.js                  # rebuild every icon from sprites/idle.png
```

Using your own art? Just **overwrite the same file names** — no code changes:

1. Generate Som in each pose (chubby round orange cat, big eyes, puffy cheeks, pastel tones)
2. Remove the background so it is transparent (no white edge halo), then save with the **same file name** (e.g. `sprites/thinking.png`)
3. Run `node tools/pixelate-sprites.js` so the whole set shares one pixel-art palette (the originals are backed up to `sprites/original/`)
4. Run `node tools/make-icons.js` to rebuild the app icons from `sprites/idle.png` (plus `node tools/pixelate-sleepy.js` if you changed the sleep sheet)
5. Refresh — done 🎉

> Animations baked into the original SVG files (tail sway, Zzz) disappear with a replacement, but every
> page-level motion (breathing, shadow, waddle, hop, water drops, sparkles, hearts, petting) is drawn in CSS
> on top of whichever art you use, so it keeps working.

## 📄 License

MIT — use it, modify it, share it, just keep the license. 🐾
