import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError, type CheckRequest, type CheckResult, type Signal } from '../api'
import Avatar from '../components/Avatar'
import Breadcrumbs from '../components/Breadcrumbs'
import Clawd from '../components/Clawd'
import ErrorNotice from '../components/ErrorNotice'
import Loading from '../components/Loading'
import HighlightedText from '../components/HighlightedText'
import ScoreMeter from '../components/ScoreMeter'
import { useApiData } from '../hooks/useApiData'
import { localToUtcIso } from '../utils/format'
import './CheckPage.css'

/** Лимит бэкенда на длину каждого текста — в кодовых точках, как в контракте */
const MAX_CHECK_TEXT = 4096
/** Сколько сообщений бэкенд принимает в серии */
const MIN_SERIES = 2
const MAX_SERIES = 20

type Mode = 'single' | 'series'
type Draft = { id: number; text: string; sentAt: string }
type Checked = { texts: string[]; series: boolean; result: CheckResult }
type Tone = 'good' | 'warn' | 'danger' | 'neutral'

/** Цвет результата по вердикту; неизвестный вердикт — как «не уверены» */
const TONES: Record<string, Tone> = {
  match: 'good',
  uncertain: 'warn',
  mismatch: 'danger',
  not_enough_data: 'neutral',
}
const toneOf = (verdict: string): Tone => (Object.hasOwn(TONES, verdict) ? TONES[verdict] : 'warn')

/** Длина в кодовых точках: эмодзи — один символ, а не два, как в text.length */
const textLength = (text: string) => Array.from(text).length
const tooLong = (text: string) => textLength(text) > MAX_CHECK_TEXT

/** «1 сообщение», «2 сообщения», «5 сообщений» */
function messagesWord(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'сообщение'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'сообщения'
  return 'сообщений'
}

/** Улики одного сообщения серии: у остальных убираем место в тексте, индексы сохраняются */
const signalsOf = (signals: Signal[], message: number): Signal[] =>
  signals.map((s) => (s.message === message ? s : { ...s, span: null }))

