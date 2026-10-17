'use strict';
/**
 * renderer.js — ขับเคลื่อนน้องส้มบนเดสก์ท็อป
 *
 * สถานะทั้งหมดมาจาก main (อ่าน status.json ทุก 1 วินาที) — หน้าที่ของที่นี่คือ:
 * - สลับภาพท่าทาง (.png ก่อน ไม่พบค่อย .svg) ตาม status เดียวกับหน้าเว็บ
 * - เดินไปมาตามขอบล่างเฉพาะตอน coding (CSS/JS ล้วน ไม่มีสไปรต์เฟรมใหม่)
 * - ฟองคำพูดลอยตามตัวน้อง + ข้อความตอบกลับตอนคลิก
 * - เปิด/ปิดคลิกทะลุตามตำแหน่งเมาส์ (ส่ง IPC ให้ main เรียก setIgnoreMouseEvents)
 */
(function () {
  var API = window.som;
  if (!API) {
    document.body.textContent = 'โหลด preload ไม่สำเร็จ — เริม npm start ใหม่อีกครั้ง';
    return;
  }

  var rig = document.getElementById('rig');
  var pet = document.getElementById('pet');
  var sprite = document.getElementById('sprite');
  var bubble = document.getElementById('bubble');
  var bubbleText = document.getElementById('bubbleText');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var SPEED = 46;                       // ความเร็วเดิน (px/วินาที)

  var state = { status: 'idle', line: 'กำลังตื่นอยู่... 🍊', window: null };
  var lastLine = state.line;
  var rigX = 0;
  var dir = 1;                          // 1 = ไปขวา, -1 = ไปซ้าย
  var walking = false;
  var pauseUntil = 0;                   // เวลาที่จะหยุดพักสั้น ๆ (ms จาก rAF)
  var lastT = 0;
  var interactive = false;
  var overlayUntil = 0;
  var overlayTimer = null;
  var hopTimer = null;

  function petW() {
    return rig.offsetWidth || 170;
  }
  function maxX() {
    return Math.max(0, window.innerWidth - petW());
  }
  function startCenter() {
    rigX = Math.max(0, (window.innerWidth - petW()) / 2);
  }

  /* ---------- ภาพท่าทาง: .png ก่อน ไม่พบค่อย fallback เป็น .svg ---------- */
  function setSprite(status) {
    delete sprite.dataset.fb;
    sprite.onerror = function () {
      if (!sprite.dataset.fb) {
        sprite.dataset.fb = '1';
        sprite.src = '../../sprites/' + status + '.svg';
      } else {
        sprite.onerror = null;           // ไม่มีทั้งคู่ → หยุดวน
      }
    };
    sprite.src = '../../sprites/' + status + '.png';
  }

  function showLine(text) {
    bubbleText.textContent = text;
    bubble.classList.toggle('show', !!text);
  }

  /** ข้อความชั่วคราว (ตอบกลับตอนคลิก) แล้วคืนไปพูดตามสถานะจริง */
  function toast(message) {
    if (!message) return;
    overlayUntil = Date.now() + 2200;
    showLine(message);
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(function () {
      overlayUntil = 0;
      showLine(lastLine);
    }, 2200);
  }

  function applyState(s) {
    state = s;
    if (sprite.dataset.status !== s.status) {
      sprite.dataset.status = s.status;
      rig.dataset.status = s.status;
      setSprite(s.status);
      if (s.status === 'success' && !reduced.matches) {
        rig.classList.add('hop');                 // กระโดดหนึ่งครั้งแล้วอยู่กับที่
        clearTimeout(hopTimer);
        hopTimer = setTimeout(function () {
          rig.classList.remove('hop');
        }, 900);
      }
    }
    lastLine = s.line;
    if (Date.now() >= overlayUntil) showLine(s.line);   // อย่าทับข้อความตอบกลับ
  }

  /* ---------- คลิก = ดึงหน้าต่างเอเจนต์ · คลิกขวา = เมนู ---------- */
  pet.addEventListener('click', function () {
    var p = API.focusAgentWindow();
    if (p && typeof p.then === 'function') {
      p.then(function (r) {
        if (r) toast(r.message);
      }).catch(function () {});
    }
  });

  document.addEventListener('contextmenu', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('#pet, #bubble')) {
      e.preventDefault();
      API.showMenu(e.clientX, e.clientY);
    }
  });

  /* ---------- คลิกทะลุ: เปิดรับเมาส์เฉพาะตอนชี้ที่ตัวน้อง/ฟอง ---------- */
  document.addEventListener('mousemove', function (e) {
    var t = e.target;
    var on = !!(t && t.closest && t.closest('#pet, #bubble'));
    if (on !== interactive) {
      interactive = on;
      API.setInteractive(on);
    }
  });
  document.documentElement.addEventListener('mouseleave', function () {
    if (interactive) {
      interactive = false;
      API.setInteractive(false);
    }
  });

  /* ---------- วงจรหลัก: เดิน + ฟองลอยตาม ---------- */
  function frame(t) {
    if (!lastT) lastT = t;
    var dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;

    var shouldWalk = state.status === 'coding' && !reduced.matches;
    if (shouldWalk !== walking) {
      walking = shouldWalk;
      rig.classList.toggle('walking', walking);
    }

    if (walking && t >= pauseUntil) {
      rigX += dir * SPEED * dt;
      if (rigX <= 0) {
        rigX = 0;
        dir = 1;                            // ถึงขอบซ้าย → เลี้ยวกลับ
      } else if (rigX >= maxX()) {
        rigX = maxX();
        dir = -1;                           // ถึงขอบขวา → เลี้ยวกลับ
      }
      if (Math.random() < 0.6 * dt) {
        pauseUntil = t + 400 + Math.random() * 900;   // สุ่มหยุดสั้น ๆ บ้าง
      }
    }

    rig.style.transform = 'translateX(' + rigX.toFixed(1) + 'px)';
    pet.style.transform = 'scaleX(' + (dir < 0 ? -1 : 1) + ')';   // พลิกภาพตามทิศทาง

    // ฟอง: อยู่เหนือหัวตลอด แต่ไม่ให้ล้นขอบจอ
    var cx = rigX + petW() / 2;
    var half = bubble.offsetWidth / 2;
    var shift = 0;
    if (half > 0) {
      var lo = half + 6;
      var hi = window.innerWidth - half - 6;
      if (lo <= hi) shift = Math.min(Math.max(cx, lo), hi) - cx;
    }
    bubble.style.transform = 'translateX(calc(-50% + ' + shift.toFixed(1) + 'px))';

    requestAnimationFrame(frame);
  }

  /* ---------- เริ่มทำงาน ---------- */
  API.onStatus(applyState);
  API.onToast(function (t) {
    toast(t && t.message);
  });

  startCenter();
  window.addEventListener('resize', function () {
    if (rigX > maxX()) rigX = maxX();
  });
  showLine(lastLine);
  requestAnimationFrame(frame);

  /* ---------- ทักทาย main ครั้งแรก (ใช้ตรวจในโหมด smoke) ---------- */
  var said = false;
  function hello() {
    if (said) return;
    said = true;
    API.hello({
      width: window.innerWidth,
      height: window.innerHeight,
      reducedMotion: reduced.matches,
      spriteLoaded: sprite.naturalWidth > 0,
      spriteSize: sprite.naturalWidth + 'x' + sprite.naturalHeight,
    });
  }
  sprite.addEventListener('load', hello);
  if (sprite.complete && sprite.naturalWidth > 0) hello();
  setTimeout(hello, 1500);
})();
