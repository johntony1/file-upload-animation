/* ─────────────────────────────────────────────────────────
 * FILE UPLOAD — ANIMATION STORYBOARD
 *
 *  MOUNT / IDLE
 *     0ms   wrapper scales in (0.92 → 1, spring)
 *   120ms   right icon fans  (+15°)
 *   200ms   left icon fans   (-15°)
 *   300ms   center icon rises (y+10 → 0)
 *   420ms   heading fades in
 *   520ms   subtext fades in
 *   620ms   button fades in
 *
 *  DRAG-OVER
 *     0ms   card ring glows, scales 1 → 1.025
 *     0ms   icon stack single smooth scale pulse (1 → 1.04, no repeat)
 *
 *  UPLOADING — file cards fall from sky into folder, one by one
 *
 *  File cards use position:fixed (viewport coords) to escape
 *  card overflow:hidden. Folder mouth measured after first rAF.
 *
 *    Figma card (202484:42480):
 *      115 × 44px (scaled to ~80% folder width for depth)
 *      white bg, border #ededed 0.651px,
 *      radius 7.809px, shadow rgba(68,68,68,0.16),
 *      two rounded text-bar lines inside
 *
 *     0ms   folder springs in + "Uploading..." fades up
 *   100ms   card[0] falls from sky  (power2.inOut, 1.30s)
 *           slight left drift, rotation -3.5°
 *  ~1.25s   card[0] absorbed (scale→0.15, opacity→0, 0.28s)
 *           absorption overlaps last 0.15s of fall
 *   1.10s   card[1] starts falling
 *  ...
 *  6000ms+  card[6] absorbed → upload complete
 *
 *  7000ms   uploading → complete
 *           Folder unmounts, CompleteFolder mounts (spring)
 *           Confetti burst from card centre
 *           "Upload complete" label fades up
 * 10500ms   auto-reset → idle
 *
 *  Depth/variation per card:
 *   slight X offset from folder center (±10px)
 *   slight rotation variation (±4°)
 *   cards converge toward center as they fall
 * ───────────────────────────────────────────────────────── */

import {
  forwardRef, useRef, useState, useCallback,
  useEffect, useImperativeHandle,
} from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

import fileLeftSrc          from '../assets/icons/file-left.svg'
import fileRightSrc         from '../assets/icons/file-right.svg'
import fileCenterSrc        from '../assets/icons/file-center.svg'
import folderBackSrc        from '../assets/icons/folder-back.png'
import folderFrontSrc       from '../assets/icons/folder-front.svg'
import folderCompleteBackSrc  from '../assets/icons/folder-complete-back.svg'
import FolderCompleteBase    from '../assets/icons/folder-complete-base.svg?react'
import FolderCompleteOverlay from '../assets/icons/folder-complete-overlay.svg?react'
import loaderSrc            from '../assets/icons/loader.svg'

gsap.registerPlugin(useGSAP)

// ─── Timing (ms) ─────────────────────────────────────────
const TIMING = {
  wrapperMount:   0,
  rightIconFan:   120,
  leftIconFan:    200,
  centerIconRise: 300,
  headingAppear:  420,
  subtextAppear:  520,
  buttonAppear:   620,
  uploadComplete: 7000,  // uploading → complete
  resetDelay:     10500, // complete → idle  (3.5s to enjoy the complete screen)
}

// ─── Springs ─────────────────────────────────────────────
const SPRING = {
  wrapper:    { type: 'spring' as const, visualDuration: 0.45, bounce: 0.30 },
  fanIcon:    { type: 'spring' as const, visualDuration: 0.55, bounce: 0.45 },
  centerIcon: { type: 'spring' as const, visualDuration: 0.50, bounce: 0.35 },
  text:       { type: 'spring' as const, visualDuration: 0.40, bounce: 0.20 },
  dragScale:  { type: 'spring' as const, visualDuration: 0.28, bounce: 0.15 },
  folder:     { type: 'spring' as const, visualDuration: 0.50, bounce: 0.35 },
  complete:   { type: 'spring' as const, visualDuration: 0.55, bounce: 0.40 },
  exitIcons:  { duration: 0.28, ease: 'easeInOut' as const },
}