const Icon = {
  search: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  ),
  bubble: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  stack: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="4" width="12" height="6" rx="2" />
      <rect x="8" y="14" width="12" height="6" rx="2" />
    </svg>
  ),
  passport: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8.5 16h7" />
    </svg>
  ),
  sparkle: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c.4 4.6 2.9 7.1 7.5 7.5-4.6.4-7.1 2.9-7.5 7.5-.4-4.6-2.9-7.1-7.5-7.5 4.6-.4 7.1-2.9 7.5-7.5Z" />
      <path d="M19 15.5c.2 2 1.2 3 3 3.2-1.8.2-2.8 1.2-3 3.3-.2-2.1-1.2-3.1-3-3.3 1.8-.2 2.8-1.2 3-3.2Z" />
    </svg>
  ),
  question: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M9.2 9.2a2.9 2.9 0 1 1 4.3 2.5c-.9.5-1.5 1.2-1.5 2.2v.6" />
      <circle cx="12" cy="18" r="0.6" fill="currentColor" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  warn: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  ),
}

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
  const [active, setActive] = useState<number[]>([])

  if (chat.kind === 'loading') return <Loading>Загружаем чат…</Loading>
  if (chat.kind === 'error') return <ErrorNotice error={chat.error} standalone />
  const author = chat.data.authors.find((a) => a.id === authorId)
  if (!author) return <ErrorNotice error={new ApiError(404, 'not_found', 'Нет такого автора')} standalone />

  const chatPath = `/chats/${encodeURIComponent(chatId)}`
  const profilePath = `${chatPath}/authors/${encodeURIComponent(author.id)}`
  const series = mode === 'series'
  // Пустые поля серии не отправляем — бэкенд их не примет
  const filled = drafts.filter((d) => d.text.trim() !== '')
  // Длинный текст не обрезаем молча (maxLength), а не даём отправить и подсвечиваем счётчик
  const overLimit = series ? filled.some((d) => tooLong(d.text)) : tooLong(text)
  const canSubmit = (series ? filled.length >= MIN_SERIES : text.trim() !== '') && !overLimit && !pending

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
      setActive([])
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
      <label className="check-time">
        <span className="check-time__label">
          Когда отправлено <span className="muted">({hint})</span>
        </span>
        <input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} />
        {utc && <span className="check-time__utc mono">В UTC: {utc.slice(0, 16).replace('T', ' ')}</span>}
      </label>
    )
  }

  const result = checked?.result
  const tone = result ? toneOf(result.verdict) : 'neutral'
  const ranked = result
    ? result.signals.map((s, i) => ({ s, i })).sort((a, b) => b.s.weight - a.s.weight)
    : []
  const llmMissing =
    result !== undefined && result.verdict !== 'not_enough_data' && result.explanation === null

  return (
    <div className="page check-page">
      <Breadcrumbs
        items={[{ label: 'Чат', to: chatPath }, { label: author.name, to: profilePath }, { label: 'Проверка' }]}
      />

      <div className="page-header">
        <div>
          <h2 className="check-title">
            Это точно <span className="check-title__name">{author.name}</span>?
          </h2>
          <p className="page-subtitle">
            Вставьте подозрительное сообщение — сравним его с тем, как {author.name} обычно пишет.
          </p>
        </div>
        <div className="page-actions">
          <Link className="button" to={profilePath}>
            {Icon.passport}
            Паспорт почерка
          </Link>
        </div>
      </div>

      <div className="check-layout">
        <div className="check-side">
          <form className="card check-composer" onSubmit={submit}>
            <fieldset className="check-seg">
              <legend className="visually-hidden">Что проверяем</legend>
              <label className={`check-seg__opt${!series ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="mode"
                  className="visually-hidden"
                  checked={!series}
                  onChange={() => switchMode('single')}
                />
                {Icon.bubble}
                Одно сообщение
              </label>
              <label className={`check-seg__opt${series ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="mode"
                  className="visually-hidden"
                  checked={series}
                  onChange={() => switchMode('series')}
                />
                {Icon.stack}
                Несколько подряд
              </label>
            </fieldset>

            <div className="check-chat">
              <div className="check-chat__top" aria-hidden="true">
                <Avatar name={author.name} size="sm" />
                <span className="check-chat__who">
                  <strong>{author.name}</strong>
                  <span>{series ? 'несколько сообщений подряд' : 'входящее сообщение'}</span>
                </span>
              </div>

              {series ? (
                <div className="check-chat__body">
                  <p className="check-chat__hint">
                    Сообщения, которые «{author.name}» прислал подряд, — по серии оценка точнее: короткие реплики
                    по отдельности почти ничего не говорят. От {MIN_SERIES} до {MAX_SERIES}, пустые поля не
                    отправляются.
                  </p>
                  <ol className="check-series">
                    {drafts.map((d, i) => (
                      <li key={d.id} className="check-series__item">
                        <label className="check-field">
                          <span className="check-field__label">Сообщение {i + 1}</span>
                          <textarea
                            className="check-bubble"
                            value={d.text}
                            rows={2}
                            placeholder={i === 0 ? 'Привет!' : i === 1 ? 'срочно займи 5000 на карту' : ''}
                            onChange={(e) => updateDraft(d.id, { text: e.target.value })}
                            onKeyDown={onKeyDown}
                          />
                        </label>
                        <div className="check-series__foot">
                          {timeField(d.sentAt, (v) => updateDraft(d.id, { sentAt: v }), 'необязательно')}
                          {tooLong(d.text) && (
                            <span className="check-counter mono is-over">
                              {textLength(d.text)} / {MAX_CHECK_TEXT}
                            </span>
                          )}
                          {drafts.length > MIN_SERIES && (
                            <button
                              type="button"
                              className="button ghost small check-series__remove"
                              aria-label={`Убрать сообщение ${i + 1}`}
                              onClick={() => setDrafts(drafts.filter((x) => x.id !== d.id))}
                            >
                              {Icon.close}
                              Убрать
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="check-series__add">
                    <button
                      type="button"
                      className="button small"
                      disabled={drafts.length >= MAX_SERIES}
                      onClick={addDraft}
                    >
                      + Добавить сообщение
                    </button>
                    <span className="mono small muted">
                      {filled.length} / {MAX_SERIES}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="check-chat__body">
                  <label className="check-field">
                    <span className="check-field__label">Сообщение</span>
                    <textarea
                      className="check-bubble check-bubble--big"
                      value={text}
                      rows={4}
                      placeholder="Привет! срочно займи 5000 на карту, потом объясню"
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={onKeyDown}
                    />
                  </label>
                  <div className="check-chat__foot">
                    {timeField(sentAt, setSentAt)}
                    <span className={`check-counter mono${overLimit ? ' is-over' : ''}`} aria-hidden={!overLimit}>
                      {textLength(text)} / {MAX_CHECK_TEXT}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="check-submit">
              <button type="submit" className="button primary check-submit__button" disabled={!canSubmit}>
                {pending ? <span className="spinner spinner--on-accent" aria-hidden="true" /> : Icon.search}
                {pending ? 'Проверяем…' : 'Проверить'}
              </button>
              <span className="check-kbd">
                <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd>
              </span>
            </div>
          </form>

          {overLimit && (
            <div className="notice warn" role="alert">
              {Icon.warn}
              <div>
                <strong>Слишком длинное сообщение</strong>
                Каждое сообщение — не длиннее {MAX_CHECK_TEXT} символов, иначе бэкенд его не примет.
              </div>
            </div>
          )}

          {error !== null && <ErrorNotice error={error} />}

          {!author.enough_data && (
            <div className="notice warn">
              {Icon.warn}
              <div>
                <strong>У автора мало собственных сообщений</strong>
                {author.name} написал(а) в этом чате всего {author.message_count}{' '}
                {messagesWord(author.message_count)} — уверенного вердикта может не получиться.
              </div>
            </div>
          )}
        </div>

        <div className="check-main" aria-live="polite" aria-busy={pending}>
          {checked && result ? (
            <div className={`check-results check-results--${tone}${pending ? ' is-stale' : ''}`}>
              <div className="check-verdict">
                <div className="check-verdict__meta">
                  <span className="eyebrow">Вердикт</span>
                  <span className="mono small muted">
                    {checked.series ? 'серия · ' : ''}
                    {checked.texts.length} {messagesWord(checked.texts.length)}
                  </span>
                </div>
                {/* key — чтобы анимация вердикта проигрывалась на каждой новой проверке */}
                <ScoreMeter
                  key={`${checked.texts.join('\n')}|${result.verdict}|${result.score}`}
                  verdict={result.verdict}
                  score={result.score}
                  reason={result.reason}
                />
                <p className="check-verdict__note">
                  Это вероятность по стилю письма, а не доказательство. Сомневаетесь — задайте вопрос, ответ на
                  который знает только настоящий собеседник.
                </p>
              </div>

              {result.verdict !== 'not_enough_data' && (
                <section className="card check-card">
                  <h3 className="card-title check-card__title">{checked.series ? 'Сообщения' : 'Сообщение'}</h3>
                  {checked.series ? (
                    <ol className="check-msgs">
                      {checked.texts.map((t, i) => (
                        <li key={i} className="check-msg">
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
                    <div className="check-msg">
                      <HighlightedText
                        text={checked.texts[0]}
                        signals={result.signals}
                        active={active}
                        onActivate={setActive}
                      />
                    </div>
                  )}
                  {ranked.some(({ s }) => s.span !== null) && (
                    <p className="check-card__hint">Наведите на подсвеченный фрагмент — покажем, какая это улика.</p>
                  )}
                </section>
              )}

              {ranked.length > 0 && (
                <section className="check-evidence-block">
                  <div className="section-head check-section-head">
                    <h3>Улики</h3>
                    <span className="badge neutral mono">{ranked.length}</span>
                    <span className="spacer" />
                    <span className="small muted">по вкладу в вердикт</span>
                  </div>
                  <ol className="check-evidence-list">
                    {ranked.map(({ s, i }, rank) => {
                      const pct = Math.round(s.weight * 100)
                      return (
                        <li
                          key={i}
                          className={`check-evidence${active.includes(i) ? ' signal--active' : ''}`}
                          // С клавиатуры улику тоже можно выбрать — её фрагмент подсветится в тексте
                          tabIndex={0}
                          onPointerEnter={() => setActive([i])}
                          onPointerLeave={() => setActive([])}
                          onFocus={() => setActive([i])}
                          onBlur={() => setActive([])}
                        >
                          <div className="check-evidence__head">
                            <span className="check-evidence__rank mono" aria-hidden="true">
                              {rank + 1}
                            </span>
                            <strong className="check-evidence__label">{s.label}</strong>
                            {s.span === null && <span className="badge neutral">не в тексте</span>}
                            {checked.series && s.span !== null && typeof s.message === 'number' && (
                              <span className="badge accent">сообщение {s.message + 1}</span>
                            )}
                            <span className="check-evidence__weight">
                              <span className="check-evidence__pct mono">{pct}%</span>
                              <span className="check-evidence__cap">вклад</span>
                            </span>
                          </div>
                          <div className="check-evidence__bar" aria-hidden="true">
                            <span style={{ width: `${Math.max(3, Math.min(100, pct))}%` }} />
                          </div>
                          <dl className="check-evidence__facts">
                            {s.expected !== null && (
                              <div>
                                <dt>Обычно</dt>
                                <dd>{s.expected}</dd>
                              </div>
                            )}
                            <div className="check-evidence__observed">
                              <dt>В сообщении</dt>
                              <dd>{s.observed}</dd>
                            </div>
                          </dl>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              )}

              {result.explanation !== null && (
                <section className="card check-llm">
                  <div className="check-llm__head">
                    <span className="check-llm__icon">{Icon.sparkle}</span>
                    <h3>Объяснение</h3>
                    <span className="badge accent">Claude</span>
                  </div>
                  <p className="check-llm__text">{result.explanation}</p>
                  <p className="check-llm__note">Текст написан Claude по уликам выше — это пояснение, а не доказательство.</p>
                </section>
              )}

              {result.challenge_question !== null && (
                <section className="card check-question">
                  <span className="check-question__icon">{Icon.question}</span>
                  <div className="check-question__body">
                    <h3>Задайте контрольный вопрос</h3>
                    <p className="check-question__text">{result.challenge_question}</p>
                    <p className="check-question__note">
                      На него сможет ответить только тот, кто помнит вашу переписку.
                    </p>
                  </div>
                </section>
              )}

              {llmMissing && (
                <div className="notice warn">
                  {Icon.warn}
                  <div>
                    <strong>Без объяснения от Claude</strong>
                    Claude API не настроен на сервере или не ответил. Вердикт и улики посчитаны без него.
                  </div>
                </div>
              )}
            </div>
          ) : pending ? (
            <div className="card check-skeleton" role="status">
              <span className="check-skeleton__label">
                <span className="spinner" aria-hidden="true" />
                Сравниваем с почерком {author.name}…
              </span>
              <span className="skeleton check-skeleton__banner" />
              <span className="skeleton check-skeleton__line" />
              <span className="skeleton check-skeleton__line check-skeleton__line--short" />
              <span className="skeleton check-skeleton__card" />
              <span className="skeleton check-skeleton__card" />
            </div>
          ) : (
            <div className="empty check-empty">
              <Clawd pose="magnifier" scale={0.4} />
              <h3>Здесь появится вердикт</h3>
              <p>
                Сравним сообщение с паспортом почерка: регистр, пунктуацию, любимые слова, эмодзи и час отправки.
              </p>
              <ol className="check-empty__steps">
                <li>
                  <span className="mono">1</span>Вставьте текст, который вызвал сомнения
                </li>
                <li>
                  <span className="mono">2</span>Нажмите «Проверить»
                </li>
                <li>
                  <span className="mono">3</span>Наведите на улику — найдём её в тексте
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
