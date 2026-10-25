import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import ErrorNotice from '../components/ErrorNotice'
import { useApiData } from '../hooks/useApiData'
import { formatDate, messagesWord, plural } from '../utils/format'
import { rememberChat } from '../utils/recentChats'

export default function ChatPage() {
  const { chatId = '' } = useParams()
  const state = useApiData(chatId, () => api.getChat(chatId))

  useEffect(() => {
    if (state.kind === 'ok') rememberChat(state.data)
  }, [state])

  if (state.kind === 'loading') return <p>Загружаем чат…</p>
  if (state.kind === 'error') return <ErrorNotice error={state.error} />

  const chat = state.data
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
        <div className="actions">
          {chat.kind === 'group' && (
            <Link className="button" to={`${base}/twins`}>
              Найти двойников
            </Link>
          )}
          <Link to={`/compare?a=${encodeURIComponent(chat.id)}`}>Сравнить с другим чатом</Link>
        </div>
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
                  <span className="badge" title="Мало собственных сообщений для надёжного анализа: пересланные и через ботов не считаются">
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