// ─── Confetti burst ───────────────────────────────────────
const CONFETTI_COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#C77DFF', '#FF9F40', '#F72585', '#FFEAA7',
  '#A8E6CF', '#FFB7C5', '#74B9FF', '#FD79A8',
]

function triggerConfetti(cx: number, cy: number) {
  const COUNT = 52
  for (let i = 0; i < COUNT; i++) {
    const isCircle  = Math.random() > 0.55
    const w         = isCircle ? 7 : 5 + Math.random() * 7
    const h         = isCircle ? w : 4 + Math.random() * 4
    const color     = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    const angle     = Math.random() * Math.PI * 2
    const speed     = 90 + Math.random() * 130
    const dx        = Math.cos(angle) * speed
    const dy        = Math.sin(angle) * speed - 60   // bias upward
    const fall      = 120 + Math.random() * 80
    const rot       = (Math.random() - 0.5) * 900
    const delay     = Math.random() * 0.12
    const dur       = 0.85 + Math.random() * 0.4

    const el = document.createElement('div')
    Object.assign(el.style, {
      position:      'fixed',
      left:          `${cx - w / 2}px`,
      top:           `${cy - h / 2}px`,
      width:         `${w}px`,
      height:        `${h}px`,
      borderRadius:  isCircle ? '50%' : '2px',
      background:    color,
      pointerEvents: 'none',
      zIndex:        '1002',
      transformOrigin: 'center center',
    })
    document.body.appendChild(el)

    // Phase 1: burst outward  Phase 2: gravity fall + fade
    gsap.to(el, {
      delay,
      duration: dur,
      keyframes: [
        { x: dx * 0.65, y: dy,        rotation: rot * 0.55, ease: 'power4.out', duration: dur * 0.45 },
        { x: dx,        y: dy + fall,  rotation: rot, opacity: 0, scale: 0.25, ease: 'power2.in',  duration: dur * 0.55 },
      ],
      onComplete: () => el.remove(),
    })
  }
}

// ─── Figma file card dimensions (scaled to ~80% folder width for visual depth)
// Folder width: 161.066px → 0.8 × 161 ≈ 115px
const CARD_W = 115
const CARD_H = 44

// ─── Sequential fall configs ──────────────────────────────
// startDelay: seconds after Folder mounts
// offsetX: horizontal spread from folder mouth center (px)
// landX: x drift toward center as it falls
// fallDur: duration of gravity drop (power2.in)
const FALLING_CARDS = [
  { startDelay: 0.10, fallDur: 1.30, offsetX:  -9, landX:  -4, rotation: -3.5 },
  { startDelay: 1.10, fallDur: 1.30, offsetX:   8, landX:   3, rotation:  3.0 },
  { startDelay: 2.10, fallDur: 1.30, offsetX:  -5, landX:  -2, rotation: -2.0 },
  { startDelay: 3.10, fallDur: 1.30, offsetX:   6, landX:   2, rotation:  2.8 },
  { startDelay: 4.10, fallDur: 1.30, offsetX:  -7, landX:  -3, rotation: -3.0 },
  { startDelay: 5.10, fallDur: 1.30, offsetX:   4, landX:   1, rotation:  2.0 },
  { startDelay: 6.00, fallDur: 1.30, offsetX:  -3, landX:  -1, rotation: -1.5 },
]

const ABSORB_DUR     = 0.30  // seconds — scale+fade into folder
const ABSORB_OVERLAP = 0.15  // starts this many seconds before fall ends

