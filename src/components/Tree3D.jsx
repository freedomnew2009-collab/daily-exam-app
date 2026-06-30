import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'

// ต้นไม้ low-poly ที่โตขึ้นตามเลเวล (หมุนเองอัตโนมัติ)
function Tree({ level }) {
  const g = useRef()
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.5
  })

  const L = Math.max(1, level)
  const cap = Math.min(L, 12) // จำกัดความใหญ่ของภาพ
  const trunkH = 0.45 + Math.min(cap, 9) * 0.22
  const layers = Math.min(1 + Math.floor(cap / 1.4), 7)
  const baseR = 0.42 + Math.min(cap, 10) * 0.07
  const trunkTop = 0.35 + trunkH

  const fruits = useMemo(() => {
    if (cap < 5) return []
    const n = Math.min(cap - 3, 10)
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + i * 1.3
      const r = baseR * 0.7
      const y = trunkTop + 0.1 + (i % 3) * 0.3
      return [Math.cos(a) * r, y, Math.sin(a) * r]
    })
  }, [cap, baseR, trunkTop])

  return (
    <group ref={g} position={[0, -1.15, 0]}>
      {/* กระถาง */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.62, 0.45, 0.6, 24]} />
        <meshStandardMaterial color="#cf6a43" flatShading />
      </mesh>
      {/* ดิน */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.12, 24]} />
        <meshStandardMaterial color="#5a3826" />
      </mesh>
      {/* ลำต้น */}
      <mesh position={[0, 0.35 + trunkH / 2, 0]}>
        <cylinderGeometry args={[0.1, 0.16, trunkH, 10]} />
        <meshStandardMaterial color="#8a5a2b" flatShading />
      </mesh>
      {/* พุ่มใบ (เพิ่มชั้น/ใหญ่ขึ้นตามเลเวล) */}
      {Array.from({ length: layers }).map((_, i) => {
        const t = i / Math.max(1, layers - 1)
        const r = Math.max(0.22, baseR * (1 - t * 0.55))
        const y = trunkTop - 0.05 + i * (baseR * 0.62)
        return (
          <mesh key={i} position={[0, y, 0]}>
            <icosahedronGeometry args={[r, 1]} />
            <meshStandardMaterial color={i % 2 ? '#43a047' : '#56c25a'} flatShading />
          </mesh>
        )
      })}
      {/* ดอก/ผล เมื่อโตพอ (เลเวล 5+) */}
      {fruits.map((p, i) => (
        <mesh key={i} position={p}>
          <icosahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color={cap >= 8 ? '#ff5d8f' : '#ffd34e'} flatShading />
        </mesh>
      ))}
    </group>
  )
}

export default function Tree3D({ level = 1 }) {
  return (
    <Canvas camera={{ position: [0, 0.6, 5.2], fov: 42 }} dpr={[1, 2]}>
      <ambientLight intensity={0.78} />
      <directionalLight position={[3, 6, 4]} intensity={1.2} />
      <directionalLight position={[-4, 2, -3]} intensity={0.35} color="#aaeeff" />
      <Suspense fallback={null}>
        <Tree level={level} />
      </Suspense>
    </Canvas>
  )
}
