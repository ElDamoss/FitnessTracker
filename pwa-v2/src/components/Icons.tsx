// ── SVG Logo ─────────────────────────────────────────────────────────────
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="6" y="18" width="28" height="4" rx="2" fill="currentColor" opacity="0.3"/>
      <rect x="6" y="16" width="6" height="8" rx="2" fill="currentColor"/>
      <rect x="28" y="16" width="6" height="8" rx="2" fill="currentColor"/>
      <rect x="10" y="14" width="4" height="12" rx="1.5" fill="currentColor" opacity="0.7"/>
      <rect x="26" y="14" width="4" height="12" rx="1.5" fill="currentColor" opacity="0.7"/>
      <path d="M11 30 L17 24 L23 27 L30 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
      <circle cx="30" cy="18" r="2" fill="currentColor" opacity="0.6"/>
    </svg>
  )
}

// ── SVG Icons ─────────────────────────────────────────────────────────────
export const icons = {
  barbell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="3.5" y1="12" x2="20.5" y2="12"/>
      <rect x="4" y="9.5" width="4" height="5" rx="1.2" fill="none" strokeWidth="1.5"/>
      <rect x="16" y="9.5" width="4" height="5" rx="1.2" fill="none" strokeWidth="1.5"/>
      <line x1="7" y1="8" x2="7" y2="16" strokeWidth="1.2"/>
      <line x1="17" y1="8" x2="17" y2="16" strokeWidth="1.2"/>
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/>
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/>
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/>
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="3"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="8" y1="6" x2="20" y2="6"/>
      <line x1="8" y1="12" x2="20" y2="12"/>
      <line x1="8" y1="18" x2="20" y2="18"/>
      <circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none"/>
      <circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>
      <circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none"/>
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 16.5L9 10.5L13 14L20.5 5.5"/>
      <path d="M15 5.5L20.5 5.5L20.5 11"/>
    </svg>
  ),
  caliper: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5L4 10M20 5L20 10"/>
      <path d="M4 7.5L20 7.5"/>
      <path d="M7 7.5L4.5 19"/>
      <path d="M17 7.5L19.5 19"/>
      <path d="M9.3 14L14.7 14" strokeWidth="1.4"/>
    </svg>
  ),
  flame: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 3.2c1 2.4-.6 3.6-1.7 4.9-1.3 1.6-2 3-2 4.7a3.7 3.7 0 0 0 7.4 0c0-1.1-.3-2-1-3 .2 1.6-.5 2.3-1.2 2.3-1 0-1.4-.9-1.1-1.9.6-2 1.6-3 1.6-5.1 0-.7-.1-1.3-.4-1.9-.5.7-1 1.3-1.6 0z"/>
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2.5L13.6 9.6L20.5 12L13.6 14.4L12 21.5L10.4 14.4L3.5 12L10.4 9.6Z"/>
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4.5"/>
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l9-9 9 9"/>
      <path d="M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10"/>
    </svg>
  ),
  flag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg>
  ),
  note: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <path d="M14 2v6h6"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="13" y2="17"/>
    </svg>
  ),
}
