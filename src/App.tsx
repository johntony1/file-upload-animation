import { useRef, useState, useCallback } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { FileUpload } from './components/FileUpload'
import type { FileUploadHandle } from './components/FileUpload'
import fileSingleSrc from './assets/icons/file-single.svg'

gsap.registerPlugin(useGSAP)

const AMBIENT = {
  top:      '-58px',
  right:    '-88px',
  rotate:   22,
  scale:    0.90,
  opacity:  0.78,
  floatAmp: 8,
  floatDur: 3.1,
}

export default function App() {
  const stageRef  = useRef<HTMLDivElement>(null)
  const cardRef   = useRef<HTMLDivElement>(null)
  const uploadRef = useRef<FileUploadHandle>(null)
  const fileRef   = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [consumed, setConsumed] = useState(false)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const startFloat = useCallback(() => {
    if (!fileRef.current) return
    gsap.killTweensOf(fileRef.current)
    gsap.to(fileRef.current, {
      y: -AMBIENT.floatAmp,
      duration: AMBIENT.floatDur,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    })
  }, [])

  // Gentle idle float on mount
  useGSAP(() => { startFloat() }, { scope: stageRef })

  const isOverCard = useCallback((px: number, py: number) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return false
    return px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom
  }, [])

  // Single return — FileUpload stays at the same tree position always.
  // If it moved between branches, React would unmount+remount it,
  // wiping the 'uploading' state that triggerUpload just set.
  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={stageRef} style={{ position: 'relative' }}>

        {/* Ambient file — removed from DOM once consumed so it can't be dragged again */}
        {!consumed && (
          <motion.div
            ref={fileRef}
            style={{
              position:   'absolute',
              top:        AMBIENT.top,
              right:      AMBIENT.right,
              width:      '59px',
              height:     '77px',
              rotate:     AMBIENT.rotate,
              scale:      dragging ? AMBIENT.scale * 1.1 : AMBIENT.scale,
              opacity:    dragging ? 1 : AMBIENT.opacity,
              cursor:     dragging ? 'grabbing' : 'grab',
              zIndex:     dragging ? 100 : 1,
              x,
              y,
              willChange: 'transform',
            }}
            drag
            dragMomentum={false}
            dragElastic={0.1}
            onDragStart={() => {
              setDragging(true)
              gsap.killTweensOf(fileRef.current)
              gsap.set(fileRef.current, { clearProps: 'y' })
            }}
            onDrag={(_, info) => {
              uploadRef.current?.setDragOver(isOverCard(info.point.x, info.point.y))
            }}
            onDragEnd={(_, info) => {
              setDragging(false)
              uploadRef.current?.setDragOver(false)

              if (isOverCard(info.point.x, info.point.y)) {
                // Mark consumed AFTER triggering upload so FileUpload
                // keeps its state across the re-render
                uploadRef.current?.triggerUpload()
                setConsumed(true)
              } else {
                animate(x, 0, { type: 'spring', visualDuration: 0.5, bounce: 0.35 })
                animate(y, 0, { type: 'spring', visualDuration: 0.5, bounce: 0.35 })
                setTimeout(startFloat, 550)
              }
            }}
            transition={{ scale: { type: 'spring', visualDuration: 0.25, bounce: 0.3 } }}
          >
            <div style={{ position: 'absolute', inset: '-6.25% -16.33% -18.75% -16.33%', pointerEvents: 'none' }}>
              <img alt="file" src={fileSingleSrc} style={{ display: 'block', maxWidth: 'none', width: '100%', height: '100%' }} />
            </div>
          </motion.div>
        )}

        {/* Upload card — always same position in tree */}
        <div ref={cardRef}>
          <FileUpload ref={uploadRef} />
        </div>
      </div>
    </div>
  )
}
