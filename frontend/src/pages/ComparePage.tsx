import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Chat } from '../api/types'
import ErrorNotice from '../components/ErrorNotice'
import { useApiData } from '../hooks/useApiData'
import { messagesWord, plural, twinVerdictLabel } from '../utils/format'
import { loadRecentChats, rememberChat, type RecentChat } from '../utils/recentChats'

export default function ComparePage() {
  const [params, setParams] = useSearchParams()
  const a = params.get('a') ?? ''
  const b = params.get('b') ?? ''

  return (
    <section>
      <h2>Сравнение двух чатов</h2>
      <p className="muted">
        Кто из авторов одного чата, скорее всего, тот же человек, что и автор другого: например, Саша из
        одной переписки и Alex из другой.
      </p>
      {/* key — чтобы выбор сбрасывался при переходе по ссылке с другими чатами */}
      <ChatPicker key={`${a}/${b}`} a={a} b={b} onCompare={(next) => setParams(next)} />
      {a && b && a !== b && <CompareResult a={a} b={b} />}
    </section>
  )
}

type PickerProps = {
  a: string
  b: string
  onCompare: (next: { a: string; b: string }) => void
}

function ChatPicker(props: PickerProps) {
  const [chats, setChats] = useState<RecentChat[]>(loadRecentChats)
  const [a, setA] = useState(props.a)
  const [b, setB] = useState(props.b)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  // Чат из ссылки мог быть открыт не в этом браузере — показываем его хотя бы по id
  const options = [...chats]
  for (const id of [props.a, props.b]) {
    if (id && !options.some((c) => c.id === id)) options.push({ id, title: id, kind: 'personal' })
  }

  async function upload(file: File) {
    setError(null)
    setUploading(true)
    try {
      const chat = await api.uploadChat(file)
      rememberChat(chat)
      setChats(loadRecentChats())
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

  const select = (label: string, value: string, onChange: (id: string) => void) => (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— выберите чат —</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title} ({c.kind === 'group' ? 'группа' : 'личный'})
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <form className="compare-form card" onSubmit={submit}>
      <div className="compare-form__selects">
        {select('Первый чат', a, setA)}
        {select('Второй чат', b, setB)}
      </div>
      {a && a === b && <p className="notice">Выберите два разных чата.</p>}
      <div className="actions">
        <button type="submit" className="button" disabled={!a || !b || a === b}>
          Сравнить
        </button>
        <label className="compare-form__upload">
          <input
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
          <span>{uploading ? 'Загружаем…' : 'Загрузить ещё один экспорт'}</span>
        </label>
      </div>
      {options.length < 2 && !uploading && (
        <p className="muted">
          Здесь появляются чаты, открытые в этом браузере. Чтобы сравнить, загрузите второй экспорт.
        </p>
      )}
      {error !== null && <ErrorNotice error={error} showReuploadLink={false} />}
    </form>
  )
}

function CompareResult({ a, b }: { a: string; b: string }) {
  const state = useApiData(`${a}/${b}`, () => api.compare(a, b))

  if (state.kind === 'loading') return <p>Сравниваем почерки…</p>
  if (state.kind === 'error') return <ErrorNotice error={state.error} />

  const { shared } = state.data
  const chatA = state.data.a
  const chatB = state.data.b
  const pairs = [...state.data.pairs].sort((x, y) => y.score - x.score)
  const authorName = (chat: Chat, id: string) => chat.authors.find((x) => x.id === id)?.name ?? id
  const sharedNames = shared.map((id) => authorName(chatA, id))
  const skipped = [chatA, chatB].flatMap((chat) =>
    chat.authors.filter((x) => !x.enough_data && !shared.includes(x.id)).map((x) => x.name),
  )

  return (
    <div className="compare-result" aria-live="polite">
      <h3>
        «{chatA.title}» и «{chatB.title}»
      </h3>
      <p className="muted">
        {plural(chatA.message_count, messagesWord)} и {plural(chatB.message_count, messagesWord)}
      </p>

      {sharedNames.length > 0 && (
        <p className="muted">
          {sharedNames.join(', ')} — {sharedNames.length === 1 ? 'аккаунт есть' : 'аккаунты есть'} в обоих
          чатах, это и так один человек, в сравнение не {sharedNames.length === 1 ? 'входит' : 'входят'}.
        </p>
      )}
      {skipped.length > 0 && (
        <p className="muted">Не участвуют — мало собственных сообщений: {skipped.join(', ')}.</p>
      )}

      {pairs.length === 0 ? (
        <p className="notice">
          Сравнивать некого: в каждом чате нужен хотя бы один автор с достаточным количеством собственных
          сообщений, которого нет во втором чате.
        </p>
      ) : (
        <ul className="twin-pairs">
          {pairs.map((pair) => (
            <li key={`${pair.a}-${pair.b}`} className="twin-pair">
              <div className="twin-pair__head">
                <strong>
                  {authorName(chatA, pair.a)} <span className="muted">из «{chatA.title}»</span> и{' '}
                  {authorName(chatB, pair.b)} <span className="muted">из «{chatB.title}»</span>
                </strong>
                <span className="twin-pair__score">{Math.round(pair.score * 100)}%</span>
                <span className={`twin-verdict twin-verdict--${pair.verdict}`}>
                  {twinVerdictLabel[pair.verdict]}
                </span>
              </div>
              {pair.signals.length > 0 && (
                <ul className="twin-pair__signals muted">
                  {[...pair.signals]
                    .sort((x, y) => y.weight - x.weight)
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
      )}
    </div>
  )
}
