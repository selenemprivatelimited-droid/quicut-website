import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import {
  makeRingShape,
  makeTailShape,
  makeBladeShape,
  makeFilmTexture,
  makeGlowTexture,
  BLADE_A,
  BLADE_DIR,
  BLADE_NORMAL,
} from './geometry.js'
import { sceneState, replayIntro } from '../store.js'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (t) => t * t * (3 - 2 * t)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const easeBack = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/* Where the Q sits while each section is on screen.
   x/y/z in world units, s = scale, ry = extra spin (turns), rx = tilt */
const POSES_WIDE = {
  hero: { x: 2.35, y: 0.05, z: 0, s: 1, ry: 0, rx: 0 },
  how: { x: -3.35, y: 0.55, z: -1, s: 0.62, ry: 1, rx: 0.1 },
  numbers: { x: 3.3, y: -0.2, z: -1, s: 0.6, ry: 2, rx: -0.1 },
  pricing: { x: 0, y: 0.2, z: -7, s: 0.9, ry: 3, rx: 0 },
  langs: { x: -3.4, y: 0.1, z: -1.2, s: 0.58, ry: 4, rx: 0.12 },
  editors: { x: 3.35, y: 0.2, z: -1.2, s: 0.58, ry: 5, rx: -0.08 },
  join: { x: 0, y: 1.35, z: -0.6, s: 0.62, ry: 6, rx: 0 },
}
const POSES_NARROW = {
  hero: { x: 0, y: 1.45, z: -1.5, s: 0.82, ry: 0, rx: 0 },
  how: { x: 0.9, y: 2.2, z: -7, s: 0.8, ry: 1, rx: 0 },
  numbers: { x: -0.9, y: 0, z: -8, s: 0.8, ry: 2, rx: 0 },
  pricing: { x: 0, y: 0, z: -9, s: 0.8, ry: 3, rx: 0 },
  langs: { x: 0.9, y: 0.6, z: -8, s: 0.8, ry: 4, rx: 0 },
  editors: { x: -0.9, y: 0, z: -8, s: 0.8, ry: 5, rx: 0 },
  join: { x: 0, y: 2.3, z: -5, s: 0.8, ry: 6, rx: 0 },
}