// ─── Ripple: two concentric rings that expand + fade on absorption ────────────
function triggerRipple(cx: number, cy: number) {
  const rings = [
    { size: 56,  delay: 0,    dur: 0.50, alpha: 0.20 },
    { size: 96,  delay: 0.07, dur: 0.65, alpha: 0.11 },
  ]
  rings.forEach(({ size, delay, dur, alpha }) => {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position:      'fixed',
      left:          `${cx - size / 2}px`,
      top:           `${cy - size / 2}px`,
      width:         `${size}px`,
      height:        `${size}px`,
      borderRadius:  '50%',
      border:        `1.5px solid rgba(23,23,23,${alpha * 2.5})`,
      transform:     'scale(0)',
      opacity:       '1',
      pointerEvents: 'none',
      zIndex:        '999',
    })
    document.body.appendChild(el)
    gsap.to(el, {
      scale:    1,
      opacity:  0,
      delay,
      duration: dur,
      ease:     'power3.out',
      onComplete: () => el.remove(),
    })
  })
}

const CARD_SHADOW =
  '0px 0px 0px 1px rgba(51,51,51,0.04),' +
  '0px 16px 8px -8px rgba(51,51,51,0.01),' +
  '0px 12px 6px -6px rgba(51,51,51,0.02),' +
  '0px 5px 5px -2.5px rgba(51,51,51,0.08),' +
  '0px 1px 3px -1.5px rgba(51,51,51,0.16),' +
  'inset 0px -0.5px 0.5px 0px rgba(51,51,51,0.08)'

const DRAG_SHADOW = `0 0 0 2px rgba(23,23,23,0.18), ${CARD_SHADOW}`

const FAN_INSET = '-6.25% -16.33% -18.75% -16.33%'

type UploadState = 'idle' | 'drag-over' | 'uploading' | 'complete'

export interface FileUploadHandle {
  triggerUpload: () => void
  setDragOver:   (v: boolean) => void
}

// ─── Figma file card (202484:42480) ──────────────────────
// Bar widths are proportional to CARD_W so they scale correctly
const CARD_PAD_X  = 7.158
const CARD_INNER  = CARD_W - CARD_PAD_X * 2        // 100.684px at CARD_W=115
const BAR1_W      = CARD_INNER                      // full inner width  (~100px)
const BAR2_W      = Math.round(CARD_INNER * 0.402)  // 40% of inner      (~40px)

function FileCard() {
  return (
    <div style={{
      width:         `${CARD_W}px`,
      height:        `${CARD_H}px`,
      background:    'white',
      border:        '0.651px solid #ededed',
      borderRadius:  '7.809px',
      boxShadow:     '0px 3.033px 3.033px 2.275px rgba(68,68,68,0.16)',
      padding:       `11px ${CARD_PAD_X}px 10px`,
      display:       'flex',
      flexDirection: 'column',
      gap:           '5px',
      boxSizing:     'border-box',
      flexShrink:     0,
    }}>
      <div style={{ background: '#e2e2e0', height: '5px', width: `${BAR1_W}px`, borderRadius: '12px', flexShrink: 0 }} />
      <div style={{ background: '#e2e2e0', height: '5px', width: `${BAR2_W}px`, borderRadius: '12px', flexShrink: 0 }} />
    </div>
  )
}

