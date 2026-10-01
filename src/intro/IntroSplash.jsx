import { useEffect, useRef, useState } from 'react'
import { playIntro } from './intro.js'
import './intro.css'

const KEY = 'qc-intro-v2'
const seen = () => {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const markSeen = () => {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* storage blocked */
  }
}
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Full-screen QuiCut intro, shared by the website and the app. Plays once per browser session. */
export default function IntroSplash({ onFinish }) {
  const skip = useRef(seen() || reduced()).current
  const [state, setState] = useState(skip ? 'gone' : 'playing')
  const canvas = useRef()
  const done = useRef(false)

  const finish = () => {
    if (done.current) return
    done.current = true
    markSeen()
    setState('leaving')
    onFinish && onFinish()
  }

  useEffect(() => {
    if (skip) {
      onFinish && onFinish()
      return
    }
    document.documentElement.classList.add('intro-lock')
    const stop = playIntro(canvas.current, { onHandoff: finish })
    const safety = setTimeout(finish, 7000)
    return () => {
      stop()
      clearTimeout(safety)
      document.documentElement.classList.remove('intro-lock')
    }
  }, [])

  useEffect(() => {
    if (state !== 'leaving') return
    document.documentElement.classList.remove('intro-lock')
    const t = setTimeout(() => setState('gone'), 650)
    return () => clearTimeout(t)
  }, [state])

  if (state === 'gone') return null
  return (
    <div className={'intro-splash' + (state === 'leaving' ? ' is-leaving' : '')} role="img" aria-label="QuiCut">
      <canvas ref={canvas} aria-hidden="true" />
      <button className="intro-skip" type="button" onClick={finish}>
        Skip
      </button>
    </div>
  )
}
