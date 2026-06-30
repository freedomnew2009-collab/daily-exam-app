import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'

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

// gradient map 3 สเต็ป สำหรับ toon (cel) shading
function useToonGradient() {
  return useMemo(() => {
    const data = new Uint8Array([95, 175, 255])
    const t = new THREE.DataTexture(data, 3, 1, THREE.RedFormat)
    t.minFilter = THREE.NearestFilter
    t.magFilter = THREE.NearestFilter
    t.needsUpdate = true
    return t
  }, [])
}

function bloomOf(lv) {
  if (lv === 10) return { colors: ['#f48fb1', '#f06292'], n: 18 }
  if (lv >= 16 && lv <= 17) return { colors: ['#f48fb1', '#f8bbd0'], n: 12 }
  if (lv >= 18 && lv <= 19) return { colors: ['#ec5f9e', '#f48fb1'], n: 22 }
  if (lv >= 20) return { colors: ['#e040a0', '#ffd54f', '#f48fb1', '#ba68c8'], n: 46 }
  return null
}

function greenOf(lv) {
  if (lv >= 13) return ['#57b94f', '#49a843', '#3c9239']
  if (lv >= 8) return ['#69c95f', '#57b94f', '#49a843']
  return ['#86d673', '#76cb63', '#63c25a']
}

// ลูกใบ/ลำต้น ที่มีเส้นขอบ (วาด backface สีเข้มไว้ข้างหลัง)
function Sphere({ p, r, color, grad, outline = '#234d22', seg = 22 }) {
  return (
    <group position={p}>
      <mesh scale={1.07}>
        <sphereGeometry args={[r, seg, Math.round(seg * 0.7)]} />
        <meshBasicMaterial color={outline} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[r, seg, Math.round(seg * 0.7)]} />
        <meshToonMaterial color={color} gradientMap={grad} />
      </mesh>
    </group>
  )
}

