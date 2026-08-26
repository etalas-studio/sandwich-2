'use client'

/**
 * Full-bleed animated hero background — pure CSS, no video/3D dependency.
 * A soft diagonal light beam drifts in from the top-right corner over a
 * dark base, echoing the WebGL "aurora beam" look without any external
 * asset or library.
 */
export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <style>{`
        @keyframes sw-aurora-drift {
          0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.9; }
          50% { transform: translate(-3%, 2%) rotate(2deg); opacity: 1; }
        }
        .sw-aurora-beam {
          animation: sw-aurora-drift 14s ease-in-out infinite;
        }
      `}</style>

      {/* Diagonal beam glow, top-right */}
      <div
        className="sw-aurora-beam absolute -top-1/4 -right-1/4 w-[90%] h-[140%]"
        style={{
          background: 'conic-gradient(from 200deg at 70% 20%, transparent 0deg, rgba(59,130,246,0.35) 25deg, rgba(56,189,248,0.25) 45deg, transparent 90deg)',
          filter: 'blur(60px)',
        }}
      />

      {/* Soft base glow */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(55% 45% at 78% 8%, rgba(59,130,246,0.28), transparent 65%), radial-gradient(40% 35% at 15% 90%, rgba(37,84,199,0.14), transparent 70%)',
        }}
      />

      {/* Dark scrim so foreground text stays legible */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,8,10,0.35) 0%, rgba(5,8,10,0.75) 70%, #05080A 100%)' }} />
    </div>
  )
}
