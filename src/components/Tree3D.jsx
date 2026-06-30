import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'

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

// รูปใบไม้ (โค้งปลายแหลม) จุดหมุนที่โคนใบ
function makeLeafGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.32, 0.22, 0.26, 0.74, 0, 1)
  s.bezierCurveTo(-0.26, 0.74, -0.32, 0.22, 0, 0)
  const g = new THREE.ShapeGeometry(s, 10)
  return g
}

// ดอกตามเลเวล (อิงรูปการ์ตูน: 10 ชมพู, 16-19 ชมพูเพิ่มขึ้น, 20 หลากสีเต็มต้น)
function bloomOf(lv) {
  if (lv === 10) return { colors: ['#f48fb1', '#f06292'], n: 16 }
  if (lv >= 16 && lv <= 17) return { colors: ['#f48fb1', '#f8bbd0'], n: 10 }
  if (lv >= 18 && lv <= 19) return { colors: ['#ec5f9e', '#f48fb1'], n: 20 }
  if (lv >= 20) return { colors: ['#e040a0', '#ffd54f', '#f48fb1', '#ba68c8'], n: 40 }
  return null
}

// ชุดสีเขียว เข้มขึ้นเล็กน้อยตามอายุ (ใช้ดัชนี 0-3)
function greenOf(lv) {
  if (lv >= 13) return ['#62c25a', '#4caf50', '#3f9e47', '#368f3d']
  if (lv >= 8) return ['#7cc96a', '#62c25a', '#4caf50', '#3f9e47']
  return ['#86d673', '#7cc96a', '#62c25a', '#54bb50']
}