// ใบต้นอ่อน = ก้อนใบป้อม (ellipsoid) แผ่ออกด้านข้าง มีเส้นขอบ
function LeafBlob({ a, h, s, color, grad }) {
  const sc = [s * 1.5, s * 0.5, s * 0.85]
  return (
    <group rotation={[0, a, 0]}>
      <group position={[0, h, 0]} rotation={[0, 0, 0.5]}>
        <group position={[s * 0.85, 0, 0]}>
          <mesh scale={[sc[0] * 1.12, sc[1] * 1.16, sc[2] * 1.12]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial color="#234d22" side={THREE.BackSide} />
          </mesh>
          <mesh scale={sc}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshToonMaterial color={color} gradientMap={grad} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function Tree({ level }) {
  const g = useRef()
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.38
  })
  const grad = useToonGradient()
  const cap = Math.max(1, Math.min(level, 20))
  const seedling = cap <= 7
  const greens = greenOf(cap)

  const model = useMemo(() => {
    const rnd = mulberry32(5000 + cap)
    const baseY = 0.2
    if (seedling) {
      const stemH = 0.22 + cap * 0.17
      const pairs = Math.max(1, Math.min(cap - 1, 4))
      const leaves = []
      if (cap === 1) {
        leaves.push({ h: baseY + stemH * 0.55, a: 0.25, tilt: 0.45, s: 0.6 })
      } else {
        for (let i = 0; i < pairs; i++) {
          const h = baseY + stemH * (0.32 + (i / pairs) * 0.62)
          const s = 0.27 + (i / pairs) * 0.2 + cap * 0.01
          const a0 = i % 2 ? Math.PI / 2 : 0
          leaves.push({ h, a: a0, tilt: 0.95, s })
          leaves.push({ h, a: a0 + Math.PI, tilt: 0.95, s })
        }
        leaves.push({ h: baseY + stemH * 1.04, a: 0.3, tilt: 0.3, s: 0.32 + cap * 0.012 })
      }
      const totalH = baseY + stemH + 0.4
      return { mode: 'seedling', stemH, leaves, baseY, totalH, fit: Math.min(1, 3.5 / totalH), face: cap >= 2 && cap <= 4 }
    }

    const age = cap - 7
    const trunkH = 0.5 + age * 0.1
    const trunkR = 0.08 + age * 0.014
    const trunkTop = baseY + trunkH
    const crownR = 0.6 + age * 0.05
    const cy = trunkTop + crownR * 0.45

    // พุ่มเป็นก้อนกลมจัดเรียงเป็นทรงเมฆ (สะอาด ไม่รก)
    const lobes = [{ p: [0, cy + crownR * 0.1, 0], r: crownR }]
    const ringN = 6
    for (let i = 0; i < ringN; i++) {
      const a = (i / ringN) * Math.PI * 2 + (cap % 2 ? 0.4 : 0)
      const rr = crownR * 0.82
      lobes.push({
        p: [Math.cos(a) * rr, cy + (i % 2 ? 0.12 : -0.06) * crownR, Math.sin(a) * rr],
        r: crownR * 0.62,
      })
    }
    lobes.push({ p: [0, cy + crownR * 0.78, 0], r: crownR * 0.66 })

    // กิ่ง (โผล่จากลำต้นเข้าไปในพุ่ม) เมื่อโต
    const branches = []
    if (cap >= 9) {
      const bn = Math.min(2 + Math.floor(age / 2), 4)
      for (let i = 0; i < bn; i++) {
        const a = (i / bn) * Math.PI * 2 + 0.6
        branches.push({ a, len: crownR * 0.9, tilt: 0.6 })
      }
    }

    const bloom = bloomOf(cap)
    const flowers = []
    if (bloom) {
      for (let i = 0; i < bloom.n; i++) {
        const u = rnd() * Math.PI * 2
        const v = 0.2 + rnd() * 1.45
        const R = crownR * 1.04
        flowers.push({
          p: [Math.cos(u) * Math.sin(v) * R, cy + crownR * 0.1 + Math.cos(v) * R * 0.9, Math.sin(u) * Math.sin(v) * R],
          r: crownR * (0.13 + rnd() * 0.05),
          c: bloom.colors[Math.floor(rnd() * bloom.colors.length)],
        })
      }
    }

    const totalH = cy + crownR * 1.45 + 0.3
    return { mode: 'tree', trunkH, trunkR, trunkTop, baseY, lobes, branches, flowers, totalH, fit: Math.min(1, 3.9 / totalH) }
  }, [cap, seedling])

  const { fit, totalH } = model

  return (
    <group ref={g}>
      <group scale={fit} position={[0, -(totalH * fit) / 2 - 0.05, 0]}>
        {/* เนินดิน */}
        <group>
          <mesh position={[0, 0.02, 0]} scale={[0.9, 0.42, 0.9]}>
            <sphereGeometry args={[0.62, 26, 18]} />
            <meshToonMaterial color="#7a552f" gradientMap={grad} />
          </mesh>
          <mesh position={[0, 0.02, 0]} scale={[0.95, 0.45, 0.95]}>
            <sphereGeometry args={[0.62, 26, 18]} />
            <meshBasicMaterial color="#3a2718" side={THREE.BackSide} />
          </mesh>
        </group>

        {model.mode === 'seedling' ? (
          <>
            <mesh position={[0, model.baseY + model.stemH / 2, 0]}>
              <cylinderGeometry args={[0.045, 0.062, model.stemH, 12]} />
              <meshToonMaterial color="#6cae3e" gradientMap={grad} />
            </mesh>
            {model.leaves.map((lf, i) => (
              <LeafBlob key={i} a={lf.a} h={lf.h} s={lf.s} color={greens[1]} grad={grad} />
            ))}
            {model.face && (
              <group position={[0, 0.22, 0.44]}>
                <mesh position={[-0.12, 0, 0]}>
                  <sphereGeometry args={[0.035, 12, 12]} />
                  <meshBasicMaterial color="#3a2a1a" />
                </mesh>
                <mesh position={[0.12, 0, 0]}>
                  <sphereGeometry args={[0.035, 12, 12]} />
                  <meshBasicMaterial color="#3a2a1a" />
                </mesh>
                <mesh position={[-0.21, -0.05, 0]}>
                  <sphereGeometry args={[0.04, 12, 12]} />
                  <meshBasicMaterial color="#f29bb0" />
                </mesh>
                <mesh position={[0.21, -0.05, 0]}>
                  <sphereGeometry args={[0.04, 12, 12]} />
                  <meshBasicMaterial color="#f29bb0" />
                </mesh>
              </group>
            )}
          </>
        ) : (
          <>
            {/* ลำต้น (มีเส้นขอบ) */}
            <group>
              <mesh position={[0, model.baseY + model.trunkH / 2, 0]} scale={1.12}>
                <cylinderGeometry args={[model.trunkR * 0.7, model.trunkR, model.trunkH, 14]} />
                <meshBasicMaterial color="#4a3018" side={THREE.BackSide} />
              </mesh>
              <mesh position={[0, model.baseY + model.trunkH / 2, 0]}>
                <cylinderGeometry args={[model.trunkR * 0.7, model.trunkR, model.trunkH, 14]} />
                <meshToonMaterial color="#9b6633" gradientMap={grad} />
              </mesh>
            </group>
            {/* กิ่ง */}
            {model.branches.map((br, i) => (
              <group key={`br${i}`} rotation={[0, br.a, 0]}>
                <mesh
                  position={[Math.sin(br.tilt) * br.len * 0.5, model.trunkTop - 0.05 + Math.cos(br.tilt) * br.len * 0.5, 0]}
                  rotation={[0, 0, -br.tilt]}
                >
                  <cylinderGeometry args={[model.trunkR * 0.35, model.trunkR * 0.55, br.len, 8]} />
                  <meshToonMaterial color="#9b6633" gradientMap={grad} />
                </mesh>
              </group>
            ))}
            {/* พุ่ม */}
            {model.lobes.map((lo, i) => (
              <Sphere key={`l${i}`} p={lo.p} r={lo.r} color={i % 2 ? greens[0] : greens[1]} grad={grad} />
            ))}
            {/* ดอก */}
            {model.flowers.map((f, i) => (
              <group key={`f${i}`} position={f.p}>
                <mesh scale={1.12}>
                  <sphereGeometry args={[f.r, 12, 10]} />
                  <meshBasicMaterial color="#7a3a5a" side={THREE.BackSide} />
                </mesh>
                <mesh>
                  <sphereGeometry args={[f.r, 12, 10]} />
                  <meshToonMaterial color={f.c} gradientMap={grad} emissive={f.c} emissiveIntensity={0.15} />
                </mesh>
              </group>
            ))}
          </>
        )}
      </group>
    </group>
  )
}

export default function Tree3D({ level = 1 }) {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, 6, 4]} intensity={1.0} />
      <directionalLight position={[-4, 2, -3]} intensity={0.3} color="#cfeefe" />
      <Suspense fallback={null}>
        <Tree level={level} />
      </Suspense>
    </Canvas>
  )
}
