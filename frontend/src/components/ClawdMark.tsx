type Props = {
  /** idle — моргает и переминается; search — ещё и озирается по сторонам */
  mood?: 'idle' | 'search'
  className?: string
}

/**
 * Пиксельный Clawd на SVG (сетка 12×8, как в гифках) — для логотипа и мест, где гифка слишком тяжёлая.
 * Анимации — в CSS (.clawd-mark): моргание, шаг лапками, взмах клешнёй при наведении на ссылку-родителя.
 */
export default function ClawdMark({ mood = 'idle', className }: Props) {
  const classes = ['clawd-mark', `clawd-mark--${mood}`, className].filter(Boolean).join(' ')
  return (
    <svg className={classes} viewBox="0 0 12 8" shapeRendering="crispEdges" aria-hidden="true">
      <g className="clawd-mark__body">
        <rect x="2" y="0" width="8" height="6" />
        <rect className="clawd-mark__claw clawd-mark__claw--left" x="0" y="2" width="2" height="2" />
        <rect className="clawd-mark__claw clawd-mark__claw--right" x="10" y="2" width="2" height="2" />
        <g className="clawd-mark__eyes">
          <rect x="3" y="1" width="1" height="1" />
          <rect x="8" y="1" width="1" height="1" />
        </g>
      </g>
      <g className="clawd-mark__legs">
        <rect className="clawd-mark__leg clawd-mark__leg--a" x="2" y="6" width="1" height="2" />
        <rect className="clawd-mark__leg clawd-mark__leg--b" x="4" y="6" width="1" height="2" />
        <rect className="clawd-mark__leg clawd-mark__leg--a" x="7" y="6" width="1" height="2" />
        <rect className="clawd-mark__leg clawd-mark__leg--b" x="9" y="6" width="1" height="2" />
      </g>
    </svg>
  )
}
