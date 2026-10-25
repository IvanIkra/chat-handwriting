import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { Author } from '../api/types'
import Avatar from '../components/Avatar'
import Breadcrumbs from '../components/Breadcrumbs'
import ErrorNotice from '../components/ErrorNotice'
import Loading from '../components/Loading'
import { useApiData } from '../hooks/useApiData'
import { formatDateTime, messagesWord, plural, twinVerdictLabel } from '../utils/format'
import './PairPage.css'

const minutesWord: [string, string, string] = ['минуту', 'минуты', 'минут']

/** Улики о ритме переписки, а не о самом тексте */
const TIME_FEATURES = new Set(['no_overlap', 'switch_time', 'active_hours'])

const badgeTone: Record<string, string> = {
  likely_same: 'danger',
  possible: 'warn',
  different: 'neutral',
}

const GAUGE_R = 52
const GAUGE_C = 2 * Math.PI * GAUGE_R

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TextIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3 4h10M3 8h10M3 12h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function Person({ author, side }: { author: Author; side: 'a' | 'b' }) {
  return (
    <div className={`pair-person pair-person--${side}`}>
      <Avatar name={author.name} size="lg" ring className="pair-avatar" />
      <strong className="pair-person__name">{author.name}</strong>
      <span className="pair-person__meta">{plural(author.message_count, messagesWord)}</span>
      {!author.enough_data && <span className="badge warn">мало данных</span>}
    </div>
  )
}

