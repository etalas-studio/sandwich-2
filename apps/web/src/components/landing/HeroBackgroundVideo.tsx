'use client'

import { useState } from 'react'
import { ACCENT } from './tokens'

/**
 * Full-bleed animated background for the hero. Plays the provided WEBM loop;
 * if the video fails to load (missing file, unsupported format), falls back
 * to a static CSS aurora gradient so the hero never shows a broken element.
 */
export function HeroBackgroundVideo() {
  const [videoFailed, setVideoFailed] = useState(false)

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {!videoFailed && (
        <video
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        >
          <source src="/videos/hero-background.webm" type="video/webm" />
        </video>
      )}
      {videoFailed && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(60% 50% at 20% 10%, ${ACCENT}33, transparent 60%), radial-gradient(50% 40% at 80% 30%, ${ACCENT}22, transparent 60%)`,
          }}
        />
      )}
      {/* Dark scrim so foreground text stays legible over any footage/gradient */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,8,10,0.55) 0%, rgba(5,8,10,0.85) 75%, #05080A 100%)' }} />
    </div>
  )
}
