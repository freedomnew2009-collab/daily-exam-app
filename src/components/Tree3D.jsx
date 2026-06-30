import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'

// สุ่มแบบมี seed (ฟอร์มเดิมทุกครั้งสำหรับเลเวลเดียวกัน)
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

// ช่วงพัฒนาการ: สีใบ + ของประดับ (ต่างกันชัดในแต่ละช่วง)
function stageOf(lv) {
  if (lv <= 2) return { leaves: ['#8ad673', '#9be082', '#7ccb62'], deco: null, decoN: 0 }
  if (lv <= 4) return { leaves: ['#5fc457', '#6ed064', '#54bb50'], deco: null, decoN: 0 }
  if (lv <= 6) return { leaves: ['#4caf50', '#5cc25a', '#46a64d'], deco: '#fff0a8', decoN: 6 } // ตูมเหลืองอ่อน
  if (lv <= 9) return { leaves: ['#48a84f', '#54bb57', '#62c863'], deco: '#ff86bd', decoN: 12 } // ดอกชมพู
  if (lv <= 12) return { leaves: ['#41a04a', '#46a64d', '#3a9143'], deco: '#ef4444', decoN: 14 } // ผลแดง
  if (lv <= 16) return { leaves: ['#2f8b46', '#368f3d', '#43a047'], deco: '#e03131', decoN: 18 } // เขียวเข้ม ผลดก
  return { leaves: ['#36a257', '#41a86a', '#57b85f'], deco: '#ffce3a', decoN: 20, golden: true } // ผลทอง
}

function Tree({ level }) {
  const g = useRef()
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.4
  })

  const L = Math.max(1, level)
  const cap = Math.min(L, 20)

  const model = useMemo(() => {
    const rnd = mulberry32(3000 + cap)
    const st = stageOf(cap)
    const trunkH = 0.55 + Math.min(cap, 18) * 0.1
    const trunkTop = 0.32 + trunkH
    const crownR = 0.6 + Math.min(cap, 18) * 0.05
    const cy = trunkTop + crownR * 0.55

    // พุ่มใบ = ลูกบอลเนียนซ้อนกันเป็นทรงกลมฟู (จัดเป็นระเบียบ ไม่รก)
    const blobs = []
    blobs.push({ p: [0, cy, 0], r: crownR, c: st.leaves[0] }) // ลูกกลาง
    const ringN = Math.min(5 + Math.floor(cap / 4), 9)
    for (let i = 0; i < ringN; i++) {
      const a = (i / ringN) * Math.PI * 2 + (cap % 2 ? 0.35 : 0)
      const rr = crownR * 0.8
      blobs.push({
        p: [Math.cos(a) * rr, cy + (rnd() * 0.18 - 0.04) * crownR, Math.sin(a) * rr],
        r: crownR * 0.6,
        c: i % 2 ? st.leaves[1] : st.leaves[2],
      })
    }
    blobs.push({ p: [0, cy + crownR * 0.72, 0], r: crownR * 0.6, c: st.leaves[1] }) // ลูกบน
    blobs.push({ p: [0, cy + crownR * 0.22, crownR * 0.55], r: crownR * 0.52, c: st.leaves[0] }) // หน้า
    blobs.push({ p: [0, cy + crownR * 0.22, -crownR * 0.55], r: crownR * 0.52, c: st.leaves[2] }) // หลัง

    // ดอก/ผล ติดที่ผิวพุ่ม
    const decos = []
    if (st.deco) {
      for (let i = 0; i < st.decoN; i++) {
        const u = rnd() * Math.PI * 2
        const v = 0.35 + rnd() * 1.4
        const R = crownR * 1.02
        decos.push({
          p: [Math.cos(u) * Math.sin(v) * R, cy + Math.cos(v) * R * 0.92, Math.sin(u) * Math.sin(v) * R],
          s: st.golden || st.deco === '#ef4444' || st.deco === '#e03131' ? 0.13 : 0.095,
        })
      }
    }

    const top = cy + crownR * 1.32
    const totalH = top + 0.3
    const fit = Math.min(1, 3.8 / totalH)
    return { trunkH, trunkTop, blobs, decos, st, fit, totalH }
  }, [cap])

  const { trunkH, blobs, decos, st, fit, totalH } = model

  return (
    <group ref={g}>
      <group scale={fit} position={[0, -(totalH * fit) / 2 - 0.05, 0]}>
        {/* กระถาง */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.58, 0.42, 0.54, 28]} />
          <meshStandardMaterial color="#cf6a43" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.27, 0]}>
          <cylinderGeometry args={[0.56, 0.56, 0.12, 28]} />
          <meshStandardMaterial color="#5a3826" />
        </mesh>
        {/* ลำต้น (เนียน เรียวขึ้นเล็กน้อย) */}
        <mesh position={[0, 0.32 + trunkH / 2, 0]}>
          <cylinderGeometry args={[0.085, 0.16, trunkH, 18]} />
          <meshStandardMaterial color="#9b6633" roughness={0.9} />
        </mesh>
        {/* พุ่มใบ (เนียน) */}
        {blobs.map((b, i) => (
          <mesh key={i} position={b.p}>
            <sphereGeometry args={[b.r, 28, 22]} />
            <meshStandardMaterial color={b.c} roughness={0.9} />
          </mesh>
        ))}
        {/* ดอก/ผล */}
        {decos.map((d, i) => (
          <mesh key={i} position={d.p}>
            <sphereGeometry args={[d.s, 14, 14]} />
            <meshStandardMaterial
              color={st.deco}
              emissive={st.golden ? st.deco : '#000000'}
              emissiveIntensity={st.golden ? 0.5 : 0}
              metalness={st.golden ? 0.6 : 0}
              roughness={st.golden ? 0.3 : 0.6}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function Tree3D({ level = 1 }) {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 42 }} dpr={[1, 2]}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} />
      <directionalLight position={[-4, 2, -3]} intensity={0.35} color="#bdf0ff" />
      <Suspense fallback={null}>
        <Tree level={level} />
      </Suspense>
    </Canvas>
  )
}
