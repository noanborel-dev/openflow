import { CSSProperties, ReactNode, MouseEvent } from 'react'

type Variant = 'primary' | 'secondary' | 'dark' | 'volt'

interface Props {
  children: ReactNode
  variant?: Variant
  onClick?: (e: MouseEvent) => void
  className?: string
  style?: CSSProperties
  disabled?: boolean
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:opacity-90',
  secondary: 'bg-card text-ink border border-ink-08 hover:bg-paper',
  dark: 'bg-ink text-paper',
  volt: 'bg-volt text-ink hover:brightness-95',
}

export function Pill({
  children,
  variant = 'primary',
  onClick,
  className = '',
  style,
  disabled,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-sm font-medium disabled:opacity-50 transition ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