function Tree({ level }) {
  const g = useRef()
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.4
  })

  const leafGeo = useMemo(() => makeLeafGeometry(), [])
  const cap = Math.max(1, Math.min(level, 20))
  const seedling = cap <= 7

  const model = useMemo(() => {
    const rnd = mulberry32(4000 + cap)
    const greens = greenOf(cap)
    const baseY = 0.18 // ยอดเนินดิน

    if (seedling) {
      // ---- ต้นอ่อน/ต้นกล้า: ลำต้นเขียว + ใบจริงวางเป็นคู่ ----
      const stemH = 0.22 + cap * 0.17
      const pairs = Math.max(1, Math.min(cap - 1, 4)) // จำนวนคู่ใบ
      const leaves = []
      if (cap === 1) {
        leaves.push({ h: baseY + stemH * 0.7, a: 0.2, tilt: 0.5, s: 0.55 })
      } else {
        for (let i = 0; i < pairs; i++) {
          const h = baseY + stemH * (0.35 + (i / pairs) * 0.6)
          const s = 0.26 + (i / pairs) * 0.18 + cap * 0.01
          const baseA = i % 2 ? Math.PI / 2 : 0
          leaves.push({ h, a: baseA, tilt: 0.9, s })
          leaves.push({ h, a: baseA + Math.PI, tilt: 0.9, s })
        }
        // ใบยอด
        leaves.push({ h: baseY + stemH * 1.02, a: 0.3, tilt: 0.35, s: 0.3 + cap * 0.012 })
      }
      const totalH = baseY + stemH + 0.4
      return { mode: 'seedling', stemH, leaves, baseY, greens, totalH, fit: Math.min(1, 3.6 / totalH), face: cap >= 2 && cap <= 4 }
    }

    // ---- ต้นไม้: ลำต้นน้ำตาล + พุ่มกลมก้อนใบ + ดอก ----
    const age = cap - 7
    const trunkH = 0.55 + age * 0.11
    const trunkR = 0.075 + age * 0.012
    const trunkTop = baseY + trunkH
    const crownR = 0.55 + age * 0.055
    const cy = trunkTop + crownR * 0.5

    // ก้อนพุ่มหลัก (กลมฟู)
    const blobs = [{ p: [0, cy, 0], r: crownR, c: greens[2] }]
    const ringN = Math.min(5 + Math.floor(age / 2), 9)
    for (let i = 0; i < ringN; i++) {
      const a = (i / ringN) * Math.PI * 2 + (cap % 2 ? 0.35 : 0)
      const rr = crownR * 0.78
      blobs.push({
        p: [Math.cos(a) * rr, cy + (rnd() * 0.16 - 0.04) * crownR, Math.sin(a) * rr],
        r: crownR * 0.6,
        c: i % 2 ? greens[1] : greens[3],
      })
    }
    blobs.push({ p: [0, cy + crownR * 0.7, 0], r: crownR * 0.6, c: greens[1] })

    // ปุ่มใบเล็ก ๆ บนผิวพุ่ม (ให้ดูเป็นก้อนใบการ์ตูน)
    const bumps = []
    const bumpN = Math.min(16 + age * 4, 60)
    for (let i = 0; i < bumpN; i++) {
      const u = rnd() * Math.PI * 2
      const v = Math.acos(2 * rnd() - 1)
      const R = crownR * (0.94 + rnd() * 0.12)
      bumps.push({
        p: [Math.cos(u) * Math.sin(v) * R, cy + Math.cos(v) * R * 0.92, Math.sin(u) * Math.sin(v) * R],
        r: crownR * (0.16 + rnd() * 0.08),
        c: rnd() > 0.5 ? greens[1] : greens[0],
      })
    }

    // ดอก
    const bloom = bloomOf(cap)
    const flowers = []
    if (bloom) {
      for (let i = 0; i < bloom.n; i++) {
        const u = rnd() * Math.PI * 2
        const v = 0.2 + rnd() * 1.5
        const R = crownR * 1.02
        flowers.push({
          p: [Math.cos(u) * Math.sin(v) * R, cy + Math.cos(v) * R * 0.92, Math.sin(u) * Math.sin(v) * R],
          r: crownR * (0.12 + rnd() * 0.05),
          c: bloom.colors[Math.floor(rnd() * bloom.colors.length)],
        })
      }
    }

    const totalH = cy + crownR * 1.3 + 0.3
    return { mode: 'tree', trunkH, trunkR, trunkTop, blobs, bumps, flowers, baseY, greens, totalH, fit: Math.min(1, 3.8 / totalH) }
  }, [cap, seedling])

  const { fit, totalH } = model

  return (
    <group ref={g}>
      <group scale={fit} position={[0, -(totalH * fit) / 2 - 0.05, 0]}>
        {/* เนินดิน */}
        <mesh position={[0, 0.02, 0]} scale={[0.85, 0.4, 0.85]}>
          <sphereGeometry args={[0.62, 24, 18]} />
          <meshStandardMaterial color="#6b4a2b" roughness={1} />
        </mesh>
        <mesh position={[0, 0.16, 0]} scale={[0.78, 0.2, 0.78]}>
          <sphereGeometry args={[0.6, 24, 14]} />
          <meshStandardMaterial color="#7a552f" roughness={1} />
        </mesh>

        {model.mode === 'seedling' ? (
          <>
            {/* ลำต้นเขียว */}
            <mesh position={[0, model.baseY + model.stemH / 2, 0]}>
              <cylinderGeometry args={[0.045, 0.06, model.stemH, 10]} />
              <meshStandardMaterial color="#6cae3e" roughness={0.7} />
            </mesh>
            {/* ใบ */}
            {model.leaves.map((lf, i) => (
              <group key={i} rotation={[0, lf.a, 0]}>
                <mesh
                  geometry={leafGeo}
                  position={[0, lf.h, 0.04]}
                  rotation={[lf.tilt, 0, 0]}
                  scale={lf.s}
                >
                  <meshStandardMaterial color={model.greens[1]} side={THREE.DoubleSide} roughness={0.6} />
                </mesh>
              </group>
            ))}
            {/* หน้ายิ้มน่ารักบนเนินดิน */}
            {model.face && (
              <group position={[0, 0.2, 0.42]}>
                <mesh position={[-0.12, 0, 0]}>
                  <sphereGeometry args={[0.035, 10, 10]} />
                  <meshStandardMaterial color="#3a2a1a" />
                </mesh>
                <mesh position={[0.12, 0, 0]}>
                  <sphereGeometry args={[0.035, 10, 10]} />
                  <meshStandardMaterial color="#3a2a1a" />
                </mesh>
                <mesh position={[-0.2, -0.05, 0.02]}>
                  <sphereGeometry args={[0.04, 10, 10]} />
                  <meshStandardMaterial color="#f7a8b8" transparent opacity={0.8} />
                </mesh>
                <mesh position={[0.2, -0.05, 0.02]}>
                  <sphereGeometry args={[0.04, 10, 10]} />
                  <meshStandardMaterial color="#f7a8b8" transparent opacity={0.8} />
                </mesh>
              </group>
            )}
          </>
        ) : (
          <>
            {/* ลำต้น */}
            <mesh position={[0, model.baseY + model.trunkH / 2, 0]}>
              <cylinderGeometry args={[model.trunkR * 0.7, model.trunkR, model.trunkH, 14]} />
              <meshStandardMaterial color="#8a5a2b" roughness={0.95} />
            </mesh>
            {/* พุ่มหลัก */}
            {model.blobs.map((b, i) => (
              <mesh key={`b${i}`} position={b.p}>
                <sphereGeometry args={[b.r, 24, 18]} />
                <meshStandardMaterial color={b.c} roughness={0.9} />
              </mesh>
            ))}
            {/* ปุ่มใบ */}
            {model.bumps.map((b, i) => (
              <mesh key={`p${i}`} position={b.p}>
                <sphereGeometry args={[b.r, 12, 10]} />
                <meshStandardMaterial color={b.c} roughness={0.85} />
              </mesh>
            ))}
            {/* ดอก */}
            {model.flowers.map((f, i) => (
              <mesh key={`f${i}`} position={f.p}>
                <sphereGeometry args={[f.r, 12, 12]} />
                <meshStandardMaterial color={f.c} roughness={0.55} emissive={f.c} emissiveIntensity={0.12} />
              </mesh>
            ))}
          </>
        )}
      </group>
    </group>
  )
}

export default function Tree3D({ level = 1 }) {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 42 }} dpr={[1, 2]}>
      <ambientLight intensity={0.88} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} />
      <directionalLight position={[-4, 2, -3]} intensity={0.35} color="#cfeefe" />
      <Suspense fallback={null}>
        <Tree level={level} />
      </Suspense>
    </Canvas>
  )
}
