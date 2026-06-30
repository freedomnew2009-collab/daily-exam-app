import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'

// สุ่มแบบมี seed (ฟอร์มเดิมทุกครั้งสำหรับเลเวลเดียวกัน ไม่กระพริบตอน re-render)
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GREENS = ['#4caf50', '#43a047', '#66bb6a', '#388e3c', '#5cc85f', '#2e9e4f']

function Tree({ level }) {
  const g = useRef()
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.45
  })

  const L = Math.max(1, level)
  const cap = Math.min(L, 12)

  const model = useMemo(() => {
    const rnd = mulberry32(1000 + cap)
    const trunkH = 0.55 + Math.min(cap, 10) * 0.16
    const trunkTop = 0.35 + trunkH
    // ทรงพุ่มใบ (รัศมีแนวนอน/ตั้ง โตตามเลเวล)
    const rx = 0.5 + Math.min(cap, 11) * 0.11
    const ry = 0.42 + Math.min(cap, 11) * 0.08
    const cy = trunkTop + ry * 0.55 // จุดศูนย์กลางพุ่ม

    // ใบ: คลัสเตอร์ทรงรีหลายลูกซ้อนกัน ยิ่งเลเวลสูงยิ่งเยอะ
    const leafCount = Math.round(10 + cap * 5)
    const leaves = []
    for (let i = 0; i < leafCount; i++) {
      const u = rnd() * Math.PI * 2
      const v = Math.acos(2 * rnd() - 1)
      const rr = 0.55 + 0.45 * rnd() // กระจายในก้อนพุ่ม
      const x = Math.cos(u) * Math.sin(v) * rx * rr
      const y = cy + Math.cos(v) * ry * rr
      const z = Math.sin(u) * Math.sin(v) * rx * rr
      const s = 0.26 + rnd() * 0.22 + cap * 0.012
      leaves.push({ p: [x, y, z], s, c: GREENS[Math.floor(rnd() * GREENS.length)] })
    }

    // ดอก/ผล เมื่อโตพอ
    const decos = []
    if (cap >= 4) {
      const n = Math.min(3 + (cap - 3) * 2, 16)
      for (let i = 0; i < n; i++) {
        const u = rnd() * Math.PI * 2
        const v = 0.3 + rnd() * 1.5
        const x = Math.cos(u) * Math.sin(v) * rx * 0.85
        const y = cy + Math.cos(v) * ry * 0.7
        const z = Math.sin(u) * Math.sin(v) * rx * 0.85
        const flower = cap < 7
        decos.push({ p: [x, y, z], s: flower ? 0.1 : 0.12, c: flower ? '#ffd34e' : '#ff5d8f' })
      }
    }

    const top = cy + ry
    const totalH = top + 0.3 // +ฐานกระถาง
    const fit = Math.min(1, 3.4 / totalH) // ย่อให้พอดีกรอบเสมอ
    return { trunkH, trunkTop, leaves, decos, fit, totalH }
  }, [cap])

  const { trunkH, trunkTop, leaves, decos, fit, totalH } = model

  return (
    <group ref={g}>
      {/* ย่อ-จัดกึ่งกลางให้ทั้งต้นอยู่ในกรอบ */}
      <group scale={fit} position={[0, -(totalH * fit) / 2 - 0.1, 0]}>
        {/* กระถาง */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.6, 0.44, 0.58, 24]} />
          <meshStandardMaterial color="#cf6a43" flatShading />
        </mesh>
        <mesh position={[0, 0.29, 0]}>
          <cylinderGeometry args={[0.58, 0.58, 0.12, 24]} />
          <meshStandardMaterial color="#5a3826" />
        </mesh>
        {/* ลำต้น */}
        <mesh position={[0, 0.35 + trunkH / 2, 0]}>
          <cylinderGeometry args={[0.09, 0.15, trunkH, 10]} />
          <meshStandardMaterial color="#8a5a2b" flatShading />
        </mesh>
        {/* กิ่งเล็ก ๆ เมื่อโต */}
        {cap >= 3 && (
          <mesh position={[0.12, trunkTop - 0.15, 0]} rotation={[0, 0, -0.6]}>
            <cylinderGeometry args={[0.04, 0.06, 0.4, 8]} />
            <meshStandardMaterial color="#8a5a2b" flatShading />
          </mesh>
        )}
        {/* ใบ (พุ่มเต็ม) */}
        {leaves.map((lf, i) => (
          <mesh key={i} position={lf.p}>
            <icosahedronGeometry args={[lf.s, 1]} />
            <meshStandardMaterial color={lf.c} flatShading />
          </mesh>
        ))}
        {/* ดอก/ผล */}
        {decos.map((d, i) => (
          <mesh key={i} position={d.p}>
            <icosahedronGeometry args={[d.s, 0]} />
            <meshStandardMaterial color={d.c} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function Tree3D({ level = 1 }) {
  return (
    <Canvas camera={{ position: [0, 0, 6 ], fov: 42 }} dpr={[1, 2]}>
      <ambientLight intensity={0.82} />
      <directionalLight position={[3, 6, 4]} intensity={1.15} />
      <directionalLight position={[-4, 2, -3]} intensity={0.35} color="#bdf0ff" />
      <Suspense fallback={null}>
        <Tree level={level} />
      </Suspense>
    </Canvas>
  )
}
