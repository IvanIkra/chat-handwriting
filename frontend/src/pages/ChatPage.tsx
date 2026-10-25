import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import Avatar from '../components/Avatar'
import ErrorNotice from '../components/ErrorNotice'
import Loading from '../components/Loading'
import { useApiData } from '../hooks/useApiData'
import { formatDate, messagesWord, plural } from '../utils/format'
import { rememberChat } from '../utils/recentChats'
import './ChatPage.css'

const membersWord: [string, string, string] = ['участник', 'участника', 'участников']
const daysWord: [string, string, string] = ['день', 'дня', 'дней']

/** Только слово из plural(): число показываем отдельно, крупно */
const wordFor = (n: number, forms: [string, string, string]) => plural(n, forms).replace(/^[\d\s]+/, '')

function TwinsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" />
      <circle cx="16" cy="8" r="3.2" />
      <path d="M2.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
      <path d="M13.2 15.1c.8-.6 1.8-.9 2.8-.9 2.7 0 4.9 1.8 5.5 4.8" />
    </svg>
  )
}

function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="7.5" height="16" rx="2" />
      <rect x="13.5" y="4" width="7.5" height="16" rx="2" />
      <path d="M6 9h2M6 12.5h2M16.5 9h2M16.5 12.5h2" />
    </svg>
  )
}

export default function ChatPage() {
  const { chatId = '' } = useParams()
  const state = useApiData(chatId, () => api.getChat(chatId))

  useEffect(() => {
    if (state.kind === 'ok') rememberChat(state.data)
  }, [state])

  if (state.kind === 'loading') return <Loading>Загружаем чат…</Loading>
  if (state.kind === 'error') return <ErrorNotice error={state.error} standalone />

  const chat = state.data
  const base = `/chats/${encodeURIComponent(chat.id)}`
  const authors = [...chat.authors].sort((a, b) => b.message_count - a.message_count)
  const isGroup = chat.kind === 'group'
  const spanMs = Date.parse(chat.period.to) - Date.parse(chat.period.from)
  const days = Number.isFinite(spanMs) ? Math.max(1, Math.round(spanMs / 86_400_000)) : null

  return (
    <div className="page chat-page">
      <header className="card chat-hero">
        <div className="chat-hero__title">
          <p className="eyebrow">Чат</p>
          <h2>{chat.title}</h2>
          <p className="page-subtitle muted">
            {isGroup ? 'Групповой чат' : 'Личная переписка'} · {formatDate(chat.period.from)} —{' '}
            {formatDate(chat.period.to)}
          </p>
        </div>
        <div className="chat-hero__stats">
          <div className="stat">
            <span className="stat-value">{authors.length.toLocaleString('ru-RU')}</span>
            <span className="stat-label">{wordFor(authors.length, membersWord)}</span>
          </div>
          <div className="stat">
            <span className="stat-value">{chat.message_count.toLocaleString('ru-RU')}</span>
            <span className="stat-label">{wordFor(chat.message_count, messagesWord)}</span>
          </div>
          {days !== null && (
            <div className="stat">
              <span className="stat-value">{days.toLocaleString('ru-RU')}</span>
              <span className="stat-label">{wordFor(days, daysWord)} переписки</span>
            </div>
          )}
        </div>
      </header>

      <div className={`chat-modes${isGroup ? '' : ' chat-modes--single'}`}>
        {isGroup && (
          <div className="card chat-mode chat-mode--twins">
            <span className="chat-mode__icon">
              <TwinsIcon />
            </span>
            <div className="chat-mode__body">
              <p className="eyebrow">Режим</p>
              <h3>Двойники в чате</h3>
              <p className="muted">
                Не пишет ли один человек с нескольких аккаунтов? Сравним почерк всех участников
                попарно и покажем подозрительные пары.
              </p>
            </div>
            <Link className="button primary" to={`${base}/twins`}>
              Найти двойников
            </Link>
          </div>
        )}
        <div className="card chat-mode">
          <span className="chat-mode__icon">
            <CompareIcon />
          </span>
          <div className="chat-mode__body">
            <p className="eyebrow">Режим</p>
            <h3>Два чата — один человек?</h3>
            <p className="muted">Загрузите вторую переписку — сопоставим почерк авторов из обоих чатов.</p>
          </div>
          <Link className="button" to={`/compare?a=${encodeURIComponent(chat.id)}`}>
            Сравнить с другим чатом
          </Link>
        </div>
      </div>

      <section className="chat-authors-section" aria-labelledby="chat-authors-title">
        <div className="section-head">
          <h3 id="chat-authors-title">Авторы</h3>
          <span className="muted small">по числу сообщений · откройте паспорт или проверьте сообщение</span>
        </div>
        <ul className="chat-authors">
          {authors.map((author) => {
            const authorBase = `${base}/authors/${encodeURIComponent(author.id)}`
            const share = chat.message_count > 0 ? Math.min(1, author.message_count / chat.message_count) : 0
            return (
              <li key={author.id} className="card interactive chat-author">
                <div className="chat-author__head">
                  <Avatar name={author.name} />
                  <div className="chat-author__who">
                    <strong className="chat-author__name">{author.name}</strong>
                    <span className="chat-author__count muted">{plural(author.message_count, messagesWord)}</span>
                  </div>
                  {!author.enough_data && (
                    <span
                      className="badge warn above-link chat-author__badge"
                      title="Мало собственных сообщений для надёжного анализа: пересланные и через ботов не считаются"
                    >
                      мало данных
                    </span>
                  )}
                </div>
                <div className="chat-author__share" aria-hidden="true">
                  <div className="chat-author__share-track">
                    <div className="chat-author__share-fill" style={{ width: `${Math.round(share * 100)}%` }} />
                  </div>
                  <span className="chat-author__share-value">{Math.round(share * 100)}%</span>
                </div>
                <div className="chat-author__actions">
                  <Link className="button small ghost stretched-link chat-author__passport" to={authorBase}>
                    Паспорт почерка
                  </Link>
                  <Link className="button small primary above-link" to={`${authorBase}/check`}>
                    Проверить сообщение
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
