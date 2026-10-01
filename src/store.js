// Tiny shared state between the page (React DOM) and the 3D scene.
export const sceneState = {
  // performance.now()/1000 when the 3D slice intro should start (null = wait)
  introStart: null,
  reducedMotion:
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
}

export function startIntro() {
  if (sceneState.introStart == null) sceneState.introStart = performance.now() / 1000
}

export function replayIntro() {
  sceneState.introStart = performance.now() / 1000
}
