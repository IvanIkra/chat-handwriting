import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError, type CheckResult } from '../api'
import ErrorNotice from '../components/ErrorNotice'
import Loading from '../components/Loading'
import HighlightedText from '../components/HighlightedText'
import ScoreMeter from '../components/ScoreMeter'
import { useApiData } from '../hooks/useApiData'
import { localToUtcIso } from '../utils/format'

type Checked = { text: string; result: CheckResult }

export default function CheckPage() {
  const { chatId = '', authorId = '' } = useParams()
  const chat = useApiData(chatId, () => api.getChat(chatId))

  const [text, setText] = useState('')
  const [sentAt, setSentAt] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  // Подсветка привязана к тексту на момент проверки, а не к тому, что сейчас в поле
  const [checked, setChecked] = useState<Checked | null>(null)
  const [active, setActive] = useState<number | null>(null)

  if (chat.kind === 'loading') return <Loading>Загружаем чат…</Loading>
  if (chat.kind === 'error') return <ErrorNotice error={chat.error} standalone />
  const author = chat.data.authors.find((a) => a.id === authorId)
  if (!author) return <ErrorNotice error={new ApiError(404, 'not_found', 'Нет такого автора')} standalone />

  const chatPath = `/chats/${encodeURIComponent(chatId)}`
  const canSubmit = text.trim() !== '' && !pending

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!canSubmit) return
    const snapshot = text
    setPending(true)
    setError(null)
    try {
      const result = await api.checkMessage(chatId, authorId, {
        text: snapshot,
        sent_at: localToUtcIso(sentAt),
      })
      setChecked({ text: snapshot, result })
      setActive(null)
    } catch (err) {
      setError(err)
    } finally {
      setPending(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit()
  }

  const utc = localToUtcIso(sentAt)
  const result = checked?.result
  const ranked = result
    ? result.signals.map((s, i) => ({ s, i })).sort((a, b) => b.s.weight - a.s.weight)
    : []

  return (
    <section>
      <Link to={chatPath}>← К чату</Link>
      <h2>Это точно {author.name}?</h2>
      <p className="muted">
        Вставьте подозрительное сообщение — сравним его с тем, как {author.name} обычно пишет.{' '}
        <Link to={`${chatPath}/authors/${encodeURIComponent(author.id)}`}>Паспорт почерка</Link>
      </p>

      <form className="check-form" onSubmit={submit}>
        <label>
          Сообщение
          <textarea
            value={text}
            rows={4}
            placeholder="Привет! срочно займи 5000 на карту, потом объясню"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </label>
        <label>
          Когда отправлено <span className="muted">(необязательно, ваше местное время)</span>
          <input type="datetime-local" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
          {utc && <span className="muted">В UTC: {utc.slice(0, 16).replace('T', ' ')}</span>}
        </label>
        <button type="submit" className="button" disabled={!canSubmit}>
          {pending && <span className="spinner spinner--on-accent" aria-hidden="true" />}
          {pending ? 'Проверяем…' : 'Проверить'}
        </button>
      </form>

      {error !== null && <ErrorNotice error={error} />}

      {checked && result && (
        <div className="check-result" aria-live="polite">
          {/* key — чтобы анимация вердикта проигрывалась на каждой новой проверке */}
          <ScoreMeter
            key={`${checked.text}|${result.verdict}|${result.score}`}
            verdict={result.verdict}
            score={result.score}
          />

          {result.verdict !== 'not_enough_data' && (
            <>
              <h3>Сообщение</h3>
              <HighlightedText
                text={checked.text}
                signals={result.signals}
                active={active}
                onActivate={setActive}
              />
            </>
          )}

          {ranked.length > 0 && (
            <>
              <h3>Улики</h3>
              <ul className="signals">
                {ranked.map(({ s, i }) => (
                  <li
                    key={i}
                    className={`signal${active === i ? ' signal--active' : ''}`}
                    onPointerEnter={() => setActive(i)}
                    onPointerLeave={() => setActive(null)}
                  >
                    <div className="signal__head">
                      <strong>{s.label}</strong>
                      {s.span === null && <span className="badge badge--neutral">не в тексте</span>}
                      <span className="signal__weight" aria-label={`вес ${Math.round(s.weight * 100)}%`}>
                        <span style={{ width: `${Math.round(s.weight * 100)}%` }} />
                      </span>
                    </div>
                    <dl>
                      {s.expected !== null && (
                        <>
                          <dt>Обычно</dt>
                          <dd>{s.expected}</dd>
                        </>
                      )}
                      <dt>В сообщении</dt>
                      <dd>{s.observed}</dd>
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          )}

          {result.explanation !== null && (
            <div className="llm-block">
              <h3>Объяснение</h3>
              <p>{result.explanation}</p>
            </div>
          )}

          {result.challenge_question !== null && (
            <div className="llm-block llm-block--question">
              <h3>Задайте контрольный вопрос</h3>
              <p>{result.challenge_question}</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
