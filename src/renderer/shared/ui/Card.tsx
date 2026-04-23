import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: Props) {
  return (
    <div className={`bg-card border border-ink-08 rounded-card overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

export function Row({ children, className = '' }: Props) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-ink-08 last:border-b-0 ${className}`}>
      {children}
    </div>
  )
}
