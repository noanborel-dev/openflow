interface Props {
  on: boolean
  onChange: (v: boolean) => void
}

export function Toggle({ on, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative w-[34px] h-5 rounded-pill transition ${on ? 'bg-ink' : 'bg-ink-08'}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-all ${on ? 'left-[16px]' : 'left-0.5'}`}
      />
    </button>
  )
}
