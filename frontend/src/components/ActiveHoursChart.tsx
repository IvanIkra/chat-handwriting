import { useId, useState } from 'react'
import './ActiveHoursChart.css'

type Props = {
  /** 24 доли по часам UTC (StyleProfile.active_hours) */
  hours: number[]
}

const W = 480
const H = 140
const TOP = 22 // место под подпись пика
const BOTTOM = 2 // подписи часов — HTML под графиком, чтобы не мельчали на телефоне
const BAND = W / 24
const BAR = 12 // ≤ 24px, остаток полосы — воздух
const R = 4
const TICKS = [0, 6, 12, 18]

const pct = (v: number) => `${Math.round(v * 100)}%`
const pad = (h: number) => String(h).padStart(2, '0')
const hourLabel = (h: number) => `${pad(h)}:00`

/** Столбец со скруглённым верхом и прямым основанием */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return ''
  const r = Math.min(R, h, w / 2)
  const base = y + h
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`
}

export default function ActiveHoursChart({ hours }: Props) {
  const [active, setActive] = useState<number | null>(null)
  // id градиента уникален для каждого графика на странице; двоеточия React в url(#…) не нужны
  const gradientId = `hours-grad-${useId().replace(/[^\w-]/g, '')}`
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
      <figcaption className="hours-chart__caption">
        <span className="hours-chart__title">Когда пишет</span>{' '}
        <span className="muted">· время UTC</span>
      </figcaption>
      <div className="hours-chart__plot">
        <div className="hours-chart__canvas">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={peakBar ? `Активность по часам, пик в ${hourLabel(peak)} UTC` : 'Активность по часам: нет данных'}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="hours-chart__stop-top" />
                <stop offset="1" className="hours-chart__stop-bottom" />
              </linearGradient>
            </defs>
            <line className="hours-chart__grid" x1={0} x2={W} y1={TOP + 0.5} y2={TOP + 0.5} />
            <line className="hours-chart__grid" x1={0} x2={W} y1={TOP + plotH / 2 + 0.5} y2={TOP + plotH / 2 + 0.5} />
            <line className="hours-chart__axis" x1={0} x2={W} y1={baseline + 0.5} y2={baseline + 0.5} />
            {bars.map((b) => (
              <path
                key={b.h}
                data-hour={b.h}
                className={`hours-chart__bar${b.h === peak ? ' hours-chart__bar--peak' : ''}${active === b.h ? ' hours-chart__bar--active' : ''}`}
                fill={`url(#${gradientId})`}
                d={barPath(b.x, b.y, BAR, b.height)}
              />
            ))}
            {peakBar && peakBar.v > 0 && (
              <text className="hours-chart__peak" x={peakBar.x + BAR / 2} y={peakBar.y - 7} textAnchor="middle">
                {pct(peakBar.v)}
              </text>
            )}
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
        <div className="hours-chart__ticks" aria-hidden="true">
          {TICKS.map((h) => (
            <span key={h} className="hours-chart__tick" style={{ left: `${((h * BAND + BAND / 2) / W) * 100}%` }}>
              {pad(h)}
            </span>
          ))}
        </div>
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