// ─── Fan icon stack ───────────────────────────────────────
interface FileIconsProps {
  stage: number
  containerRef: React.RefObject<HTMLDivElement | null>
}
function FileIcons({ stage, containerRef }: FileIconsProps) {
  return (
    <div ref={containerRef} style={{ position: 'relative', width: '97.907px', height: '90px', flexShrink: 0 }}>
      {/* Right +15° */}
      <div style={{ position: 'absolute', left: '20.89px', top: 0, width: '77.016px', height: '89.801px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          style={{ flexShrink: 0 }}
          initial={{ rotate: 0, opacity: 0, x: -6 }}
          animate={{ rotate: stage >= 2 ? 15 : 0, opacity: stage >= 2 ? 1 : 0, x: stage >= 2 ? 0 : -6 }}
          transition={{ ...SPRING.fanIcon, delay: TIMING.rightIconFan / 1000 }}
        >
          <div data-icon="right" style={{ position: 'relative', width: '59.063px', height: '77.143px' }}>
            <div style={{ position: 'absolute', inset: FAN_INSET }}>
              <img alt="" src={fileRightSrc} style={{ display: 'block', maxWidth: 'none', width: '100%', height: '100%' }} />
            </div>
          </div>
        </motion.div>
      </div>
      {/* Left −15° */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: '77.016px', height: '89.801px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          style={{ flexShrink: 0 }}
          initial={{ rotate: 0, opacity: 0, x: 6 }}
          animate={{ rotate: stage >= 3 ? -15 : 0, opacity: stage >= 3 ? 1 : 0, x: stage >= 3 ? 0 : 6 }}
          transition={{ ...SPRING.fanIcon, delay: TIMING.leftIconFan / 1000 }}
        >
          <div data-icon="left" style={{ position: 'relative', width: '59.063px', height: '77.143px' }}>
            <div style={{ position: 'absolute', inset: FAN_INSET }}>
              <img alt="" src={fileLeftSrc} style={{ display: 'block', maxWidth: 'none', width: '100%', height: '100%' }} />
            </div>
          </div>
        </motion.div>
      </div>
      {/* Center */}
      <motion.div
        data-icon="center"
        style={{ position: 'absolute', left: '21.09px', top: '12.86px', width: '59.063px', height: '77.143px' }}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: stage >= 4 ? 0 : 10, opacity: stage >= 4 ? 1 : 0 }}
        transition={{ ...SPRING.centerIcon, delay: TIMING.centerIconRise / 1000 }}
      >
        <div style={{ position: 'absolute', inset: FAN_INSET }}>
          <img alt="" src={fileCenterSrc} style={{ display: 'block', maxWidth: 'none', width: '100%', height: '100%' }} />
        </div>
      </motion.div>
    </div>
  )
}

// ─── Upload complete visual (202484:42458) ───────────────
// Folder with files settled inside: gray photo card + white doc card,
// both peeking slightly above the closed folder-front.
// ─── Upload complete visual ───────────────────────────────
// nessa.svg is a complete standalone folder — render it alone, no card layers.
// Exact path of the folder overlay shape — used to clip the CSS backdrop-filter
// so it only blurs the background behind the semi-transparent dark flap (matches
// the foreignObject clip-path Figma uses for the same effect).
// Clips the container to the folder body shape — hides any SVG filter bleed outside
const FOLDER_CLIP = "path('M0 30.0154C0 13.4384 13.4384 0 30.0154 0L131.051 0C147.628 0 161.066 13.4384 161.066 30.0154V129.985C161.066 146.562 147.628 160 131.051 160L30.0154 160C13.4384 160 0 146.562 0 129.985L0 30.0154Z')"
const OVERLAY_PATH = "path('M0 28.7646C0 22.5482 5.03939 17.5088 11.2558 17.5088H31.7937C35.9813 17.5088 40.0573 18.8597 43.416 21.3608C46.7747 23.8619 50.8507 25.2128 55.0383 25.2128H131.051C147.628 25.2128 161.066 38.6512 161.066 55.2283V129.984C161.066 146.561 147.628 160 131.051 160H30.0154C13.4383 160 0 146.561 0 129.984V28.7646Z')"

function CompleteFolder() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div style={{
        position: 'relative', width: '161.066px', height: '160px', flexShrink: 0,
        clipPath: FOLDER_CLIP,
      }}>
        <FolderCompleteBase style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <div style={{
          position: 'absolute', inset: 0,
          backdropFilter: 'blur(18.76px)',
          WebkitBackdropFilter: 'blur(18.76px)',
          clipPath: OVERLAY_PATH,
        }} />
        <FolderCompleteOverlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}

