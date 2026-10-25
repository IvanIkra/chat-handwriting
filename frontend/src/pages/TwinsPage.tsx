import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { Signal, TwinPair } from '../api/types'
import Avatar from '../components/Avatar'
import Breadcrumbs from '../components/Breadcrumbs'
import ErrorNotice from '../components/ErrorNotice'
import Loading from '../components/Loading'
import TwinsGraph from '../components/TwinsGraph'
import { useApiData } from '../hooks/useApiData'
import { plural, twinVerdictLabel } from '../utils/format'
import './TwinsPage.css'

const authorsWord: [string, string, string] = ['авторе', 'авторах', 'авторах']

/** Улики о ритме переписки, а не о самом тексте */
const TIME_FEATURES = new Set(['no_overlap', 'switch_time', 'active_hours'])

const badgeTone: Record<string, string> = {
  likely_same: 'danger',
  possible: 'warn',
  different: 'neutral',
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TextIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M3 4h10M3 8h10M3 12h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function SignalChip({ signal }: { signal: Signal }) {
  const time = TIME_FEATURES.has(signal.feature)
  return (
    <li className={`chip twins-clue${time ? ' twins-clue--time' : ''}`} title={signal.observed}>
      {time ? <ClockIcon /> : <TextIcon />}
      {signal.label}
    </li>
  )
}

export default function TwinsPage() {
  const { chatId = '' } = useParams()
  const state = useApiData(chatId, () => api.getTwins(chatId))

  if (state.kind === 'loading') return <Loading>Сравниваем почерки участников…</Loading>
  if (state.kind === 'error') return <ErrorNotice error={state.error} standalone />

  const { authors, validation } = state.data
  const pairs = [...state.data.pairs].sort((x, y) => y.score - x.score)
  const chatPath = `/chats/${encodeURIComponent(chatId)}`
  const pairPath = (pair: TwinPair) =>
    `${chatPath}/twins/${encodeURIComponent(pair.a)}/${encodeURIComponent(pair.b)}`
  const names = new Map(authors.map((a) => [a.id, a.name]))
  const skipped = authors.filter((a) => !a.enough_data)
  const compared = authors.length - skipped.length
  const likely = pairs.filter((p) => p.verdict === 'likely_same').length
  const possible = pairs.filter((p) => p.verdict === 'possible').length
  const suspiciousTone = likely > 0 ? 'danger' : possible > 0 ? 'warn' : 'good'

  return (
    <div className="page twins-page">
      <Breadcrumbs items={[{ label: 'Чат', to: chatPath }, { label: 'Двойники' }]} />

      <header className="page-header">
        <div>
          <p className="eyebrow">Поиск двойников</p>
          <h2>Это точно разные люди?</h2>
          <p className="page-subtitle">
            Сравниваем почерк каждого участника с каждым: редкие словечки, пунктуацию, ритм ответов. Если два
            аккаунта пишут как один человек и никогда не появляются одновременно — стоит присмотреться.
          </p>
        </div>
      </header>

      <div className="twins-overview">
        <div className="card twins-stat">
          <span className="stat-label">Участников в сравнении</span>
          <span className="stat-value">{compared}</span>
          <span className="small muted">из {authors.length} в чате</span>
        </div>
        <div className="card twins-stat">
          <span className="stat-label">Пар проверено</span>
          <span className="stat-value">{pairs.length}</span>
          <span className="small muted">каждый с каждым</span>
        </div>
        <div className={`card twins-stat twins-stat--${suspiciousTone}`}>
          <span className="stat-label">Подозрительных пар</span>
          <span className="stat-value">{likely + possible}</span>
          <span className="small muted">
            {likely > 0 ? `${likely} — вероятно, один человек` : possible > 0 ? 'есть сомнительные' : 'всё чисто'}
          </span>
        </div>
      </div>

      <div className={`card twins-validation${validation ? '' : ' twins-validation--none'}`}>
        <div className="twins-validation__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
            <path
              d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <path
              d="M8.5 12l2.5 2.5 4.5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        {validation ? (
          <>
            <div className="twins-validation__rate">
              <strong className="stat-value">{Math.round(validation.self_match_rate * 100)}%</strong>
              <span className="stat-label">точность метода</span>
            </div>
            <p className="twins-validation__text">
              Самопроверка: делим сообщения каждого автора пополам — настолько часто половины
              оказываются самой похожей парой. Проверено на {plural(validation.authors_tested, authorsWord)}.
            </p>
          </>
        ) : (
          <p className="twins-validation__text muted">
            Самопроверки нет: для неё нужно хотя бы три автора с достаточным количеством сообщений.
          </p>
        )}
      </div>

      {skipped.length > 0 && (
        <p className="notice info twins-skipped">
          Не участвуют — мало собственных сообщений: {skipped.map((a) => a.name).join(', ')}.
        </p>
      )}

      {pairs.length === 0 ? (
        <div className="empty twins-empty">
          <span className="twins-empty__icon" aria-hidden="true">
            ⇄
          </span>
          <strong>Пока не с кем сравнивать</strong>
          <p className="muted">
            Сравнивать некого: нужно хотя бы два автора с достаточным количеством собственных сообщений.
          </p>
        </div>
      ) : (
        <>
          <section className="card twins-map" aria-labelledby="twins-map-title">
            <div className="twins-section-head">
              <div>
                <p className="eyebrow">Карта сходства</p>
                <h3 id="twins-map-title" className="card-title">
                  Кто на кого похож
                </h3>
              </div>
            </div>
            <TwinsGraph authors={authors} pairs={pairs} pairPath={pairPath} />
          </section>

          <section className="twins-ranking">
            <p className="eyebrow">Рейтинг · самые похожие сверху</p>
            <h3 className="section-title">Пары</h3>
            <ol className="twins-pairs">
              {pairs.map((pair, index) => {
                const aName = names.get(pair.a) ?? pair.a
                const bName = names.get(pair.b) ?? pair.b
                const percent = Math.round(pair.score * 100)
                const signals = [...pair.signals].sort((x, y) => y.weight - x.weight)
                const top = signals.slice(0, 2)
                const rest = signals.slice(2)
                return (
                  <li
                    key={`${pair.a}-${pair.b}`}
                    className={`card interactive twins-pair twins-pair--${pair.verdict}`}
                  >
                    <span className="twins-pair__rank" aria-hidden="true">
                      {index + 1}
                    </span>

                    <div className="twins-pair__faces" aria-hidden="true">
                      <Avatar name={aName} ring />
                      <span className="twins-pair__swap">⇄</span>
                      <Avatar name={bName} ring />
                    </div>

                    <div className="twins-pair__main">
                      <Link className="stretched-link twins-pair__link" to={pairPath(pair)}>
                        {aName} и {bName}
                      </Link>
                      {top.length > 0 ? (
                        <ul className="twins-pair__signals">
                          {top.map((signal) => (
                            <li key={signal.feature}>
                              {signal.label}: {signal.observed}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="twins-pair__none">Явных общих черт почерка нет</p>
                      )}
                      {rest.length > 0 && (
                        <ul className="above-link twins-pair__clues" aria-label="Ещё улики">
                          {rest.map((signal) => (
                            <SignalChip key={signal.feature} signal={signal} />
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="twins-pair__score">
                      <span className="twins-pair__percent">{percent}%</span>
                      <span className={`badge ${badgeTone[pair.verdict] ?? 'neutral'}`}>
                        {twinVerdictLabel[pair.verdict]}
                      </span>
                      <span className="twins-pair__bar" aria-hidden="true">
                        <span style={{ width: `${percent}%` }} />
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        </>
      )}
    </div>
  )
}
