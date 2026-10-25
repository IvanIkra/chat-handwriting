import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import ActiveHoursChart from '../components/ActiveHoursChart'
import ErrorNotice from '../components/ErrorNotice'
import Loading from '../components/Loading'
import { useApiData } from '../hooks/useApiData'
import { messagesWord, plural } from '../utils/format'

export default function ProfilePage() {
  const { chatId = '', authorId = '' } = useParams()
  const state = useApiData(`${chatId}/${authorId}`, () => api.getProfile(chatId, authorId))

  if (state.kind === 'loading') return <Loading>Собираем паспорт почерка…</Loading>
  if (state.kind === 'error') return <ErrorNotice error={state.error} standalone />

  const profile = state.data
  const chatPath = `/chats/${encodeURIComponent(chatId)}`

  return (
    <section>
      <Link to={chatPath}>← К чату</Link>
      <div className="profile-head">
        <div>
          <h2>Паспорт почерка: {profile.name}</h2>
          <p className="muted">
            {plural(profile.message_count, messagesWord)} · в среднем{' '}
            {Math.round(profile.avg_length)} символов в сообщении
          </p>
        </div>
        <Link className="button" to={`${chatPath}/authors/${encodeURIComponent(profile.author_id)}/check`}>
          Проверить сообщение
        </Link>
      </div>

      {!profile.enough_data && (
        <p className="notice">
          У автора мало собственных сообщений (пересланные и отправленные через ботов не
          считаются) — паспорт может быть неточным, и в поиске двойников он не участвует.
        </p>
      )}

      <h3>Черты почерка</h3>
      {profile.traits.length === 0 ? (
        <p className="muted">Ярких черт не нашлось.</p>
      ) : (
        <ul className="traits">
          {profile.traits.map((trait) => (
            <li key={trait.key} className="trait">
              <strong>{trait.label}</strong>
              <div className="trait__bar" aria-hidden="true">
                <div style={{ width: `${Math.round(trait.value * 100)}%` }} />
              </div>
              <span className="muted">{trait.description}</span>
            </li>
          ))}
        </ul>
      )}

      <ActiveHoursChart hours={profile.active_hours} />

      <div className="profile-lists">
        <div>
          <h3>Любимые слова</h3>
          {profile.top_words.length === 0 ? (
            <p className="muted">Нет</p>
          ) : (
            <ul className="chips">
              {profile.top_words.map((word) => (
                <li key={word}>{word}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3>Эмодзи и смайлы</h3>
          {profile.emoji.length === 0 ? (
            <p className="muted">Не использует</p>
          ) : (
            <ul className="chips">
              {profile.emoji.map((e) => (
                <li key={e.char}>
                  <span className="chips__char">{e.char}</span>{' '}
                  <span className="muted">×{e.count.toLocaleString('ru-RU')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
