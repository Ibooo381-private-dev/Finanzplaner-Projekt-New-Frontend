/**
 * Schlichte Linien-Icons als Inline-SVG (keine Icon-Bibliothek, keine
 * Netzwerkzugriffe). Icons sind IMMER rein dekorativ: aria-hidden und
 * focusable=false – die Bedeutung trägt stets der sichtbare Text daneben.
 */

export type IconName =
  | 'overview'
  | 'accounts'
  | 'depot'
  | 'savings'
  | 'rebalancing'
  | 'goals'
  | 'simulation'
  | 'settings'
  | 'data'
  | 'save'
  | 'open'
  | 'file'
  | 'plus'
  | 'download'
  | 'upload'
  | 'menu'
  | 'close'

const PATHS: Record<IconName, string[]> = {
  overview: ['M3 3h7v9H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 16h7v5H3z'],
  accounts: ['M3 10h18', 'M5 10v8', 'M9.5 10v8', 'M14.5 10v8', 'M19 10v8', 'M3 21h18', 'M12 3 3 8h18z'],
  depot: ['M3 3v18h18', 'M7 15l4-4 3 3 6-7', 'M16 7h4v4'],
  savings: ['M4 5h16v14H4z', 'M4 9h16', 'M8 3v4', 'M16 3v4', 'M8 13h3', 'M8 16h6'],
  rebalancing: ['M12 3v18', 'M7 21h10', 'M5 7h14', 'M5 7l-3 7a3 3 0 0 0 6 0z', 'M19 7l-3 7a3 3 0 0 0 6 0z'],
  goals: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  ],
  simulation: ['M3 3v18h18', 'M7 16c3 0 4-6 7-6s3 3 6 3', 'M7 12c2-1 3-5 6-6', 'M17 4h3v3'],
  settings: ['M4 6h10', 'M18 6h2', 'M4 12h4', 'M12 12h8', 'M4 18h12', 'M20 18h0', 'M16 4v4', 'M10 10v4', 'M18 16v4'],
  data: ['M12 3c5 0 8 1.3 8 3s-3 3-8 3-8-1.3-8-3 3-3 8-3z', 'M4 6v6c0 1.7 3 3 8 3s8-1.3 8-3V6', 'M4 12v6c0 1.7 3 3 8 3s8-1.3 8-3v-6'],
  save: ['M5 3h11l3 3v15H5z', 'M8 3v5h7V3', 'M8 21v-7h8v7'],
  open: ['M3 7V5h7l2 2h9v12H3z', 'M3 10h18'],
  file: ['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M12 11v6', 'M9 14h6'],
  plus: ['M12 5v14', 'M5 12h14'],
  download: ['M12 4v11', 'M7 10l5 5 5-5', 'M4 20h16'],
  upload: ['M12 20V9', 'M7 14l5-5 5 5', 'M4 4h16'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
}

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