export default function PairPage() {
  const { chatId = '', aId = '', bId = '' } = useParams()
  const state = useApiData(`${chatId}/${aId}/${bId}`, () => api.getPair(chatId, aId, bId))

  if (state.kind === 'loading') return <Loading>Сравниваем пару…</Loading>
  if (state.kind === 'error') return <ErrorNotice error={state.error} standalone />

  const { pair, a, b, examples, timeline, explanation } = state.data
  const chatPath = `/chats/${encodeURIComponent(chatId)}`
  const twinsPath = `${chatPath}/twins`
  const signals = [...pair.signals].sort((x, y) => y.weight - x.weight)
  const featureLabel = (feature: string) =>
    pair.signals.find((s) => s.feature === feature)?.label ?? feature
  const percent = Math.round(pair.score * 100)
  const tone = badgeTone[pair.verdict] ?? 'neutral'
  const hasClue = (feature: string) => pair.signals.some((s) => s.feature === feature)

  return (
    <div className="page pair-page">
      <Breadcrumbs
        items={[{ label: 'Чат', to: chatPath }, { label: 'Двойники', to: twinsPath }, { label: 'Сравнение пары' }]}
      />

      <header className="page-header">
        <div>
          <h2>
            {a.name} и {b.name}
          </h2>
          <p className="page-subtitle">
            Один человек под двумя аккаунтами — или всё-таки двое? Сравниваем почерк, словечки и ритм переписки.
          </p>
        </div>
        <div className="page-actions">
          <Link className="button ghost small" to={twinsPath}>
            ← К двойникам
          </Link>
        </div>
      </header>

      <section className={`card pair-faceoff pair-faceoff--${pair.verdict}`} aria-label="Итог сравнения">
        <Person author={a} side="a" />

        <div className="pair-faceoff__center">
          {/* То же кольцо, что у вердикта проверки (ScoreMeter): цвет задаёт тон пары */}
          <div className="verdict__gauge pair-gauge">
            <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
              <circle className="verdict__track" cx="60" cy="60" r={GAUGE_R} />
              <circle
                className="verdict__arc"
                cx="60"
                cy="60"
                r={GAUGE_R}
                strokeDasharray={GAUGE_C}
                strokeDashoffset={GAUGE_C * (1 - Math.max(0, Math.min(100, percent)) / 100)}
                style={{ ['--arc-length' as string]: GAUGE_C }}
              />
            </svg>
            <div className="verdict__center">
              <span className="verdict__score">{percent}%</span>
            </div>
          </div>
          <span className={`badge ${tone}`}>{twinVerdictLabel[pair.verdict]}</span>
          <span className="pair-faceoff__caption">похожесть почерка</span>
        </div>

        <Person author={b} side="b" />
      </section>

      {explanation !== null && (
        <section className="card pair-explanation">
          <span className="pair-explanation__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
              <path
                d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z"
                fill="currentColor"
              />
            </svg>
          </span>
          <div className="pair-explanation__body">
            <h3>Объяснение</h3>
            <p>{explanation}</p>
          </div>
        </section>
      )}

      <div className="pair-grid">
        <section className="card pair-section">
          <h3>Улики</h3>
          {signals.length === 0 ? (
            <p className="muted">Общих черт почерка не нашлось.</p>
          ) : (
            <ul className="pair-signals">
              {signals.map((s) => {
                const time = TIME_FEATURES.has(s.feature)
                const weight = Math.round(s.weight * 100)
                return (
                  <li key={s.feature} className={`pair-signal${time ? ' pair-signal--time' : ''}`}>
                    <span className="pair-signal__icon" aria-hidden="true">
                      {time ? <ClockIcon /> : <TextIcon />}
                    </span>
                    <div className="pair-signal__body">
                      <div className="pair-signal__head">
                        <strong>{s.label}</strong>
                        {time && <span className="badge accent">ритм</span>}
                      </div>
                      <p className="pair-signal__observed">{s.observed}</p>
                    </div>
                    <div className="pair-signal__weight" role="img" aria-label={`вес ${weight}%`}>
                      <span className="pair-signal__weight-value">{weight}%</span>
                      <span className="pair-signal__bar">
                        <span style={{ width: `${weight}%` }} />
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card pair-section pair-timeline">
          <h3>Когда пишут</h3>
          <p className="pair-timeline__intro">
            С двух аккаунтов одновременно не напишешь: у одного человека они не пересекаются по времени и сменяют
            друг друга быстро.
          </p>
          <div className="pair-timeline__stats">
            <div className={`pair-timeline__stat${hasClue('no_overlap') ? ' pair-timeline__stat--clue' : ''}`}>
              <span className="pair-timeline__value">{plural(timeline.overlap_minutes, minutesWord)}</span>
              <span className="pair-timeline__label">оба писали одновременно</span>
              {hasClue('no_overlap') && <span className={`badge ${tone}`}>улика</span>}
            </div>
            <div className={`pair-timeline__stat${hasClue('switch_time') ? ' pair-timeline__stat--clue' : ''}`}>
              {timeline.median_switch_seconds === null ? (
                <>
                  <span className="pair-timeline__value">—</span>
                  <span className="pair-timeline__label">
                    сообщения одного ни разу не шли сразу за сообщениями другого
                  </span>
                </>
              ) : (
                <>
                  <span className="pair-timeline__value">{timeline.median_switch_seconds} с</span>
                  <span className="pair-timeline__label">медианная пауза, когда один сменяет другого</span>
                </>
              )}
              {hasClue('switch_time') && <span className={`badge ${tone}`}>улика</span>}
            </div>
          </div>
        </section>
      </div>

      <section className="card pair-section">
        <h3>Похожие сообщения</h3>
        {examples.length === 0 ? (
          <p className="muted">Примеров нет.</p>
        ) : (
          <ul className="pair-examples">
            {examples.map((ex, i) => (
              <li key={i} className="pair-example">
                <span className="badge accent">{featureLabel(ex.feature)}</span>
                <div className="pair-example__cols">
                  {[
                    { author: a, msg: ex.a, side: 'a' },
                    { author: b, msg: ex.b, side: 'b' },
                  ].map(({ author, msg, side }) => (
                    <figure key={side} className={`pair-message pair-message--${side}`}>
                      <figcaption>
                        <Avatar name={author.name} size="sm" className="pair-message__avatar" />
                        <strong>{author.name}</strong>{' '}
                        <time dateTime={msg.sent_at}>{formatDateTime(msg.sent_at)}</time>
                      </figcaption>
                      <blockquote>{msg.text}</blockquote>
                    </figure>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
