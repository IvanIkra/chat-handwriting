import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import ErrorNotice from '../components/ErrorNotice'
import { useApiData } from '../hooks/useApiData'
import { formatDateTime, plural, twinVerdictLabel } from '../utils/format'

const minutesWord: [string, string, string] = ['минуту', 'минуты', 'минут']

export default function PairPage() {
  const { chatId = '', aId = '', bId = '' } = useParams()
  const state = useApiData(`${chatId}/${aId}/${bId}`, () => api.getPair(chatId, aId, bId))

  if (state.kind === 'loading') return <p>Сравниваем пару…</p>
  if (state.kind === 'error') return <ErrorNotice error={state.error} />

  const { pair, a, b, examples, timeline, explanation } = state.data
  const twinsPath = `/chats/${encodeURIComponent(chatId)}/twins`
  const signals = [...pair.signals].sort((x, y) => y.weight - x.weight)
  const featureLabel = (feature: string) =>
    pair.signals.find((s) => s.feature === feature)?.label ?? feature

  return (
    <section>
      <Link to={twinsPath}>← К двойникам</Link>
      <div className="profile-head">
        <h2>
          {a.name} и {b.name}
        </h2>
        <div className="twin-pair__head">
          <span className="pair-score">{Math.round(pair.score * 100)}%</span>
          <span className={`twin-verdict twin-verdict--${pair.verdict}`}>{twinVerdictLabel[pair.verdict]}</span>
        </div>
      </div>

      <h3>Улики</h3>
      {signals.length === 0 ? (
        <p className="muted">Общих черт почерка не нашлось.</p>
      ) : (
        <ul className="signals">
          {signals.map((s) => (
            <li key={s.feature} className="signal">
              <div className="signal__head">
                <strong>{s.label}</strong>
                <span className="signal__weight" aria-label={`вес ${Math.round(s.weight * 100)}%`}>
                  <span style={{ width: `${Math.round(s.weight * 100)}%` }} />
                </span>
              </div>
              <p className="muted">{s.observed}</p>
            </li>
          ))}
        </ul>
      )}

      <h3>Похожие сообщения</h3>
      {examples.length === 0 ? (
        <p className="muted">Примеров нет.</p>
      ) : (
        <ul className="pair-examples">
          {examples.map((ex, i) => (
            <li key={i} className="pair-example">
              <span className="badge badge--neutral">{featureLabel(ex.feature)}</span>
              <div className="pair-example__cols">
                {[
                  { author: a, msg: ex.a },
                  { author: b, msg: ex.b },
                ].map(({ author, msg }) => (
                  <figure key={author.id} className="pair-message">
                    <figcaption>
                      <strong>{author.name}</strong>{' '}
                      <time className="muted" dateTime={msg.sent_at}>
                        {formatDateTime(msg.sent_at)}
                      </time>
                    </figcaption>
                    <blockquote>{msg.text}</blockquote>
                  </figure>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>Когда пишут</h3>
      <div className="pair-timeline">
        <div className="card">
          <strong className="pair-timeline__value">{plural(timeline.overlap_minutes, minutesWord)}</strong>
          <p className="muted">оба писали одновременно</p>
        </div>
        <div className="card">
          {timeline.median_switch_seconds === null ? (
            <>
              <strong className="pair-timeline__value">—</strong>
              <p className="muted">сообщения одного ни разу не шли сразу за сообщениями другого</p>
            </>
          ) : (
            <>
              <strong className="pair-timeline__value">{timeline.median_switch_seconds} с</strong>
              <p className="muted">медианная пауза, когда один сменяет другого</p>
            </>
          )}
        </div>
      </div>

      {explanation !== null && (
        <div className="llm-block">
          <h3>Объяснение</h3>
          <p>{explanation}</p>
        </div>
      )}
    </section>
  )
}
