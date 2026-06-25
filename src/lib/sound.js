// เสียงเฉลิมฉลองตอนทำข้อสอบเสร็จ — สร้างจาก Web Audio API (ไม่ต้องโหลดไฟล์เสียง)

let ctx

function getCtx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume?.()
  return ctx
}

// เล่นโน้ตหนึ่งตัว (มี fade in/out กันเสียงปะทุ)
function tone(ac, freq, start, dur, gainVal = 0.18, type = 'triangle') {
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(g)
  g.connect(ac.destination)
  const t0 = ac.currentTime + start
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(gainVal, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)
}

// เล่นเสียงตอนทำข้อสอบเสร็จ — โทนต่างกันตามคะแนน (pct = 0..1)
export function playFinishSound(pct = 1) {
  try {
    const ac = getCtx()
    if (!ac) return
    // อาร์เพจจิโอเมเจอร์ขึ้น (ไพเราะ) — คะแนนยิ่งสูงยิ่งสดใสและครบโน้ต
    const notes =
      pct >= 0.8
        ? [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
        : pct >= 0.5
          ? [523.25, 659.25, 783.99] // C5 E5 G5
          : [392.0, 523.25] // G4 C5 (อ่อนโยนให้กำลังใจ)
    notes.forEach((f, i) => tone(ac, f, i * 0.12, 0.38, 0.18))
    // ได้คะแนนเต็ม -> ใส่โน้ตปลายให้ฟินขึ้น
    if (pct >= 1) tone(ac, 1318.51, notes.length * 0.12, 0.55, 0.14) // E6
  } catch {
    /* ถ้าเบราว์เซอร์เล่นไม่ได้ ก็เงียบไว้ */
  }
}
