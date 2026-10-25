import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Chat, TwinVerdict } from '../api/types'
import Clawd from '../components/Clawd'
import ErrorNotice from '../components/ErrorNotice'
import Loading from '../components/Loading'
import { useApiData } from '../hooks/useApiData'
import { messagesWord, plural, twinVerdictLabel } from '../utils/format'
import { loadRecentChats, rememberChat, type RecentChat } from '../utils/recentChats'
import './ComparePage.css'

export default function ComparePage() {
  const [params, setParams] = useSearchParams()
  const a = params.get('a') ?? ''
  const b = params.get('b') ?? ''
  // Общий для выбора и результата: чаты из ссылки запоминаются после сравнения и сразу получают название
  const [recent, setRecent] = useState<RecentChat[]>(loadRecentChats)
  const refreshRecent = () => setRecent(loadRecentChats())
  const ready = Boolean(a && b && a !== b)

  return (
    <div className="page compare-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Режим · сравнение переписок</p>
          <h2>Сравнение двух чатов</h2>
          <p className="page-subtitle">
            Кто из авторов одного чата, скорее всего, тот же человек, что и автор другого: например, Саша из
            одной переписки и Alex из другой.
          </p>
        </div>
        <Clawd pose="pointing" scale={0.42} className="page-header__clawd" />
      </header>
      {/* key — чтобы выбор сбрасывался при переходе по ссылке с другими чатами */}
      <ChatPicker
        key={`${a}/${b}`}
        a={a}
        b={b}
        chats={recent}
        onUploaded={refreshRecent}
        onCompare={(next) => setParams(next)}
      />
      {ready ? <CompareResult a={a} b={b} onLoaded={refreshRecent} /> : <CompareEmpty />}
    </div>
  )
}

function SwapIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M7 4 3 8l4 4" />
      <path d="M3 8h14" />
      <path d="m17 20 4-4-4-4" />
      <path d="M21 16H7" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  )
}

/** Пустое состояние до запуска: два «пузыря» переписки и лупа между ними */
function CompareEmpty() {
  return (
    <div className="empty compare-empty">
      <svg className="compare-empty__art" viewBox="0 0 160 96" width="160" height="96" aria-hidden="true"
        focusable="false">
        <rect x="4" y="14" width="60" height="40" rx="12" className="compare-empty__bubble" />
        <path d="M18 54v12l12-12" className="compare-empty__bubble" />
        <rect x="16" y="26" width="34" height="5" rx="2.5" className="compare-empty__line" />
        <rect x="16" y="37" width="22" height="5" rx="2.5" className="compare-empty__line" />
        <rect x="96" y="30" width="60" height="40" rx="12" className="compare-empty__bubble compare-empty__bubble--b" />
        <path d="M142 70v12l-12-12" className="compare-empty__bubble compare-empty__bubble--b" />
        <rect x="108" y="42" width="34" height="5" rx="2.5" className="compare-empty__line" />
        <rect x="108" y="53" width="22" height="5" rx="2.5" className="compare-empty__line" />
        <circle cx="80" cy="44" r="13" className="compare-empty__lens" />
        <path d="m89 53 8 8" className="compare-empty__lens" />
      </svg>
      <h3>Выберите два чата</h3>
      <p className="muted">
        Почерк каждого автора первого чата сопоставим с каждым автором второго и покажем самые похожие пары
        — с процентом сходства и уликами.
      </p>
    </div>
  )
}

type PickerProps = {
  a: string
  b: string
  chats: RecentChat[]
  onUploaded: () => void
  onCompare: (next: { a: string; b: string }) => void
}

type PickerOption = Omit<RecentChat, 'kind'> & { kind?: RecentChat['kind'] }

const kindLabel = (kind: RecentChat['kind']) => (kind === 'group' ? 'группа' : 'личный')

