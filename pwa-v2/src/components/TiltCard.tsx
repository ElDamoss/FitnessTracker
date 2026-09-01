import { type ReactNode } from 'react'

// ── Static Card (hover lift handled by CSS) ──────────────────────────────
export function TiltCard({ children, className = '', style = {}, onClick }: { children: ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div className={`tilt-card ${className}`} style={style} onClick={onClick}>
      {children}
    </div>
  )
}