/** Reads [data-pose] sections from the page and returns the blended target pose */
function usePoseTarget(narrow) {
  const anchors = useRef([])
  useEffect(() => {
    const measure = () => {
      anchors.current = [...document.querySelectorAll('[data-pose]')].map((el) => ({
        key: el.dataset.pose,
        top: el.getBoundingClientRect().top + window.scrollY,
      }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const out = useMemo(() => ({ x: 0, y: 0, z: 0, s: 1, ry: 0, rx: 0 }), [])
  return () => {
    const table = narrow ? POSES_NARROW : POSES_WIDE
    const list = anchors.current
    if (!list.length) return Object.assign(out, table.hero)
    const s = window.scrollY + window.innerHeight * 0.35
    let i = 0
    while (i < list.length - 1 && s >= list[i + 1].top) i++
    const a = table[list[i].key] || table.hero
    const next = list[i + 1]
    const b = next ? table[next.key] || a : a
    let t = 0
    if (next) {
      const raw = (s - list[i].top) / (next.top - list[i].top)
      t = smooth(clamp01((raw - 0.5) / 0.5)) // hold pose for the first half of a section
    }
    for (const k of ['x', 'y', 'z', 's', 'ry', 'rx']) out[k] = a[k] + (b[k] - a[k]) * t
    return out
  }
}

function QLogo({ narrow }) {
  const rig = useRef()
  const spin = useRef()
  const halfA = useRef()
  const halfB = useRef()
  const blade = useRef()
  const glow = useRef()
  const flashLight = useRef()
  const ribbons = useRef()
  const ribbon1 = useRef()
  const ribbon2 = useRef()
  const target = usePoseTarget(narrow)

  const { ring, tail, bladeGeo, matA, matB, planeA, planeB, film, glowTex } = useMemo(() => {
    const ext = { depth: 0.5, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 5, curveSegments: 14 }
    const ring = new THREE.ExtrudeGeometry(makeRingShape(), ext)
    ring.translate(0, 0, -0.25)
    const tail = new THREE.ExtrudeGeometry(makeTailShape(), { ...ext, depth: 0.44 })
    tail.translate(0, 0, -0.22)
    const bladeGeo = new THREE.ExtrudeGeometry(makeBladeShape(), { depth: 0.95, bevelEnabled: false })
    bladeGeo.translate(0, 0, -0.475)

    const c = BLADE_NORMAL.dot(BLADE_A)
    const localA = new THREE.Plane(new THREE.Vector3(BLADE_NORMAL.x, BLADE_NORMAL.y, 0), -c)
    const localB = new THREE.Plane(new THREE.Vector3(-BLADE_NORMAL.x, -BLADE_NORMAL.y, 0), c)
    const planeA = { local: localA, world: localA.clone() }
    const planeB = { local: localB, world: localB.clone() }
    const base = {
      color: '#c00610',
      metalness: 0.15,
      roughness: 0.38,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
      emissive: '#3a0004',
      side: THREE.DoubleSide,
    }
    const matA = new THREE.MeshPhysicalMaterial({ ...base, clippingPlanes: [planeA.world] })
    const matB = new THREE.MeshPhysicalMaterial({ ...base, clippingPlanes: [planeB.world] })
    const film = makeFilmTexture()
    film.repeat.set(3, 1)
    return { ring, tail, bladeGeo, matA, matB, planeA, planeB, film, glowTex: makeGlowTexture() }
  }, [])

  useEffect(() => () => [ring, tail, bladeGeo, matA, matB, film, glowTex].forEach((o) => o.dispose()), [])

  const film2 = useMemo(() => {
    const t = film.clone()
    t.repeat.set(4, 1)
    t.needsUpdate = true
    return t
  }, [film])

  const state = useRef({ x: 2.3, y: 0, z: 0, s: 1, ry: 0, rx: 0, ribbon: 0 })

  useFrame(({ clock, pointer }, dt) => {
    const now = performance.now() / 1000
    const reduced = sceneState.reducedMotion
    const t0 = sceneState.introStart
    const it = reduced ? 10 : t0 == null ? -1 : now - t0 // seconds into intro

    // --- intro choreography ---
    const appear = it < 0 ? 0 : easeBack(clamp01(it / 0.7))
    const sweep = easeOut(clamp01((it - 0.45) / 0.55))
    const cut = smooth(clamp01((it - 0.78) / 0.5))
    const flash = it < 0.7 ? 0 : Math.max(0, 1 - (it - 0.75) / 0.6)

    halfA.current.position.set(BLADE_NORMAL.x * 0.07 * cut, BLADE_NORMAL.y * 0.07 * cut, 0)
    halfB.current.position.set(-BLADE_NORMAL.x * 0.07 * cut, -BLADE_NORMAL.y * 0.07 * cut, 0)
    const off = (1 - sweep) * 7.5
    blade.current.position.set(-BLADE_DIR.x * off, -BLADE_DIR.y * off, 0)
    blade.current.visible = it > 0.4
    flashLight.current.intensity = flash * 60
    glow.current.material.opacity = (0.16 + 0.05 * Math.sin(clock.elapsedTime * 1.6)) * appear + flash * 0.45

    // --- scroll pose ---
    const p = target()
    const k = 1 - Math.exp(-dt * 3.2)
    const s = state.current
    for (const key of ['x', 'y', 'z', 's', 'ry', 'rx']) s[key] += (p[key] - s[key]) * k

    const vh = window.innerHeight
    const ribbonTarget = clamp01((window.scrollY - vh * 0.25) / (vh * 0.6))
    s.ribbon += (ribbonTarget - s.ribbon) * k

    const float = reduced ? 0 : Math.sin(clock.elapsedTime * 0.9) * 0.08
    rig.current.position.set(s.x, s.y + float, s.z)
    rig.current.scale.setScalar(s.s * Math.max(0.001, appear))
    const px = reduced ? 0 : pointer.x
    const py = reduced ? 0 : pointer.y
    spin.current.rotation.y = s.ry * Math.PI * 2 + px * 0.35 + (1 - appear) * -0.8
    spin.current.rotation.x = s.rx - py * 0.18

    // ribbons orbit the Q once you leave the hero
    ribbons.current.scale.setScalar(Math.max(0.001, s.ribbon))
    ribbons.current.visible = s.ribbon > 0.01
    if (!reduced) {
      ribbon1.current.rotation.y += dt * 0.18
      ribbon2.current.rotation.y -= dt * 0.12
    }

    // keep clipping planes glued to each half
    halfA.current.updateMatrixWorld()
    halfB.current.updateMatrixWorld()
    planeA.world.copy(planeA.local).applyMatrix4(halfA.current.matrixWorld)
    planeB.world.copy(planeB.local).applyMatrix4(halfB.current.matrixWorld)
  })

  const hover = (on) => () => (document.body.style.cursor = on ? 'pointer' : '')

  return (
    <group ref={rig}>
      <mesh ref={glow} position={[0, 0, -1.2]} scale={narrow ? 5.5 : 7}>
        <planeGeometry />
        <meshBasicMaterial map={glowTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={spin}>
        <group ref={halfA} onClick={replayIntro} onPointerOver={hover(true)} onPointerOut={hover(false)}>
          <mesh geometry={ring} material={matA} />
          <mesh geometry={tail} material={matA} />
        </group>
        <group ref={halfB} onClick={replayIntro} onPointerOver={hover(true)} onPointerOut={hover(false)}>
          <mesh geometry={ring} material={matB} />
          <mesh geometry={tail} material={matB} />
        </group>
        <mesh ref={blade} geometry={bladeGeo}>
          <meshStandardMaterial color="#f4f4f8" metalness={1} roughness={0.12} emissive="#ffffff" emissiveIntensity={1.2} />
        </mesh>
        <pointLight ref={flashLight} position={[0, 0, 1.6]} color="#ffffff" distance={9} intensity={0} />
      </group>
      <group ref={ribbons}>
        <group rotation={[1.15, 0, 0.32]}>
          <mesh ref={ribbon1}>
            <cylinderGeometry args={[2.55, 2.55, 0.34, 160, 1, true]} />
            <meshBasicMaterial map={film} side={THREE.DoubleSide} transparent opacity={0.9} toneMapped={false} />
          </mesh>
        </group>
        <group rotation={[-0.95, 0.4, -0.55]}>
          <mesh ref={ribbon2}>
            <cylinderGeometry args={[3.15, 3.15, 0.3, 160, 1, true]} />
            <meshBasicMaterial map={film2} side={THREE.DoubleSide} transparent opacity={0.6} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

const sparkVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixel;
  attribute float aSize;
  attribute float aSeed;
  varying float vSeed;
  varying float vTw;
  void main() {
    vec3 p = position;
    p.y = mod(p.y + uTime * (0.05 + aSeed * 0.12) + 7.0, 14.0) - 7.0;
    p.x += sin(uTime * 0.3 + aSeed * 30.0) * 0.15;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixel * (9.0 / -mv.z);
    vSeed = aSeed;
    vTw = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 50.0));
  }
`
const sparkFragment = /* glsl */ `
  varying float vSeed;
  varying float vTw;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    a = pow(a, 3.0);
    if (vSeed > 0.93) {
      // four-point sparkle like the intro reel
      float cx = max(0.0, 1.0 - abs(c.x) * 14.0) * max(0.0, 1.0 - abs(c.y) * 2.2);
      float cy = max(0.0, 1.0 - abs(c.y) * 14.0) * max(0.0, 1.0 - abs(c.x) * 2.2);
      a = max(a, max(cx, cy));
    }
    vec3 col = mix(vec3(0.92, 0.92, 0.98), vec3(1.0, 0.22, 0.22), step(0.8, fract(vSeed * 7.31)));
    gl_FragColor = vec4(col, a * vTw * 0.9);
  }
`

function Sparkles({ count = 520 }) {
  const mat = useRef()
  const { gl } = useThree()
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14
      pos[i * 3 + 2] = -Math.random() * 12 + 2
      seed[i] = Math.random()
      size[i] = seed[i] > 0.93 ? 9 + Math.random() * 8 : 1.5 + Math.random() * 3
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [count])
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixel: { value: gl.getPixelRatio() } }), [gl])
  useFrame(({ clock }) => {
    uniforms.uTime.value = sceneState.reducedMotion ? 0 : clock.elapsedTime
  })
  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={sparkVertex}
        fragmentShader={sparkFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function Environment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.55
    return () => {
      env.dispose()
      pm.dispose()
    }
  }, [gl, scene])
  return null
}

function Bloom() {
  const { gl, scene, camera, size } = useThree()
  const composer = useMemo(() => {
    const c = new EffectComposer(gl)
    c.addPass(new RenderPass(scene, camera))
    c.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.9))
    c.addPass(new OutputPass())
    return c
  }, [gl, scene, camera])
  useEffect(() => composer.setSize(size.width, size.height), [composer, size])
  useEffect(() => () => composer.dispose(), [composer])
  useFrame((_, dt) => composer.render(dt), 1)
  return null
}

function CameraRig() {
  useFrame(({ camera, pointer }, dt) => {
    if (sceneState.reducedMotion) return
    const k = 1 - Math.exp(-dt * 2)
    camera.position.x += (pointer.x * 0.35 - camera.position.x) * k
    camera.position.y += (pointer.y * 0.2 - camera.position.y) * k
    camera.lookAt(0, 0, -1)
  })
  return null
}

function World() {
  const { size } = useThree()
  const narrow = size.width < 820
  return (
    <>
      <color attach="background" args={['#050507']} />
      <fog attach="fog" args={['#050507', 9, 22]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[-4, 5, 6]} intensity={1.6} />
      <pointLight position={[3, -2, -3]} color="#ff2a2a" intensity={14} distance={12} />
      <Environment />
      <QLogo narrow={narrow} />
      <Sparkles count={narrow ? 300 : 520} />
      <CameraRig />
      <Bloom />
    </>
  )
}

export default function Scene() {
  return (
    <Canvas
      className="scene"
      eventSource={document.getElementById('root')}
      eventPrefix="client"
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 9], fov: 35, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: 'high-performance', localClippingEnabled: true }}
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