function ChatPicker(props: PickerProps) {
  const [a, setA] = useState(props.a)
  const [b, setB] = useState(props.b)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const idA = useId()
  const idB = useId()

  // Чат из ссылки мог быть открыт не в этом браузере — показываем его хотя бы по id, пока не сравнили
  const options: PickerOption[] = [...props.chats]
  for (const id of [props.a, props.b]) {
    if (id && !options.some((c) => c.id === id)) options.push({ id, title: id })
  }

  async function upload(file: File) {
    setError(null)
    setUploading(true)
    try {
      const chat = await api.uploadChat(file)
      rememberChat(chat)
      props.onUploaded()
      if (!a) setA(chat.id)
      else setB(chat.id)
    } catch (err) {
      setError(err)
    } finally {
      setUploading(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (a && b && a !== b) props.onCompare({ a, b })
  }

  const same = Boolean(a && a === b)

  const slot = (letter: 'A' | 'B', id: string, label: string, value: string, onChange: (id: string) => void) => {
    const selected = options.find((c) => c.id === value)
    return (
      <div className={`compare-slot${value ? ' compare-slot--filled' : ''}${same ? ' compare-slot--clash' : ''}`}>
        <div className="compare-slot__head">
          <span className="compare-slot__letter" aria-hidden="true">
            {letter}
          </span>
          <label className="compare-slot__label" htmlFor={id}>
            {label}
          </label>
        </div>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">— выберите чат —</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
              {c.kind && ` (${kindLabel(c.kind)})`}
            </option>
          ))}
        </select>
        <div className="compare-slot__meta">
          {selected ? (
            <>
              {selected.kind && <span className="badge neutral">{kindLabel(selected.kind)}</span>}
              <span className="mono small muted compare-slot__id">{selected.id}</span>
            </>
          ) : (
            <span className="small muted">Чат не выбран</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <form className="card compare-picker" onSubmit={submit}>
      <div className="compare-slots">
        {slot('A', idA, 'Первый чат', a, setA)}
        <div className="compare-slots__swap" aria-hidden="true">
          <SwapIcon />
        </div>
        {slot('B', idB, 'Второй чат', b, setB)}
      </div>

      {same && <p className="notice warn">Выберите два разных чата.</p>}

      <div className="compare-picker__footer">
        <label className={`compare-upload${uploading ? ' compare-upload--busy' : ''}`}>
          <input
            className="visually-hidden compare-upload__input"
            type="file"
            accept=".json,application/json"
            disabled={uploading}
            aria-label="Загрузить ещё один экспорт"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void upload(file)
            }}
          />
          <span className="compare-upload__icon" aria-hidden="true">
            {uploading ? <span className="spinner spinner--sm" /> : <UploadIcon />}
          </span>
          <span className="compare-upload__text">
            <span className="compare-upload__title">{uploading ? 'Загружаем…' : 'Загрузить ещё один экспорт'}</span>
            <span className="small muted">result.json из Telegram Desktop</span>
          </span>
        </label>
        <button type="submit" className="button primary compare-picker__submit" disabled={!a || !b || a === b}>
          Сравнить
        </button>
      </div>

      {options.length < 2 && !uploading && (
        <p className="small muted compare-picker__hint">
          Здесь появляются чаты, открытые в этом браузере. Чтобы сравнить, загрузите второй экспорт.
        </p>
      )}
      {error !== null && <ErrorNotice error={error} showReuploadLink={false} />}
    </form>
  )
}

const verdictTone: Record<TwinVerdict, string> = {
  likely_same: 'danger',
  possible: 'warn',
  different: 'neutral',
}

