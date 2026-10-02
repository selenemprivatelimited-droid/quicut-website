import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { makeRingShape, makeTailShape, makeFilmTexture, BLADE_A, BLADE_NORMAL } from '../scene/geometry.js'
import { Environment, Bloom } from '../scene/Scene.jsx'
import Sparkles from '../scene/Sparkles.jsx'
import { sceneState } from '../store.js'

/* The website's 3D look behind the app: same void colour, red glow, sparkles, and the cut Q
   with film-strip rings orbiting it. It sits behind the content (pointer-events off), pauses when
   the tab is hidden, and holds still for people who prefer reduced motion. */

const pointer = { x: 0, y: 0 }

/* One shade family per role: creator = red, editor = green, admin = violet.
   Keep these in step with the role tokens at the bottom of look.css. */
export const THEMES = {
  creator: { q: '#c00610', emissive: '#3a0004', glow: '#ff2830', light: '#ff2a2a', spark: '#ff3d42', film: { hot: '#ed1c24', deep: '#3a0b0d', mid: '#b3141b', deep2: '#1a0507' } },
  editor: { q: '#0a8f5f', emissive: '#022a1b', glow: '#1fe39a', light: '#25e3a0', spark: '#5cf2bd', film: { hot: '#1fd18c', deep: '#062a1d', mid: '#0c8a5c', deep2: '#04170f' } },
  admin: { q: '#5b2fd6', emissive: '#170940', glow: '#8a63ff', light: '#8e6bff', spark: '#b79cff', film: { hot: '#8b5cf6', deep: '#1c0d40', mid: '#6236d9', deep2: '#110828' } },
}

