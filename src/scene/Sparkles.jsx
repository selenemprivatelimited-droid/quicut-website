import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { sceneState } from '../store.js'

/* Drifting white and red sparkles, shared by the website scene and the app backdrop. */
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
  uniform vec3 uAccent;
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
    vec3 col = mix(vec3(0.92, 0.92, 0.98), uAccent, step(0.8, fract(vSeed * 7.31)));
    gl_FragColor = vec4(col, a * vTw * 0.9);
  }
`

export default function Sparkles({ count = 520, accent = '#ff3838' }) {
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
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixel: { value: gl.getPixelRatio() }, uAccent: { value: new THREE.Color() } }), [gl])
  uniforms.uAccent.value.set(accent).convertLinearToSRGB() // shader takes the raw sRGB numbers, like the original red
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

