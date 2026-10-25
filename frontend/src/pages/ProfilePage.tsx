import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import ActiveHoursChart from '../components/ActiveHoursChart'
import Avatar from '../components/Avatar'
import Breadcrumbs from '../components/Breadcrumbs'
import ErrorNotice from '../components/ErrorNotice'
import Loading from '../components/Loading'
import { useApiData } from '../hooks/useApiData'
import './ProfilePage.css'

function TraitMarker() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </svg>
  )
}

export default function ProfilePage() {
  const { chatId = '', authorId = '' } = useParams()
  const state = useApiData(`${chatId}/${authorId}`, () => api.getProfile(chatId, authorId))

  if (state.kind === 'loading') return <Loading>Собираем паспорт почерка…</Loading>
  if (state.kind === 'error') return <ErrorNotice error={state.error} standalone />

  const profile = state.data
  const chatPath = `/chats/${encodeURIComponent(chatId)}`
  const checkPath = `${chatPath}/authors/${encodeURIComponent(profile.author_id)}/check`
  const hours = Array.isArray(profile.active_hours) ? profile.active_hours : []
  const peakHour = hours.length > 0 ? hours.indexOf(Math.max(...hours)) : -1

  return (
    <div className="page profile-page">
      <Breadcrumbs items={[{ label: 'Чат', to: chatPath }, { label: profile.name }]} />

      <article className="card profile-passport">
        <div className="profile-passport__band">
          <span className="eyebrow">Стилометрический документ</span>
          <span className="profile-passport__serial">№ {profile.author_id}</span>
        </div>

        <div className="profile-passport__main">
          <Avatar name={profile.name} size="xl" square className="profile-avatar" />
          <div className="profile-passport__who">
            <h2 className="profile-passport__title">
              <span className="profile-passport__kind">Паспорт почерка:</span>{' '}
              <span className="profile-passport__name">{profile.name}</span>
            </h2>
            <p className="muted profile-passport__lead">
              Как этот человек пишет: привычки, словечки и время активности. По этому образцу
              проверяем, мог ли он написать сообщение.
            </p>
          </div>
          <Link className="button primary large profile-cta" to={checkPath}>
            <CheckIcon />
            Проверить сообщение
          </Link>
        </div>

        <dl className="profile-fields">
          <div className="profile-field">
            <dt>Сообщений</dt>
            <dd>{profile.message_count.toLocaleString('ru-RU')}</dd>
          </div>
          <div className="profile-field">
            <dt>Средняя длина</dt>
            <dd>
              {Math.round(profile.avg_length)}
              <span className="profile-field__unit"> симв.</span>
            </dd>
          </div>
          <div className="profile-field">
            <dt>Ярких черт</dt>
            <dd>{profile.traits.length}</dd>
          </div>
          <div className="profile-field">
            <dt>Пик активности</dt>
            <dd>
              {peakHour >= 0 ? `${String(peakHour).padStart(2, '0')}:00` : '—'}
              {peakHour >= 0 && <span className="profile-field__unit"> UTC</span>}
            </dd>
          </div>
        </dl>
      </article>

      {!profile.enough_data && (
        <p className="notice warn">
          У автора мало собственных сообщений (пересланные и отправленные через ботов не
          считаются) — паспорт может быть неточным, и в поиске двойников он не участвует.
        </p>
      )}

      <section className="profile-section" aria-labelledby="profile-traits-title">
        <div className="section-head">
          <h3 id="profile-traits-title">Черты почерка</h3>
          <span className="muted small">чем выше полоса, тем устойчивее привычка</span>
        </div>
        {profile.traits.length === 0 ? (
          <div className="empty">
            <p className="muted">Ярких черт не нашлось.</p>
          </div>
        ) : (
          <ul className="profile-traits">
            {profile.traits.map((trait) => {
              const percent = Math.max(0, Math.min(100, Math.round(trait.value * 100)))
              return (
                <li key={trait.key} className="card profile-trait">
                  <span className="profile-trait__marker">
                    <TraitMarker />
                  </span>
                  <div className="profile-trait__body">
                    <div className="profile-trait__head">
                      <strong>{trait.label}</strong>
                      <span className="profile-trait__value" aria-hidden="true">
                        {percent}
                        <small>%</small>
                      </span>
                    </div>
                    <div className="profile-trait__bar" aria-hidden="true">
                      <div style={{ width: `${percent}%` }} />
                    </div>
                    <span className="muted profile-trait__desc">{trait.description}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card profile-hours" aria-label="Часы активности">
        <ActiveHoursChart hours={hours} />
      </section>

      <div className="profile-lists">
        <section className="card profile-list" aria-labelledby="profile-words-title">
          <p className="eyebrow">Словарь</p>
          <h3 id="profile-words-title">Любимые слова</h3>
          {profile.top_words.length === 0 ? (
            <p className="muted">Нет</p>
          ) : (
            <ul className="profile-chips">
              {profile.top_words.map((word) => (
                <li key={word} className="chip">
                  {word}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card profile-list" aria-labelledby="profile-emoji-title">
          <p className="eyebrow">Интонация</p>
          <h3 id="profile-emoji-title">Эмодзи и смайлы</h3>
          {profile.emoji.length === 0 ? (
            <p className="muted">Не использует</p>
          ) : (
            <ul className="profile-chips">
              {profile.emoji.map((e) => (
                <li key={e.char} className="chip profile-emoji">
                  <span className="profile-emoji__char">{e.char}</span>
                  <span className="profile-emoji__count">×{e.count.toLocaleString('ru-RU')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card profile-cta-card">
        <div>
          <h3>Пришло подозрительное сообщение?</h3>
          <p className="muted">Вставьте текст — сравним с паспортом и покажем улики: что совпало, а что нет.</p>
        </div>
        <Link className="button primary" to={checkPath}>
          Проверить на подлинность
        </Link>
      </section>
    </div>
  )
}
