import { type ReactNode } from 'react'

// ── Static Card (hover lift handled by CSS) ──────────────────────────────
export function TiltCard({ children, className = '', style = {} }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`tilt-card ${className}`} style={style}>
      {children}
    </div>
  )
}