// ─── Folder — sequential card drop animation ──────────────
function Folder({ reducedMotion }: { reducedMotion: boolean }) {
  const folderRef      = useRef<HTMLDivElement>(null)   // outer layout wrapper
  const folderContRef  = useRef<HTMLDivElement>(null)   // 161×160 image container
  const folderFrontRef = useRef<HTMLImageElement>(null) // portaled folder-front
  const cardRefs       = useRef<(HTMLDivElement | null)[]>([])
  const statusRef      = useRef<HTMLDivElement>(null)
  const spinnerRef     = useRef<HTMLImageElement>(null)

  useEffect(() => {
    let tickerFn: (() => void) | null = null
    let stopSyncTimer: ReturnType<typeof setTimeout> | null = null

    const raf = requestAnimationFrame(() => {
      const cont = folderContRef.current
      if (!cont) return
      const rect = cont.getBoundingClientRect()
      if (rect.width === 0) return

      // Sync portaled folder-front position with the entrance spring for ~900ms
      tickerFn = () => {
        const r = cont.getBoundingClientRect()
        if (folderFrontRef.current) {
          folderFrontRef.current.style.left       = `${r.left}px`
          folderFrontRef.current.style.top        = `${r.top + 17.51}px`
          folderFrontRef.current.style.visibility = 'visible'
        }
      }
      gsap.ticker.add(tickerFn)
      stopSyncTimer = setTimeout(() => {
        if (tickerFn) gsap.ticker.remove(tickerFn)
      }, 900)

      // Folder mouth center in viewport coords (measured once for GSAP timeline)
      const mouthCX = rect.left + rect.width  / 2
      const mouthY  = rect.top  + 17   // top of folder opening

      const tl = gsap.timeline()

      // Status row fades in
      if (statusRef.current) {
        tl.fromTo(statusRef.current,
          { opacity: 0, y: 5 },
          { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' },
          0
        )
      }

      // Spinner rotation (continuous, independent of timeline)
      if (spinnerRef.current && !reducedMotion) {
        gsap.to(spinnerRef.current, {
          rotation: 360,
          duration: 1.1,
          ease: 'none',
          repeat: -1,
          transformOrigin: 'center center',
        })
      }

      // Cards fall one at a time
      FALLING_CARDS.forEach((cfg, i) => {
        const el = cardRefs.current[i]
        if (!el) return

        const startLeft = mouthCX + cfg.offsetX - CARD_W / 2
        const landLeft  = mouthCX + cfg.landX   - CARD_W / 2

        tl.set(el, {
          left:       startLeft,
          top:        -(CARD_H + 30),
          rotation:   cfg.rotation,
          opacity:    reducedMotion ? 0 : 1,
          scale:      1,
          visibility: reducedMotion ? 'hidden' : 'visible',
          transformOrigin: 'center center',
        }, cfg.startDelay)

        if (!reducedMotion) {
          // ── Gravity drop ────────────────────────────────
          // power2.inOut: natural gravity — accelerates then softens at landing
          tl.to(el, {
            top:      mouthY - 4,
            left:     landLeft,
            rotation: cfg.rotation * 0.25,
            ease:     'power2.inOut',
            duration: cfg.fallDur,
          }, cfg.startDelay)

          // ── Soft absorption ──────────────────────────────
          tl.to(el, {
            scale:    0.15,
            opacity:  0,
            top:      mouthY + 18,
            ease:     'power2.inOut',
            duration: ABSORB_DUR,
          }, cfg.startDelay + cfg.fallDur - ABSORB_OVERLAP)

          // ── Ripple at absorption midpoint ─────────────────
          tl.call(
            () => triggerRipple(mouthCX, mouthY + 10),
            [],
            cfg.startDelay + cfg.fallDur - ABSORB_OVERLAP + ABSORB_DUR * 0.4
          )
        }

        tl.set(el, { visibility: 'hidden' },
          cfg.startDelay + cfg.fallDur - ABSORB_OVERLAP + ABSORB_DUR
        )
      })
    })

    return () => {
      cancelAnimationFrame(raf)
      if (stopSyncTimer) clearTimeout(stopSyncTimer)
      if (tickerFn) gsap.ticker.remove(tickerFn)
      gsap.killTweensOf(cardRefs.current)
      if (spinnerRef.current) gsap.killTweensOf(spinnerRef.current)
    }
  }, [reducedMotion])


  return (
    <div
      ref={folderRef}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}
    >
      {/* Folder: back layer only — front is portaled to body at z:1001 so it
          paints above the falling cards (z:1000) regardless of Framer Motion
          transform stacking contexts */}
      <div ref={folderContRef} style={{ position: 'relative', width: '161.066px', height: '160px', flexShrink: 0 }}>
        <img
          alt=""
          src={folderBackSrc}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      {createPortal(
        <>
          {/* Falling cards — z:1000, above the card overflow but below folder-front */}
          {FALLING_CARDS.map((_, i) => (
            <div
              key={i}
              ref={el => { cardRefs.current[i] = el }}
              style={{
                position:      'fixed',
                top:           -(CARD_H + 30),
                left:          0,
                width:         `${CARD_W}px`,
                height:        `${CARD_H}px`,
                zIndex:        1000,
                visibility:    'hidden',
                pointerEvents: 'none',
                willChange:    'transform, opacity',
              }}
            >
              <FileCard />
            </div>
          ))}
          {/* Folder-front — z:1001, always above cards so they visually enter the folder */}
          <img
            ref={folderFrontRef}
            alt=""
            src={folderFrontSrc}
            style={{
              position:      'fixed',
              left:          0,
              top:           0,
              width:         '161.066px',
              height:        '142.491px',
              zIndex:        1001,
              display:       'block',
              pointerEvents: 'none',
              visibility:    'hidden',
            }}
          />
        </>,
        document.body
      )}

      {/* Status row — centered spinner + "Uploading..." */}
      <div
        ref={statusRef}
        style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', opacity: 0 }}
      >
        <div style={{ position: 'relative', width: '16px', height: '16px', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: '12.5%' }}>
            <img
              ref={spinnerRef}
              alt=""
              src={loaderSrc}
              style={{ display: 'block', maxWidth: 'none', width: '100%', height: '100%' }}
            />
          </div>
        </div>
        <span style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 400,
          fontSize: '12px', lineHeight: '16px', color: '#171717',
          whiteSpace: 'nowrap', fontFeatureSettings: "'ss11' 1, 'calt' 0, 'liga' 0",
        }}>
          Uploading...
        </span>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────
