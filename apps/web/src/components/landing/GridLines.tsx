'use client'

export interface GridLinesProps {
  /** Hero renders over a photo and needs light lines; every other section is
   * on a white background and needs dark lines. Defaults to dark-on-white. */
  dark?: boolean
}

/** Faint decorative vertical/horizontal grid lines, reused across sections. */
export function GridLines({ dark = false }: GridLinesProps) {
  const via = dark ? 'via-white/5' : 'via-black/5'
  const viaStrong = dark ? 'via-white/8' : 'via-black/8'
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <div className={`absolute inset-y-0 left-[12.5%] w-px bg-gradient-to-b from-transparent ${via} to-transparent`} />
      <div className={`absolute inset-y-0 left-[37.5%] w-px bg-gradient-to-b from-transparent ${via} to-transparent`} />
      <div className={`absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent ${viaStrong} to-transparent`} />
      <div className={`absolute inset-y-0 left-[62.5%] w-px bg-gradient-to-b from-transparent ${via} to-transparent`} />
      <div className={`absolute inset-y-0 left-[87.5%] w-px bg-gradient-to-b from-transparent ${via} to-transparent`} />
      <div className={`absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent ${via} to-transparent`} />
    </div>
  )
}
