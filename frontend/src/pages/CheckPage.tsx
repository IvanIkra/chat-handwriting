import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError, type CheckRequest, type CheckResult, type Signal } from '../api'
import ErrorNotice from '../components/ErrorNotice'
import Loading from '../components/Loading'
import HighlightedText from '../components/HighlightedText'
import ScoreMeter from '../components/ScoreMeter'
import { useApiData } from '../hooks/useApiData'
import { localToUtcIso } from '../utils/format'

/** Лимит бэкенда на длину проверяемого текста */
const MAX_CHECK_TEXT = 4096
/** Сколько сообщений бэкенд принимает в серии */
const MIN_SERIES = 2
const MAX_SERIES = 20

type Mode = 'single' | 'series'
type Draft = { id: number; text: string; sentAt: string }
type Checked = { texts: string[]; series: boolean; result: CheckResult }

/** Улики одного сообщения серии: у остальных убираем место в тексте, индексы сохраняются */
const signalsOf = (signals: Signal[], message: number): Signal[] =>
  signals.map((s) => (s.message === message ? s : { ...s, span: null }))

export default function CheckPage() {
  const { chatId = '', authorId = '' } = useParams()
  const chat = useApiData(chatId, () => api.getChat(chatId))

  const [mode, setMode] = useState<Mode>('single')
  const [text, setText] = useState('')
  const [sentAt, setSentAt] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([
    { id: 0, text: '', sentAt: '' },
    { id: 1, text: '', sentAt: '' },
  ])
  const nextId = useRef(2)
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
  const series = mode === 'series'
  // Пустые поля серии не отправляем — бэкенд их не примет
  const filled = drafts.filter((d) => d.text.trim() !== '')
  const canSubmit = (series ? filled.length >= MIN_SERIES : text.trim() !== '') && !pending

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!canSubmit) return
    const texts = series ? filled.map((d) => d.text) : [text]
    const body: CheckRequest = series
      ? { messages: filled.map((d) => ({ text: d.text, sent_at: localToUtcIso(d.sentAt) })) }
      : { text, sent_at: localToUtcIso(sentAt) }
    setPending(true)
    setError(null)
    try {
      const result = await api.checkMessage(chatId, authorId, body)
      setChecked({ texts, series, result })
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

  function updateDraft(id: number, patch: Partial<Draft>) {
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function addDraft() {
    // Серия пишется подряд — время по умолчанию как у предыдущего сообщения
    const last = drafts[drafts.length - 1]
    setDrafts([...drafts, { id: nextId.current++, text: '', sentAt: last?.sentAt ?? '' }])
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  const timeField = (value: string, onChange: (value: string) => void, hint = 'необязательно, ваше местное время') => {
    const utc = localToUtcIso(value)
    return (
      <label>
        <span>
          Когда отправлено <span className="muted">({hint})</span>
        </span>
        <input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} />
        {utc && <span className="muted">В UTC: {utc.slice(0, 16).replace('T', ' ')}</span>}
      </label>
    )
  }

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
        <fieldset className="check-mode">
          <legend className="visually-hidden">Что проверяем</legend>
          <label>
            <input type="radio" name="mode" checked={!series} onChange={() => switchMode('single')} />
            Одно сообщение
          </label>
          <label>
            <input type="radio" name="mode" checked={series} onChange={() => switchMode('series')} />
            Несколько подряд
          </label>
        </fieldset>

        {series ? (
          <>
            <p className="muted">
              Сообщения, которые «{author.name}» прислал подряд, — по серии оценка точнее: короткие реплики по
              отдельности почти ничего не говорят. От {MIN_SERIES} до {MAX_SERIES}, пустые поля не отправляются.
            </p>
            <ol className="series">
              {drafts.map((d, i) => (
                <li key={d.id} className="series__item">
                  <label>
                    Сообщение {i + 1}
                    <textarea
                      value={d.text}
                      rows={2}
                      maxLength={MAX_CHECK_TEXT}
                      placeholder={i === 0 ? 'Привет!' : i === 1 ? 'срочно займи 5000 на карту' : ''}
                      onChange={(e) => updateDraft(d.id, { text: e.target.value })}
                      onKeyDown={onKeyDown}
                    />
                  </label>
                  {timeField(d.sentAt, (v) => updateDraft(d.id, { sentAt: v }), 'необязательно')}
                  {drafts.length > MIN_SERIES && (
                    <button
                      type="button"
                      className="link-button series__remove"
                      aria-label={`Убрать сообщение ${i + 1}`}
                      onClick={() => setDrafts(drafts.filter((x) => x.id !== d.id))}
                    >
                      Убрать
                    </button>
                  )}
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="link-button"
              disabled={drafts.length >= MAX_SERIES}
              onClick={addDraft}
            >
              + Добавить сообщение
            </button>
          </>
        ) : (
          <>
            <label>
              Сообщение
              <textarea
                value={text}
                rows={4}
                maxLength={MAX_CHECK_TEXT}
                placeholder="Привет! срочно займи 5000 на карту, потом объясню"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </label>
            {timeField(sentAt, setSentAt)}
          </>
        )}

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
            key={`${checked.texts.join('\n')}|${result.verdict}|${result.score}`}
            verdict={result.verdict}
            score={result.score}
          />

          {result.verdict !== 'not_enough_data' && (
            <>
              <h3>{checked.series ? 'Сообщения' : 'Сообщение'}</h3>
              {checked.series ? (
                <ol className="series-result">
                  {checked.texts.map((t, i) => (
                    <li key={i}>
                      <HighlightedText
                        text={t}
                        signals={signalsOf(result.signals, i)}
                        active={active}
                        onActivate={setActive}
                      />
                    </li>
                  ))}
                </ol>
              ) : (
                <HighlightedText
                  text={checked.texts[0]}
                  signals={result.signals}
                  active={active}
                  onActivate={setActive}
                />
              )}
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
                      {checked.series && s.span !== null && typeof s.message === 'number' && (
                        <span className="badge badge--neutral">сообщение {s.message + 1}</span>
                      )}
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
