import type { Signal } from '../api/types'
import { segmentText } from '../utils/highlight'

type Props = {
  text: string
  signals: Signal[]
  /** Улики, на которые сейчас навели или поставили фокус — в тексте или в списке; пусто — ни одной */
  active: number[]
  onActivate: (indices: number[]) => void
}

/** Сила подсветки по весу: заметная даже у лёгкой улики, но без «кричащих» блоков */
const level = (weight: number) => Math.min(3, Math.max(1, Math.ceil(weight / 0.2)))

export default function HighlightedText({ text, signals, active, onActivate }: Props) {
  const segments = segmentText(text, signals)

  return (
    <p className="highlighted">
      {segments.map((seg, k) => {
        if (seg.signals.length === 0) return <span key={k}>{seg.text}</span>
        // Span'ы перекрываются: фрагмент активен, если активна любая из его улик
        const isActive = seg.signals.some((i) => active.includes(i))
        const labels = seg.signals.map((i) => signals[i].label).join(', ')
        return (
          <mark
            key={k}
            tabIndex={0}
            className={`hl hl--${level(seg.weight)}${isActive ? ' hl--active' : ''}`}
            title={labels}
            aria-label={`${seg.text} — ${labels}`}
            onPointerEnter={() => onActivate(seg.signals)}
            onPointerLeave={() => onActivate([])}
            onFocus={() => onActivate(seg.signals)}
            onBlur={() => onActivate([])}
          >
            {seg.text}
          </mark>
        )
      })}
    </p>
  )
}
