import { useId } from 'react'

// ต้นไม้ 2D สไตล์การ์ตูน + ไล่แสงเงาให้ดูมีมิติ + โยกซ้ายขวาเบา ๆ
// อิงภาพอ้างอิง 20 ระยะ: ต้นอ่อนใบคู่ -> ต้นกล้า -> พุ่มกลม -> ออกดอก -> ดอกหลากสีเต็มต้น

function greensOf(lv) {
  if (lv >= 13) return { lite: '#7fd36a', mid: '#4faf49', dark: '#2f7d34' }
  if (lv >= 8) return { lite: '#8ede73', mid: '#5cbb50', dark: '#3a8f3b' }
  return { lite: '#a6e88a', mid: '#74cc5f', dark: '#4aa544' }
}
function bloomOf(lv) {
  if (lv === 10) return { colors: ['#f48fb1', '#ec5f9e'], n: 10 }
  if (lv >= 16 && lv <= 17) return { colors: ['#f6a5c0', '#f48fb1'], n: 8 }
  if (lv >= 18 && lv <= 19) return { colors: ['#ec5f9e', '#f48fb1'], n: 14 }
  if (lv >= 20) return { colors: ['#e0409f', '#ffd23e', '#f48fb1', '#b657c9', '#ff8f3f'], n: 34 }
  return null
}

// เส้นทางรูปใบไม้ (ปลายแหลม) วิ่งจากโคน (0,0) ออกไปทาง +x
function leafPath(len, wid) {
  return `M0,0 C${len * 0.4},${-wid} ${len * 0.9},${-wid * 0.5} ${len},0 C${len * 0.9},${wid * 0.5} ${len * 0.4},${wid} 0,0 Z`
}

