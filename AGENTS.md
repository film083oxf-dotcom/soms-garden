# AGENTS.md — กติกาสำหรับ AI coding agent

repo นี้มีมาสคอตชื่อ **น้องส้ม** (`index.html`) ที่อ่าน `status.json` ทุก 1 วินาที
แล้วเปลี่ยนท่าทางตามสถานะ — หน้าที่ของคุณคือ **เล่าสถานะการทำงานให้มันรู้** ด้วยคำสั่งด้านล่าง

## เรียกเมื่อไหร่

เรียก **เฉพาะตอนเปลี่ยนช่วงงาน** (ไม่ใช่ทุกคำสั่งที่รัน) โดยประมาณนี้

| จังหวะ | คำสั่ง |
|---|---|
| เริ่มวางแผน อ่านโค้ด สำรวจโปรเจกต์ | `node set-status.js thinking "ข้อความสั้น ๆ ว่ากำลังคิดเรื่องอะไร"` |
| เริ่มลงมือแก้/เขียนไฟล์จริง | `node set-status.js coding "ข้อความสั้น ๆ ว่ากำลังทำอะไร"` |
| รันเทสต์/บิลด์ **ผ่าน** | `node set-status.js success "ข้อความสั้น ๆ"` |
| รันเทสต์/บิลด์ **ไม่ผ่าน** | `node set-status.js error "ข้อความสั้น ๆ"` |
| **จบงานทั้งหมด** | `node set-status.js done "สรุปสั้น ๆ" <fix\|feature\|docs>` |

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

Call them **only when the phase changes**, never for every command you run:

| When | Command |
|---|---|
| Planning, reading code, exploring | `node set-status.js thinking "short Thai note"` |
| Starting to edit/write files | `node set-status.js coding "short Thai note"` |
| Tests or build **pass** | `node set-status.js success "short note"` |
| Tests or build **fail** | `node set-status.js error "short note"` |
| **All work finished** | `node set-status.js done "short summary" <fix\|feature\|docs>` |

Rules: messages stay **short (~40 chars) and in Thai**, `done` always carries a task type
(`fix` flower · `feature` tree · `docs` bush) and is called **once**, only when the whole task is
really finished — every `done` grows one plant. Add `--ttl=<minutes>` for tasks longer than
10 minutes so Som does not fall asleep. If the command fails (no Node, wrong directory), ignore it
and keep working; the mascot must never block the task.
