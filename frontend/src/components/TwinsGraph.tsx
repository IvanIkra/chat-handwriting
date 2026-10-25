import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Author, TwinPair } from '../api/types'
import { twinVerdictLabel } from '../utils/format'
import './TwinsGraph.css'

type Props = {
  authors: Author[]
  pairs: TwinPair[]
  /** Ссылка на сравнение пары */
  pairPath: (pair: TwinPair) => string
}

const WIDTH = 560
const HEIGHT = 400
const RADIUS = 132
const NODE_R = 21
const LABEL_MAX = 12

/** Первая буква имени для кружка-аватара */
function initial(name: string): string {
  return (Array.from(name.trim())[0] ?? '?').toUpperCase()
}

/** Длинные имена в подписи узла обрезаем — полное имя остаётся в подсказке */
function shortName(name: string): string {
  const chars = Array.from(name)
  return chars.length > LABEL_MAX ? `${chars.slice(0, LABEL_MAX - 1).join('')}…` : name
}

/** Участники по кругу, рёбра — пары; толщина и яркость ребра растут со score */
export default function TwinsGraph({ authors, pairs, pairPath }: Props) {
  const navigate = useNavigate()
  const cx = WIDTH / 2
  const cy = HEIGHT / 2
  // Двоих ставим слева и справа, остальных — по кругу начиная сверху
  const start = authors.length === 2 ? Math.PI : -Math.PI / 2

  const positions = new Map(
    authors.map((author, i) => {
      const angle = start + (2 * Math.PI * i) / authors.length
      return [author.id, { angle, x: cx + RADIUS * Math.cos(angle), y: cy + RADIUS * Math.sin(angle) }]
    }),
  )
  const names = new Map(authors.map((a) => [a.id, a.name]))

  // Слабые рёбра рисуем первыми, чтобы сильные были поверх
  const edges = [...pairs]
    .filter((p) => positions.has(p.a) && positions.has(p.b))
    .sort((x, y) => x.score - y.score)

  // Узлы, которые входят в подозрительную пару, подсвечиваем
  const suspects = new Map<string, TwinPair['verdict']>()
  for (const pair of edges) {
    if (pair.verdict === 'different') continue
    for (const id of [pair.a, pair.b]) {
      if (suspects.get(id) !== 'likely_same') suspects.set(id, pair.verdict)
    }
  }

  const onKey = (event: KeyboardEvent, pair: TwinPair) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      navigate(pairPath(pair))
    }
  }

  return (
    <figure className="twins-graph">
      <div className="twins-graph__canvas">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Граф похожести участников">
          <circle className="twins-graph__orbit" cx={cx} cy={cy} r={RADIUS} aria-hidden="true" />

          {edges.map((pair) => {
            const a = positions.get(pair.a)!
            const b = positions.get(pair.b)!
            const percent = Math.round(pair.score * 100)
            const label = `${names.get(pair.a)} и ${names.get(pair.b)}: ${percent}% — ${twinVerdictLabel[pair.verdict]}`
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2
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
                  strokeWidth={1.5 + pair.score * 8}
                  strokeOpacity={0.25 + pair.score * 0.75}
                />
                {/* Широкая невидимая линия, чтобы по тонкому ребру было легко попасть */}
                <line className="twins-graph__hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                {pair.verdict !== 'different' && (
                  <g className="twins-graph__tag" aria-hidden="true">
                    <rect x={mx - 22} y={my - 12} width={44} height={24} rx={12} />
                    <text x={mx} y={my + 4.5} textAnchor="middle">
                      {percent}%
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {authors.map((author) => {
            const { angle, x, y } = positions.get(author.id)!
            const cos = Math.cos(angle)
            const sin = Math.sin(angle)
            const anchor = Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end'
            const gap = NODE_R + 10
            const lx = x + cos * gap
            const ly = y + sin * gap + (sin > 0.3 ? 12 : sin < -0.3 ? -4 : 5)
            const suspect = suspects.get(author.id)
            const classes = [
              'twins-graph__node',
              author.enough_data ? '' : 'twins-graph__node--faded',
              suspect ? `twins-graph__node--${suspect}` : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <g key={author.id} className={classes} aria-hidden="true">
                <title>
                  {author.enough_data ? author.name : `${author.name} — мало сообщений, не сравнивается`}
                </title>
                <circle className="twins-graph__halo" cx={x} cy={y} r={NODE_R + 7} />
                <circle className="twins-graph__dot" cx={x} cy={y} r={NODE_R} />
                <text className="twins-graph__initial" x={x} y={y + 5.5} textAnchor="middle">
                  {initial(author.name)}
                </text>
                <text className="twins-graph__name" x={lx} y={ly} textAnchor={anchor}>
                  {shortName(author.name)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <figcaption className="twins-graph__legend">
        <ul className="twins-graph__keys" aria-label="Обозначения">
          <li>
            <span className="twins-graph__swatch twins-graph__swatch--likely_same" aria-hidden="true" />
            вероятно, один человек
          </li>
          <li>
            <span className="twins-graph__swatch twins-graph__swatch--possible" aria-hidden="true" />
            возможно, один человек
          </li>
          <li>
            <span className="twins-graph__swatch twins-graph__swatch--different" aria-hidden="true" />
            разные люди
          </li>
        </ul>
        <p className="twins-graph__hint">
          Чем толще линия, тем сильнее похожи почерки. Нажмите на линию, чтобы открыть сравнение пары.
        </p>
      </figcaption>
    </figure>
  )
}
