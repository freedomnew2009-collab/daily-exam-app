import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
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

// ช่วงพัฒนาการ (สีใบ + ของประดับ ต่างกันชัดในแต่ละช่วง)
function stageOf(lv) {
  if (lv <= 2) return { leaves: ['#86d96f', '#9be082', '#76c95f'], deco: null, decoN: 0 }
  if (lv <= 4) return { leaves: ['#62c95c', '#73d166', '#52b84f'], deco: null, decoN: 0 }
  if (lv <= 6) return { leaves: ['#4caf50', '#5cc25a', '#43a047'], deco: '#fff3b0', decoN: 5 } // ตูมเหลืองอ่อน
  if (lv <= 9) return { leaves: ['#46a64d', '#4caf50', '#66bb6a'], deco: '#ff86bd', decoN: 12 } // ดอกชมพู
  if (lv <= 12) return { leaves: ['#3f9e4f', '#43a047', '#379040'], deco: '#ef4444', decoN: 14 } // ผลแดง
  if (lv <= 16) return { leaves: ['#2f8b46', '#368f3d', '#43a047'], deco: '#e03131', decoN: 20 } // ผลดก เขียวเข้ม
  return { leaves: ['#2f9e4f', '#3f9e4f', '#57b85f'], deco: '#ffce3a', decoN: 22, golden: true } // ผลทอง
}

// รูปใบไม้ (โค้งปลายแหลม) วางจุดหมุนที่โคนใบ
function makeLeafGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.3, 0.2, 0.24, 0.72, 0, 1)
  s.bezierCurveTo(-0.24, 0.72, -0.3, 0.2, 0, 0)
  const geo = new THREE.ShapeGeometry(s, 8)
  geo.translate(0, -0.05, 0)
  return geo
}

function Leaves({ leaves, geometry }) {
  const ref = useRef()
  useEffect(() => {
    if (!ref.current) return
    const dummy = new THREE.Object3D()
    leaves.forEach((lf, i) => {
      dummy.position.set(lf.p[0], lf.p[1], lf.p[2])
      dummy.rotation.set(lf.r[0], lf.r[1], lf.r[2])
      dummy.scale.setScalar(lf.s)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
      ref.current.setColorAt(i, new THREE.Color(lf.c))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [leaves])
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, leaves.length]} castShadow>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.7} />
    </instancedMesh>
  )
}

function Tree({ level }) {
  const g = useRef()
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.4
  })

  const leafGeo = useMemo(() => makeLeafGeometry(), [])
  const L = Math.max(1, level)
  const cap = Math.min(L, 20)

  const model = useMemo(() => {
    const rnd = mulberry32(2000 + cap)
    const st = stageOf(cap)
    const trunkH = 0.5 + Math.min(cap, 18) * 0.12
    const trunkTop = 0.35 + trunkH
    const rx = 0.5 + Math.min(cap, 18) * 0.085
    const ry = 0.42 + Math.min(cap, 18) * 0.06
    const cy = trunkTop + ry * 0.5

    // ก้อนพุ่มเนียน ๆ ด้านในไว้ให้ทึบ (กันโปร่ง)
    const blobs = []
    const blobN = Math.min(3 + Math.floor(cap / 3), 7)
    for (let i = 0; i < blobN; i++) {
      const u = rnd() * Math.PI * 2
      const rr = 0.4 * rnd()
      blobs.push({
        p: [Math.cos(u) * rx * rr, cy + (rnd() - 0.5) * ry, Math.sin(u) * rx * rr],
        s: ry * (0.7 + rnd() * 0.4),
        c: st.leaves[0],
      })
    }

    // ใบไม้แบน (เยอะตามเลเวล)
    const leafN = Math.min(24 + cap * 7, 170)
    const leaves = []
    for (let i = 0; i < leafN; i++) {
      const u = rnd() * Math.PI * 2
      const v = Math.acos(2 * rnd() - 1)
      const rr = 0.7 + 0.45 * rnd()
      const x = Math.cos(u) * Math.sin(v) * rx * rr
      const y = cy + Math.cos(v) * ry * rr
      const z = Math.sin(u) * Math.sin(v) * rx * rr
      leaves.push({
        p: [x, y, z],
        r: [rnd() * Math.PI, rnd() * Math.PI * 2, rnd() * Math.PI],
        s: 0.34 + rnd() * 0.22,
        c: st.leaves[Math.floor(rnd() * st.leaves.length)],
      })
    }

    // ดอก/ผล
    const decos = []
    if (st.deco) {
      for (let i = 0; i < st.decoN; i++) {
        const u = rnd() * Math.PI * 2
        const v = 0.25 + rnd() * 1.6
        decos.push({
          p: [
            Math.cos(u) * Math.sin(v) * rx * 0.92,
            cy + Math.cos(v) * ry * 0.85,
            Math.sin(u) * Math.sin(v) * rx * 0.92,
          ],
          s: st.golden ? 0.13 : st.deco === '#ef4444' || st.deco === '#e03131' ? 0.13 : 0.1,
        })
      }
    }

    const top = cy + ry
    const totalH = top + 0.3
    const fit = Math.min(1, 3.7 / totalH)
    return { trunkH, trunkTop, blobs, leaves, decos, st, fit, totalH }
  }, [cap])

  const { trunkH, blobs, leaves, decos, st, fit, totalH } = model

  return (
    <group ref={g}>
      <group scale={fit} position={[0, -(totalH * fit) / 2 - 0.05, 0]}>
        {/* กระถาง */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.6, 0.44, 0.56, 28]} />
          <meshStandardMaterial color="#cf6a43" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.58, 0.58, 0.12, 28]} />
          <meshStandardMaterial color="#5a3826" />
        </mesh>
        {/* ลำต้น (เนียน) */}
        <mesh position={[0, 0.35 + trunkH / 2, 0]}>
          <cylinderGeometry args={[0.085, 0.15, trunkH, 16]} />
          <meshStandardMaterial color="#8a5a2b" roughness={0.9} />
        </mesh>
        {/* พุ่มทึบด้านใน */}
        {blobs.map((b, i) => (
          <mesh key={i} position={b.p}>
            <sphereGeometry args={[b.s, 16, 16]} />
            <meshStandardMaterial color={b.c} roughness={0.85} />
          </mesh>
        ))}
        {/* ใบไม้แบน */}
        <Leaves leaves={leaves} geometry={leafGeo} />
        {/* ดอก/ผล */}
        {decos.map((d, i) => (
          <mesh key={i} position={d.p}>
            <sphereGeometry args={[d.s, 12, 12]} />
            <meshStandardMaterial
              color={st.deco}
              emissive={st.golden ? st.deco : '#000000'}
              emissiveIntensity={st.golden ? 0.45 : 0}
              roughness={st.golden ? 0.3 : 0.6}
              metalness={st.golden ? 0.6 : 0}
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
      <directionalLight position={[3, 6, 4]} intensity={1.15} />
      <directionalLight position={[-4, 2, -3]} intensity={0.35} color="#bdf0ff" />
      <Suspense fallback={null}>
        <Tree level={level} />
      </Suspense>
    </Canvas>
  )
}
