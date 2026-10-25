import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Chat } from '../api'
import ErrorNotice from '../components/ErrorNotice'
import { formatDate, messagesWord, plural } from '../utils/format'

type ChatState =
  | { kind: 'loading' }
  | { kind: 'ok'; chat: Chat }
  | { kind: 'error'; error: unknown }

export default function ChatPage() {
  const { chatId = '' } = useParams()
  // Ответ помнит свой chatId: при переходе на другой чат старый не показывается
  const [loaded, setLoaded] = useState<{ chatId: string; state: ChatState } | null>(null)
  const state: ChatState = loaded?.chatId === chatId ? loaded.state : { kind: 'loading' }

  useEffect(() => {
    let cancelled = false
    const done = (next: ChatState) => !cancelled && setLoaded({ chatId, state: next })
    api
      .getChat(chatId)
      .then((chat) => done({ kind: 'ok', chat }))
      .catch((error: unknown) => done({ kind: 'error', error }))
    return () => {
      cancelled = true
    }
  }, [chatId])

  if (state.kind === 'loading') return <p>Загружаем чат…</p>
  if (state.kind === 'error') return <ErrorNotice error={state.error} />

  const { chat } = state
  const base = `/chats/${encodeURIComponent(chat.id)}`
  const authors = [...chat.authors].sort((a, b) => b.message_count - a.message_count)

  return (
    <section>
      <div className="card">
        <h2>{chat.title}</h2>
        <p className="muted">
          {chat.kind === 'group' ? 'Групповой чат' : 'Личная переписка'} ·{' '}
          {plural(chat.message_count, messagesWord)} · {formatDate(chat.period.from)} —{' '}
          {formatDate(chat.period.to)}
        </p>
        {chat.kind === 'group' && (
          <Link className="button" to={`${base}/twins`}>
            Найти двойников
          </Link>
        )}
      </div>

      <h3>Авторы</h3>
      <ul className="authors">
        {authors.map((author) => {
          const authorBase = `${base}/authors/${encodeURIComponent(author.id)}`
          return (
            <li key={author.id} className="author">
              <div>
                <strong>{author.name}</strong>{' '}
                <span className="muted">{plural(author.message_count, messagesWord)}</span>
                {!author.enough_data && (
                  <span className="badge" title="Меньше сообщений, чем нужно для надёжного анализа">
                    мало данных
                  </span>
                )}
              </div>
              <div className="actions">
                <Link to={authorBase}>Паспорт почерка</Link>
                <Link className="button" to={`${authorBase}/check`}>
                  Проверить сообщение
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
