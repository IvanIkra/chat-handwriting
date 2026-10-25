import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { TwinPair } from '../api/types'
import ErrorNotice from '../components/ErrorNotice'
import Loading from '../components/Loading'
import TwinsGraph from '../components/TwinsGraph'
import { useApiData } from '../hooks/useApiData'
import { plural, twinVerdictLabel } from '../utils/format'

const authorsWord: [string, string, string] = ['авторе', 'авторах', 'авторах']

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

  return (
    <section>
      <Link to={chatPath}>← К чату</Link>
      <h2>Двойники</h2>

      <div className="card validation">
        {validation ? (
          <>
            <strong className="validation__rate">{Math.round(validation.self_match_rate * 100)}%</strong>
            <p>
              Самопроверка: делим сообщения каждого автора пополам — настолько часто половины
              оказываются самой похожей парой. Проверено на {plural(validation.authors_tested, authorsWord)}.
            </p>
          </>
        ) : (
          <p className="muted">Самопроверки нет: для неё нужно хотя бы три автора с достаточным количеством сообщений.</p>
        )}
      </div>

      {skipped.length > 0 && (
        <p className="muted">
          Не участвуют — мало собственных сообщений: {skipped.map((a) => a.name).join(', ')}.
        </p>
      )}

      {pairs.length === 0 ? (
        <p className="notice">
          Сравнивать некого: нужно хотя бы два автора с достаточным количеством собственных сообщений.
        </p>
      ) : (
        <>
          <TwinsGraph authors={authors} pairs={pairs} pairPath={pairPath} />

          <h3>Пары</h3>
          <ul className="twin-pairs">
            {pairs.map((pair) => (
              <li key={`${pair.a}-${pair.b}`} className="twin-pair">
                <div className="twin-pair__head">
                  <Link to={pairPath(pair)}>
                    {names.get(pair.a) ?? pair.a} и {names.get(pair.b) ?? pair.b}
                  </Link>
                  <span className="twin-pair__score">{Math.round(pair.score * 100)}%</span>
                  <span className={`twin-verdict twin-verdict--${pair.verdict}`}>{twinVerdictLabel[pair.verdict]}</span>
                </div>
                {pair.signals.length > 0 && (
                  <ul className="twin-pair__signals muted">
                    {[...pair.signals]
                      .sort((x, y) => y.weight - x.weight)
                      .slice(0, 2)
                      .map((signal) => (
                        <li key={signal.feature}>
                          {signal.label}: {signal.observed}
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
