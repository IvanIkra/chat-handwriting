import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Author, TwinPair } from '../api/types'
import { twinVerdictLabel } from '../utils/format'

type Props = {
  authors: Author[]
  pairs: TwinPair[]
  /** Ссылка на сравнение пары */
  pairPath: (pair: TwinPair) => string
}

const WIDTH = 480
const HEIGHT = 360
const RADIUS = 130
const NODE_R = 10

/** Участники по кругу, рёбра — пары; толщина и яркость ребра растут со score */
export default function TwinsGraph({ authors, pairs, pairPath }: Props) {
  const navigate = useNavigate()
  const cx = WIDTH / 2
  const cy = HEIGHT / 2

  const positions = new Map(
    authors.map((author, i) => {
      // Первый автор сверху, дальше по часовой стрелке
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / authors.length
      return [author.id, { angle, x: cx + RADIUS * Math.cos(angle), y: cy + RADIUS * Math.sin(angle) }]
    }),
  )
  const names = new Map(authors.map((a) => [a.id, a.name]))

  // Слабые рёбра рисуем первыми, чтобы сильные были поверх
  const edges = [...pairs]
    .filter((p) => positions.has(p.a) && positions.has(p.b))
    .sort((x, y) => x.score - y.score)

  const onKey = (event: KeyboardEvent, pair: TwinPair) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      navigate(pairPath(pair))
    }
  }

  return (
    <figure className="twins-graph">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Граф похожести участников">
        {edges.map((pair) => {
          const a = positions.get(pair.a)!
          const b = positions.get(pair.b)!
          const label = `${names.get(pair.a)} и ${names.get(pair.b)}: ${Math.round(pair.score * 100)}% — ${twinVerdictLabel[pair.verdict]}`
          return (
            <g
              key={`${pair.a}-${pair.b}`}
              className={`twins-graph__edge twins-graph__edge--${pair.verdict}`}
              role="link"
              tabIndex={0}
              aria-label={label}
              data-verdict={pair.verdict}
              onClick={() => navigate(pairPath(pair))}
              onKeyDown={(event) => onKey(event, pair)}
            >
              <title>{label}</title>
              <line
                className="twins-graph__line"
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                strokeWidth={1 + pair.score * 9}
                strokeOpacity={0.3 + pair.score * 0.7}
              />
              {/* Широкая невидимая линия, чтобы по тонкому ребру было легко попасть */}
              <line className="twins-graph__hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            </g>
          )
        })}

        {authors.map((author) => {
          const { angle, x, y } = positions.get(author.id)!
          const cos = Math.cos(angle)
          const anchor = Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end'
          const lx = x + Math.cos(angle) * (NODE_R + 8)
          const ly = y + Math.sin(angle) * (NODE_R + 8) + (Math.sin(angle) > 0.3 ? 10 : Math.sin(angle) < -0.3 ? -2 : 4)
          return (
            <g
              key={author.id}
              className={`twins-graph__node${author.enough_data ? '' : ' twins-graph__node--faded'}`}
            >
              <circle cx={x} cy={y} r={NODE_R} />
              <text x={lx} y={ly} textAnchor={anchor}>
                {author.name}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="muted">
        Чем толще ребро, тем сильнее похожи почерки. Красные — вероятно, один человек. Нажмите на ребро,
        чтобы сравнить пару.
      </figcaption>
    </figure>
  )
}
