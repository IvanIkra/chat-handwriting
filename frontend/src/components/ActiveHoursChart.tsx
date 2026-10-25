import { useState } from 'react'

type Props = {
  /** 24 доли по часам UTC (StyleProfile.active_hours) */
  hours: number[]
}

const W = 480
const H = 150
const TOP = 18 // место под подпись пика
const BOTTOM = 20 // место под подписи часов
const BAND = W / 24
const BAR = 14 // ≤ 24px, остаток полосы — воздух
const R = 4

const pct = (v: number) => `${Math.round(v * 100)}%`
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`

/** Столбец со скруглённым верхом и прямым основанием */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return ''
  const r = Math.min(R, h, w / 2)
  const base = y + h
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`
}

export default function ActiveHoursChart({ hours }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(...hours, 0.0001)
  // -1, если часов нет: бэкенд не должен так отвечать, но падать из-за этого незачем
  const peak = hours.indexOf(Math.max(...hours))
  const plotH = H - TOP - BOTTOM
  const baseline = TOP + plotH

  const bars = hours.map((v, h) => {
    const height = (v / max) * plotH
    return { h, v, x: h * BAND + (BAND - BAR) / 2, y: baseline - height, height }
  })
  const peakBar = peak >= 0 ? bars[peak] : null
  const shown = active === null ? null : bars[active]

  return (
    <figure className="hours-chart">
      <figcaption>
        Когда пишет <span className="muted">· время UTC</span>
      </figcaption>
      <div className="hours-chart__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={peakBar ? `Активность по часам, пик в ${hourLabel(peak)} UTC` : 'Активность по часам: нет данных'}>
          <line className="hours-chart__axis" x1={0} x2={W} y1={baseline + 0.5} y2={baseline + 0.5} />
          {bars.map((b) => (
            <path
              key={b.h}
              data-hour={b.h}
              className={`hours-chart__bar${active === b.h ? ' hours-chart__bar--active' : ''}`}
              d={barPath(b.x, b.y, BAR, b.height)}
            />
          ))}
          {peakBar && peakBar.v > 0 && (
            <text className="hours-chart__peak" x={peakBar.x + BAR / 2} y={peakBar.y - 5} textAnchor="middle">
              {pct(peakBar.v)}
            </text>
          )}
          {bars
            .filter((b) => b.h % 3 === 0)
            .map((b) => (
              <text key={b.h} className="hours-chart__tick" x={b.x + BAR / 2} y={H - 5} textAnchor="middle">
                {String(b.h).padStart(2, '0')}
              </text>
            ))}
          {/* Зона наведения — вся полоса часа, а не только закрашенный столбец */}
          {bars.map((b) => (
            <rect
              key={b.h}
              className="hours-chart__hit"
              x={b.h * BAND}
              y={0}
              width={BAND}
              height={baseline}
              tabIndex={0}
              aria-label={`${hourLabel(b.h)} UTC — ${pct(b.v)} сообщений`}
              onPointerEnter={() => setActive(b.h)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(b.h)}
              onBlur={() => setActive(null)}
            />
          ))}
        </svg>
        {shown && (
          <div
            className="hours-chart__tooltip"
            role="tooltip"
            style={{ left: `${((shown.x + BAR / 2) / W) * 100}%`, top: `${(shown.y / H) * 100}%` }}
          >
            <strong>{hourLabel(shown.h)}</strong> {pct(shown.v)}
          </div>
        )}
      </div>
      <details className="hours-chart__table">
        <summary>Таблица по часам</summary>
        <table>
          <thead>
            <tr>
              <th>Час (UTC)</th>
              <th>Доля сообщений</th>
            </tr>
          </thead>
          <tbody>
            {hours.map((v, h) => (
              <tr key={h}>
                <td>{hourLabel(h)}</td>
                <td>{pct(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