function CompareResult({ a, b, onLoaded }: { a: string; b: string; onLoaded: () => void }) {
  const state = useApiData(`${a}/${b}`, () => api.compare(a, b))

  useEffect(() => {
    if (state.kind !== 'ok') return
    rememberChat(state.data.b)
    rememberChat(state.data.a)
    onLoaded()
    // onLoaded пересоздаётся на каждом рендере, запоминаем по пришедшему ответу
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  if (state.kind === 'loading') return <Loading>Сравниваем почерки…</Loading>
  if (state.kind === 'error') return <ErrorNotice error={state.error} standalone />

  const { shared } = state.data
  const chatA = state.data.a
  const chatB = state.data.b
  const pairs = [...state.data.pairs].sort((x, y) => y.score - x.score)
  const authorName = (chat: Chat, id: string) => chat.authors.find((x) => x.id === id)?.name ?? id
  const sharedNames = shared.map((id) => authorName(chatA, id))
  const skipped = [chatA, chatB].flatMap((chat) =>
    chat.authors.filter((x) => !x.enough_data && !shared.includes(x.id)).map((x) => x.name),
  )
  const likely = pairs.filter((p) => p.verdict === 'likely_same').length
  const profilePath = (chat: Chat, id: string) =>
    `/chats/${encodeURIComponent(chat.id)}/authors/${encodeURIComponent(id)}`

  const person = (letter: 'A' | 'B', chat: Chat, id: string) => (
    <div className="compare-person">
      <span className={`compare-person__letter${letter === 'B' ? ' compare-person__letter--b' : ''}`} aria-hidden="true">
        {letter}
      </span>
      <div className="compare-person__text">
        <Link className="compare-person__name" to={profilePath(chat, id)}>
          {authorName(chat, id)}
        </Link>
        <span className="small muted compare-person__chat">из «{chat.title}»</span>
      </div>
    </div>
  )

  return (
    <section className="compare-result" aria-live="polite">
      <div className="card compare-summary">
        <p className="eyebrow">Результат сравнения</p>
        <h3 className="compare-summary__title">
          «{chatA.title}» и «{chatB.title}»
        </h3>
        <div className="compare-summary__chats">
          <div className="compare-summary__chat">
            <span className="compare-person__letter" aria-hidden="true">
              A
            </span>
            <div>
              <strong>{chatA.title}</strong>
              <span className="mono small muted">{plural(chatA.message_count, messagesWord)}</span>
            </div>
          </div>
          <div className="compare-summary__chat">
            <span className="compare-person__letter compare-person__letter--b" aria-hidden="true">
              B
            </span>
            <div>
              <strong>{chatB.title}</strong>
              <span className="mono small muted">{plural(chatB.message_count, messagesWord)}</span>
            </div>
          </div>
        </div>
        <div className="compare-summary__stats">
          <div className="stat">
            <span className="stat-value">{pairs.length}</span>
            <span className="stat-label">пар сопоставлено</span>
          </div>
          <div className="stat">
            <span className={`stat-value${likely > 0 ? ' compare-summary__alarm' : ''}`}>{likely}</span>
            <span className="stat-label">вероятно, один человек</span>
          </div>
          <div className="stat">
            <span className="stat-value">{shared.length}</span>
            <span className="stat-label">общих аккаунтов</span>
          </div>
        </div>
      </div>

      {sharedNames.length > 0 && (
        <div className="notice info compare-note">
          <InfoIcon />
          <p>
            {sharedNames.join(', ')} — {sharedNames.length === 1 ? 'аккаунт есть' : 'аккаунты есть'} в обоих
            чатах, это и так один человек (обычно — вы сами), в сравнение не{' '}
            {sharedNames.length === 1 ? 'входит' : 'входят'}.
          </p>
        </div>
      )}
      {skipped.length > 0 && (
        <p className="small muted compare-skipped">
          Не участвуют — мало собственных сообщений: {skipped.join(', ')}.
        </p>
      )}

      {pairs.length === 0 ? (
        <div className="empty compare-nobody">
          <p>
            Сравнивать некого: в каждом чате нужен хотя бы один автор с достаточным количеством собственных
            сообщений, которого нет во втором чате.
          </p>
        </div>
      ) : (
        <>
          <div className="section-head compare-pairs-head">
            <h3>Самые похожие пары</h3>
            <span className="small muted">по убыванию сходства почерка</span>
          </div>
          <ol className="compare-pairs">
            {pairs.map((pair, index) => {
              const percent = Math.round(pair.score * 100)
              return (
                <li key={`${pair.a}-${pair.b}`} className={`card compare-pair compare-pair--${pair.verdict}`}>
                  <div className="compare-pair__top">
                    <span className="mono small muted compare-pair__rank" aria-hidden="true">
                      #{index + 1}
                    </span>
                    <div className="compare-pair__people">
                      {person('A', chatA, pair.a)}
                      <span className="compare-pair__swap" aria-hidden="true">
                        <SwapIcon />
                      </span>
                      {person('B', chatB, pair.b)}
                    </div>
                    <div className="compare-pair__score">
                      <span className="compare-pair__value">{percent}%</span>
                      <span className={`badge ${verdictTone[pair.verdict]}`}>{twinVerdictLabel[pair.verdict]}</span>
                    </div>
                  </div>
                  <div className="compare-pair__meter" aria-hidden="true">
                    <span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
                  </div>
                  {pair.signals.length > 0 && (
                    <div className="compare-pair__evidence">
                      <p className="eyebrow">Улики</p>
                      <ul className="compare-pair__signals">
                        {[...pair.signals]
                          .sort((x, y) => y.weight - x.weight)
                          .map((signal) => (
                            <li key={signal.feature} className="compare-signal">
                              <span className="compare-signal__label">{signal.label}:</span>{' '}
                              <span className="compare-signal__value">{signal.observed}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}