// เลข "สุ่ม" แบบคงที่ตามเลเวล (ฟอร์มเดิมทุกครั้ง)
function seeded(lv) {
  let a = (lv * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function TreeSprite({ level = 1, className = '' }) {
  const cap = Math.max(1, Math.min(Math.round(level), 20))
  const uid = useId().replace(/:/g, '')
  const G = greensOf(cap)
  const rnd = seeded(cap)
  const groundY = 232
  const cx = 100

  const gid = (n) => `${uid}-${n}`

  let content
  if (cap <= 7) {
    // ---- ต้นอ่อน / ต้นกล้า ----
    const stemH = 20 + cap * 6.5
    const stemTopY = groundY - stemH
    const leaves = []
    if (cap === 1) {
      leaves.push({ y: groundY - stemH * 0.5, rot: -80, len: 40, wid: 24 })
    } else {
      const pairs = Math.min(cap - 1, 4)
      for (let i = 0; i < pairs; i++) {
        const f = pairs === 1 ? 0.6 : i / (pairs - 1) // 0 ล่างสุด -> 1 บนสุด
        const y = groundY - stemH * (0.42 + f * 0.5)
        const spread = 60 - f * 28 // ล่างกางกว่า บนตั้งกว่า
        const len = 30 - f * 8 + cap * 0.9
        const wid = len * 0.5
        leaves.push({ y, rot: -(90 - spread), len, wid }) // ขวา
        leaves.push({ y, rot: -(90 + spread), len, wid }) // ซ้าย
      }
      leaves.push({ y: stemTopY + 3, rot: -85, len: 15 + cap, wid: 9 + cap * 0.5 })
    }
    const face = cap >= 2 && cap <= 4
    content = (
      <g className="tree-sway" style={{ transformOrigin: '100px 232px' }}>
        {/* ลำต้นเขียว (เตี้ย เรียว) */}
        <path
          d={`M${cx - 3.2},${groundY} C${cx - 3.6},${stemTopY + 10} ${cx - 2},${stemTopY} ${cx},${stemTopY} C${cx + 2},${stemTopY} ${cx + 3.6},${stemTopY + 10} ${cx + 3.2},${groundY} Z`}
          fill={`url(#${gid('stem')})`}
          stroke="#3f8a3a"
          strokeWidth="1.3"
        />
        {leaves.map((lf, i) => (
          <path
            key={i}
            d={leafPath(lf.len, lf.wid)}
            transform={`translate(${cx},${lf.y}) rotate(${lf.rot})`}
            fill={`url(#${gid('leaf')})`}
            stroke="#3f8a3a"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        ))}
        {face && (
          <g>
            <circle cx={cx - 9} cy={groundY + 2} r="2.5" fill="#3a2a1a" />
            <circle cx={cx + 9} cy={groundY + 2} r="2.5" fill="#3a2a1a" />
            <circle cx={cx - 16} cy={groundY + 6} r="3.2" fill="#f29bb0" opacity="0.85" />
            <circle cx={cx + 16} cy={groundY + 6} r="3.2" fill="#f29bb0" opacity="0.85" />
            <path d={`M${cx - 4.5},${groundY + 7} Q${cx},${groundY + 11} ${cx + 4.5},${groundY + 7}`} stroke="#3a2a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
        )}
      </g>
    )
  } else {
    // ---- ต้นไม้ ----
    const age = cap - 7
    const trunkH = 60 + age * 5
    const trunkW = 12 + age * 1.6
    const trunkTopY = groundY - trunkH
    const baseR = 34 + age * 2.6
    const canopyCy = trunkTopY - baseR * 0.35

    // ก้อนพุ่มเป็นทรงเมฆ
    const circles = [{ x: cx, y: canopyCy, r: baseR }]
    const ringN = 7
    for (let i = 0; i < ringN; i++) {
      const ang = (i / ringN) * Math.PI * 2
      const dist = baseR * 0.82
      circles.push({
        x: cx + Math.cos(ang) * dist,
        y: canopyCy - Math.sin(ang) * dist * 0.72 - baseR * 0.05,
        r: baseR * (0.6 + (i % 2) * 0.06),
      })
    }
    circles.push({ x: cx, y: canopyCy - baseR * 0.7, r: baseR * 0.66 })

    const bloom = bloomOf(cap)
    const flowers = []
    if (bloom) {
      for (let i = 0; i < bloom.n; i++) {
        const ang = rnd() * Math.PI * 2
        const rad = baseR * (0.35 + rnd() * 0.72)
        flowers.push({
          x: cx + Math.cos(ang) * rad,
          y: canopyCy - Math.sin(ang) * rad * 0.8 - baseR * 0.05,
          r: 4.5 + rnd() * 3.5,
          c: bloom.colors[Math.floor(rnd() * bloom.colors.length)],
        })
      }
    }

    // กิ่งเมื่อโต
    const branches = []
    if (cap >= 10) {
      branches.push({ x2: cx - trunkW * 1.6, y2: trunkTopY + 10 })
      branches.push({ x2: cx + trunkW * 1.6, y2: trunkTopY + 6 })
    }

    content = (
      <g className="tree-sway" style={{ transformOrigin: '100px 232px' }}>
        {/* ลำต้น */}
        <path
          d={`M${cx - trunkW / 2},${groundY} C${cx - trunkW * 0.42},${groundY - trunkH * 0.5} ${cx - trunkW * 0.3},${trunkTopY + 6} ${cx - trunkW * 0.28},${trunkTopY} L${cx + trunkW * 0.28},${trunkTopY} C${cx + trunkW * 0.3},${trunkTopY + 6} ${cx + trunkW * 0.42},${groundY - trunkH * 0.5} ${cx + trunkW / 2},${groundY} Z`}
          fill={`url(#${gid('trunk')})`}
          stroke="#5c3c1c"
          strokeWidth="1.6"
        />
        {branches.map((b, i) => (
          <line key={i} x1={cx} y1={trunkTopY + 18} x2={b.x2} y2={b.y2} stroke="#7a5228" strokeWidth={trunkW * 0.32} strokeLinecap="round" />
        ))}
        {/* เส้นขอบพุ่ม (วงเข้มด้านหลัง) */}
        {circles.map((c, i) => (
          <circle key={`o${i}`} cx={c.x} cy={c.y} r={c.r + 3.2} fill={G.dark} />
        ))}
        {/* พุ่ม (ไล่แสง) */}
        {circles.map((c, i) => (
          <circle key={`c${i}`} cx={c.x} cy={c.y} r={c.r} fill={`url(#${gid('can')})`} />
        ))}
        {/* ไฮไลต์แสงมุมบนซ้าย */}
        <ellipse cx={cx - baseR * 0.4} cy={canopyCy - baseR * 0.4} rx={baseR * 0.5} ry={baseR * 0.36} fill="#ffffff" opacity="0.14" />
        {/* ดอก */}
        {flowers.map((f, i) => (
          <g key={`f${i}`}>
            <circle cx={f.x} cy={f.y} r={f.r + 1} fill="#00000022" />
            <circle cx={f.x} cy={f.y} r={f.r} fill={f.c} />
            <circle cx={f.x - f.r * 0.28} cy={f.y - f.r * 0.28} r={f.r * 0.4} fill="#ffffff" opacity="0.55" />
          </g>
        ))}
      </g>
    )
  }

  return (
    <svg viewBox="0 0 200 260" className={className} style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <radialGradient id={gid('can')} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor={G.lite} />
          <stop offset="55%" stopColor={G.mid} />
          <stop offset="100%" stopColor={G.dark} />
        </radialGradient>
        <linearGradient id={gid('leaf')} x1="0%" y1="0%" x2="100%" y2="60%">
          <stop offset="0%" stopColor={G.lite} />
          <stop offset="100%" stopColor={G.mid} />
        </linearGradient>
        <linearGradient id={gid('stem')} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#5fa63a" />
          <stop offset="50%" stopColor="#7ec95a" />
          <stop offset="100%" stopColor="#4f9233" />
        </linearGradient>
        <linearGradient id={gid('trunk')} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6b4423" />
          <stop offset="45%" stopColor="#a06a34" />
          <stop offset="100%" stopColor="#5c3a1c" />
        </linearGradient>
      </defs>
      {/* เงาบนพื้น */}
      <ellipse cx={cx} cy="240" rx="52" ry="10" fill="#00000022" />
      {/* เนินดิน */}
      <ellipse cx={cx} cy="232" rx="46" ry="15" fill="#7a552f" />
      <ellipse cx={cx} cy="230" rx="46" ry="13" fill="#8a622f" />
      <ellipse cx={cx} cy="228" rx="40" ry="9" fill="#98703a" />
      {content}
    </svg>
  )
}