export const FileUpload = forwardRef<FileUploadHandle>((_, ref) => {
  const reducedMotion = useReducedMotion() ?? false
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [stage,       setStage      ] = useState(0)
  const [replayKey,   setReplayKey  ] = useState(0)

  const fileInputRef      = useRef<HTMLInputElement>(null)
  const iconsContainerRef = useRef<HTMLDivElement>(null)
  const dropZoneRef       = useRef<HTMLDivElement>(null)
  const timersRef         = useRef<ReturnType<typeof setTimeout>[]>([])
  const uploadStateRef    = useRef(uploadState)
  uploadStateRef.current  = uploadState

  // Stage cascade on mount / replay
  useEffect(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setStage(0)
    const at = (fn: () => void, ms: number) =>
      timersRef.current.push(setTimeout(fn, ms))
    at(() => setStage(1), TIMING.wrapperMount)
    at(() => setStage(2), TIMING.rightIconFan)
    at(() => setStage(3), TIMING.leftIconFan)
    at(() => setStage(4), TIMING.centerIconRise)
    at(() => setStage(5), TIMING.headingAppear)
    at(() => setStage(6), TIMING.subtextAppear)
    at(() => setStage(7), TIMING.buttonAppear)
    return () => timersRef.current.forEach(clearTimeout)
  }, [replayKey])

  // GSAP idle float
  useGSAP(() => {
    if (!iconsContainerRef.current || uploadState !== 'idle' || reducedMotion) return
    const ctx = gsap.context(() => {
      gsap.to('[data-icon="center"]', { y: -4,   duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 })
      gsap.to('[data-icon="left"]',   { y: -2.5, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.4 })
      gsap.to('[data-icon="right"]',  { y: -3,   duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.8 })
    }, iconsContainerRef)
    return () => ctx.revert()
  }, [uploadState, stage, reducedMotion])

  // GSAP drag-over pulse — single smooth scale-in, no repeat
  useGSAP(() => {
    if (!iconsContainerRef.current) return
    if (uploadState === 'drag-over') {
      gsap.killTweensOf(iconsContainerRef.current)
      gsap.to(iconsContainerRef.current, {
        scale: reducedMotion ? 1 : 1.04,
        duration: 0.25,
        ease: 'power2.out',
      })
    } else {
      gsap.killTweensOf(iconsContainerRef.current)
      gsap.to(iconsContainerRef.current, { scale: 1, duration: 0.22, ease: 'power2.out' })
    }
  }, [uploadState, reducedMotion])

  const startUpload = useCallback(() => {
    if (uploadStateRef.current === 'uploading') return
    setUploadState('uploading')
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    timersRef.current.push(
      setTimeout(() => setUploadState('complete'), TIMING.uploadComplete)
    )
  }, [])

  useImperativeHandle(ref, () => ({
    triggerUpload: startUpload,
    setDragOver: (v: boolean) => {
      const s = uploadStateRef.current
      if (s === 'uploading') return
      setUploadState(v ? 'drag-over' : (s === 'complete' ? 'complete' : 'idle'))
    },
  }), [startUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) startUpload()
  }, [startUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (uploadStateRef.current === 'idle') setUploadState('drag-over')
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node))
      if (uploadStateRef.current === 'drag-over') setUploadState('idle')
  }, [])

  const isDragOver   = uploadState === 'drag-over'
  const showIcons    = uploadState === 'idle' || uploadState === 'drag-over'
  const isUploading  = uploadState === 'uploading'
  const isComplete   = uploadState === 'complete'

  // Confetti burst — fires once when complete state is entered
  useEffect(() => {
    if (!isComplete || reducedMotion) return
    const rect = dropZoneRef.current?.getBoundingClientRect()
    if (!rect) return
    // Burst from upper-centre of the card where the folder lives
    triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height * 0.38)
  }, [isComplete, reducedMotion])

  return (
    <motion.div
      key={replayKey}
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: stage >= 1 ? 1 : 0.92, opacity: stage >= 1 ? 1 : 0 }}
      transition={SPRING.wrapper}
      style={{ width: '320px' }}
    >
      <div style={{
        background: '#f7f7f7', borderRadius: '28px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '16px', padding: '8px 8px 16px',
      }}>
        {/* Drop-zone card */}
        <motion.div
          ref={dropZoneRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          animate={{
            scale:     isDragOver ? 1.025 : 1,
            boxShadow: isDragOver ? DRAG_SHADOW : CARD_SHADOW,
          }}
          transition={SPRING.dragScale}
          style={{
            background: 'white', borderRadius: '20px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '20px',
            padding: '32px 40px', width: '100%',
            overflow: 'hidden', position: 'relative',
          }}
        >
          <AnimatePresence mode="wait">
            {showIcons && (
              <motion.div
                key="icons-block"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}
                exit={{ opacity: 0, scale: 0.88, y: -8, transition: SPRING.exitIcons }}
              >
                <FileIcons stage={stage} containerRef={iconsContainerRef} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', textAlign: 'center' }}>
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: stage >= 5 ? 1 : 0, y: stage >= 5 ? 0 : 6 }}
                    transition={{ ...SPRING.text, delay: TIMING.headingAppear / 1000 }}
                    style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '14px', lineHeight: '20px', letterSpacing: '-0.084px', color: '#171717', width: '144px', fontFeatureSettings: "'ss11' 1, 'calt' 0, 'liga' 0" }}
                  >
                    Choose a file or drag &amp; drop it here.
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: stage >= 6 ? 1 : 0, y: stage >= 6 ? 0 : 4 }}
                    transition={{ ...SPRING.text, delay: TIMING.subtextAppear / 1000 }}
                    style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '12px', lineHeight: '16px', color: '#5c5c5c', width: '158px', fontFeatureSettings: "'ss11' 1, 'calt' 0, 'liga' 0" }}
                  >
                    Drag and drop your files here up to 50 MB here.
                  </motion.p>
                </div>
              </motion.div>
            )}

            {/* Uploading: falling cards into open folder */}
            {isUploading && (
              <motion.div
                key="folder-block"
                initial={{ opacity: 0, scale: 0.88, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -6, transition: { duration: 0.22, ease: 'easeIn' } }}
                transition={SPRING.folder}
              >
                <Folder reducedMotion={reducedMotion} />
              </motion.div>
            )}

            {/* Complete: settled files in closed folder + confetti */}
            {isComplete && (
              <motion.div
                key="complete-block"
                initial={{ opacity: 0, scale: 0.88, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
                transition={SPRING.complete}
              >
                <CompleteFolder />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Browse files button */}
        <motion.button
          type="button"
          aria-label="Browse files to upload"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: stage >= 7 ? 1 : 0, y: stage >= 7 ? 0 : 4 }}
          transition={{ ...SPRING.text, delay: TIMING.buttonAppear / 1000 }}
          whileHover={!isUploading && !reducedMotion ? { y: -1, boxShadow: '0px 4px 12px rgba(0,0,0,0.15), 0px 0px 0px 1px #ebebeb', transition: { duration: 0.18 } } : undefined}
          whileTap={!isUploading ? { scale: 0.97, transition: { duration: 0.10 } } : undefined}
          onClick={() => {
            if (isUploading) return
            if (isComplete) { startUpload(); return }
            fileInputRef.current?.click()
          }}
          style={{
            display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center',
            padding: '6px', borderRadius: '8px', border: 'none',
            cursor:     isUploading ? 'not-allowed' : 'pointer',
            background: isUploading ? '#ebebeb' : 'white',
            boxShadow:  isUploading ? 'none' : '0px 1px 3px 0px rgba(14,18,27,0.12), 0px 0px 0px 1px #ebebeb',
            transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
            outline: 'none',
          }}
          onFocus={e => { if (!isUploading) (e.currentTarget as HTMLElement).style.outline = '2px solid #171717'; (e.currentTarget as HTMLElement).style.outlineOffset = '3px' }}
          onBlur={e => { (e.currentTarget as HTMLElement).style.outline = 'none' }}
        >
          <span style={{
            padding: '0 4px', fontFamily: 'Inter, sans-serif', fontWeight: 500,
            fontSize: '14px', lineHeight: '20px', letterSpacing: '-0.084px',
            color: isUploading ? '#d1d1d1' : '#5c5c5c', whiteSpace: 'nowrap',
            fontFeatureSettings: "'ss11' 1, 'calt' 0, 'liga' 0",
            transition: 'color 0.2s ease',
          }}>
            {isComplete ? 'Reupload' : 'Browse files'}
          </span>
        </motion.button>

        <input
          ref={fileInputRef} type="file"
          onChange={e => { if (e.target.files?.[0]) startUpload(); e.target.value = '' }}
          tabIndex={-1} aria-hidden="true"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
      </div>
    </motion.div>
  )
})

FileUpload.displayName = 'FileUpload'