/* soft white radial glow, tinted per role through the material colour */
function makeWhiteGlow() {
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grd.addColorStop(0, 'rgba(255,255,255,0.9)')
  grd.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function AppQ({ narrow, theme }) {
  const rig = useRef()
  const spin = useRef()
  const glow = useRef()
  const ribbon1 = useRef()
  const ribbon2 = useRef()

  const { ring, tail, matA, matB, film, film2, glowTex, offA, offB } = useMemo(() => {
    const ext = { depth: 0.5, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 12 }
    const ring = new THREE.ExtrudeGeometry(makeRingShape(), ext)
    ring.translate(0, 0, -0.25)
    const tail = new THREE.ExtrudeGeometry(makeTailShape(), { ...ext, depth: 0.44 })
    tail.translate(0, 0, -0.22)
    // the Q rests cut in two, as it does on the website after the blade passes
    const c = BLADE_NORMAL.dot(BLADE_A)
    const gap = 0.07
    const planeA = new THREE.Plane(new THREE.Vector3(BLADE_NORMAL.x, BLADE_NORMAL.y, 0), -c - gap)
    const planeB = new THREE.Plane(new THREE.Vector3(-BLADE_NORMAL.x, -BLADE_NORMAL.y, 0), c - gap)
    const base = { color: theme.q, metalness: 0.15, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: theme.emissive, side: THREE.DoubleSide }
    const matA = new THREE.MeshPhysicalMaterial({ ...base, clippingPlanes: [planeA] })
    const matB = new THREE.MeshPhysicalMaterial({ ...base, clippingPlanes: [planeB] })
    const film = makeFilmTexture(theme.film)
    film.repeat.set(3, 1)
    const film2 = film.clone()
    film2.repeat.set(4, 1)
    film2.needsUpdate = true
    const offA = [BLADE_NORMAL.x * gap, BLADE_NORMAL.y * gap, 0]
    const offB = [-BLADE_NORMAL.x * gap, -BLADE_NORMAL.y * gap, 0]
    return { ring, tail, matA, matB, film, film2, glowTex: makeWhiteGlow(), offA, offB }
  }, [theme])
  useEffect(() => () => [ring, tail, matA, matB, film, film2, glowTex].forEach((o) => o.dispose()), [ring, tail, matA, matB, film, film2, glowTex])

  // clipping planes live in world space, so they follow the rig every frame
  const localA = useMemo(() => matA.clippingPlanes[0].clone(), [matA])
  const localB = useMemo(() => matB.clippingPlanes[0].clone(), [matB])

  useFrame(({ clock }, dt) => {
    const reduced = sceneState.reducedMotion
    const t = reduced ? 0 : clock.elapsedTime
    const pose = narrow ? { x: 0.9, y: 2.6, z: -7.5, s: 0.62 } : { x: 3.4, y: 0.7, z: -4, s: 0.7 }
    rig.current.position.set(pose.x, pose.y + Math.sin(t * 0.9) * 0.08, pose.z)
    rig.current.scale.setScalar(pose.s)
    spin.current.rotation.y = Math.sin(t * 0.25) * 0.5 + (reduced ? 0 : pointer.x * 0.3)
    spin.current.rotation.x = reduced ? 0 : -pointer.y * 0.15
    glow.current.material.opacity = 0.16 + (reduced ? 0 : 0.05 * Math.sin(t * 1.6))
    if (!reduced) {
      ribbon1.current.rotation.y += dt * 0.18
      ribbon2.current.rotation.y -= dt * 0.12
    }
    spin.current.updateMatrixWorld()
    matA.clippingPlanes[0].copy(localA).applyMatrix4(spin.current.matrixWorld)
    matB.clippingPlanes[0].copy(localB).applyMatrix4(spin.current.matrixWorld)
  })

  return (
    <group ref={rig}>
      <mesh ref={glow} position={[0, 0, -1.2]} scale={narrow ? 5.5 : 7}>
        <planeGeometry />
        <meshBasicMaterial map={glowTex} color={theme.glow} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={spin}>
        <group position={offA}>
          <mesh geometry={ring} material={matA} />
          <mesh geometry={tail} material={matA} />
        </group>
        <group position={offB}>
          <mesh geometry={ring} material={matB} />
          <mesh geometry={tail} material={matB} />
        </group>
      </group>
      <group rotation={[1.15, 0, 0.32]}>
        <mesh ref={ribbon1}>
          <cylinderGeometry args={[2.55, 2.55, 0.34, 120, 1, true]} />
          <meshBasicMaterial map={film} side={THREE.DoubleSide} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      </group>
      <group rotation={[-0.95, 0.4, -0.55]}>
        <mesh ref={ribbon2}>
          <cylinderGeometry args={[3.15, 3.15, 0.3, 120, 1, true]} />
          <meshBasicMaterial map={film2} side={THREE.DoubleSide} transparent opacity={0.6} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

function CameraDrift() {
  useFrame(({ camera }, dt) => {
    if (sceneState.reducedMotion) return
    const k = 1 - Math.exp(-dt * 2)
    camera.position.x += (pointer.x * 0.35 - camera.position.x) * k
    camera.position.y += (pointer.y * 0.2 - camera.position.y) * k
    camera.lookAt(0, 0, -1)
  })
  return null
}

function useRole() {
  const read = () => document.documentElement.dataset.role || 'creator'
  const [role, setRole] = useState(read)
  useEffect(() => {
    const mo = new MutationObserver(() => setRole(read()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-role'] })
    return () => mo.disconnect()
  }, [])
  return THEMES[role] ? role : 'creator'
}

function World() {
  const { size, invalidate } = useThree()
  const narrow = size.width < 820
  const role = useRole()
  const theme = THEMES[role]
  useEffect(() => invalidate(), [role, invalidate])
  return (
    <>
      <color attach="background" args={['#050507']} />
      <fog attach="fog" args={['#050507', 9, 22]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[-4, 5, 6]} intensity={1.6} />
      <pointLight position={[3, -2, -3]} color={theme.light} intensity={14} distance={12} />
      <Environment />
      <AppQ key={role} narrow={narrow} theme={theme} />
      <Sparkles count={narrow ? 220 : 420} accent={theme.spark} />
      <CameraDrift />
      <Bloom />
    </>
  )
}

export default function AppScene() {
  const [visible, setVisible] = useState(() => !document.hidden)
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden)
    const onMove = (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])
  const loop = !visible ? 'never' : sceneState.reducedMotion ? 'demand' : 'always'
  return (
    <Canvas
      className="app-scene"
      aria-hidden="true"
      frameloop={loop}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 9], fov: 35, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: 'low-power', localClippingEnabled: true }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <World />
    </Canvas>
  )
}
