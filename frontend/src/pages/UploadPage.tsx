import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import Avatar from '../components/Avatar'
import Clawd from '../components/Clawd'
import ErrorNotice from '../components/ErrorNotice'
import { useApiData } from '../hooks/useApiData'
import { MAX_UPLOAD_BYTES, tooLargeMessage } from '../utils/errors'
import { loadRecentChats } from '../utils/recentChats'
import './UploadPage.css'

/** Размер файла для подписи в зоне загрузки */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / (1024 * 1024)).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`
}

const MODES = [
  {
    key: 'check',
    title: 'Проверка сообщения',
    text: 'Новое сообщение против паспорта почерка автора: похоже или нет — и почему.',
    tag: 'Личный чат',
  },
  {
    key: 'twins',
    title: 'Двойники в чате',
    text: 'Какие аккаунты группы, скорее всего, ведёт один и тот же человек.',
    tag: 'Групповой чат',
  },
] as const

function ModeIcon({ mode }: { mode: 'check' | 'twins' | 'compare' }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (mode === 'check')
    return (
      <svg {...common}>
        <path d="M4 5h16v10H9l-5 4z" />
        <path d="m9 10 2 2 4-4" />
      </svg>
    )
  if (mode === 'twins')
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3.2" />
        <circle cx="15.5" cy="8" r="3.2" />
        <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
        <path d="M14.8 14.5c2.6.1 4.5 1.7 5.1 4.5" />
      </svg>
    )
  return (
    <svg {...common}>
      <rect x="3" y="4" width="7.5" height="16" rx="2" />
      <rect x="13.5" y="4" width="7.5" height="16" rx="2" />
      <path d="M6 9h1.5M6 12h1.5M16.5 9h1.5M16.5 12h1.5" />
    </svg>
  )
}

export default function UploadPage() {
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [dragOver, setDragOver] = useState(false)
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null)
  const [recent] = useState(loadRecentChats)
  const health = useApiData('health', () => api.getHealth())
  const llm = health.kind === 'ok' && health.data.llm
  // Пока файл разбирается, пользователь может уйти — тогда не уводим его обратно на чат
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function upload(file: File) {
    setError(null)
    // Не гоняем по сети то, что бэкенд всё равно отклонит
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(new ApiError(413, 'file_too_large', tooLargeMessage))
      return
    }
    setUploading(true)
    try {
      const chat = await api.uploadChat(file)
      if (mounted.current) navigate(`/chats/${encodeURIComponent(chat.id)}`)
    } catch (err) {
      if (!mounted.current) return
      setError(err)
      setUploading(false)
    }
  }

  function pick(file: File) {
    setPicked({ name: file.name, size: file.size })
    void upload(file)
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && !uploading) pick(file)
  }

  const dropClass = [
    'dropzone upload-drop',
    dragOver && 'dropzone--over',
    uploading && 'upload-drop--busy',
    error !== null && 'upload-drop--failed',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="page upload">
      <section className="upload-hero">
        <div className="upload-hero__text">
          <Clawd pose="waving" scale={0.36} className="upload-hero__clawd" />
          <h2 className="upload-hero__title">Кто на самом деле написал сообщение</h2>
          <p className="upload-hero__lead">
            Аккаунт можно взломать, а один человек может писать с нескольких. Поэтому сверяем не аккаунт, а
            почерк: слова, пунктуацию, эмодзи и часы, когда человек обычно пишет.
          </p>
        </div>

        <figure className="upload-specimen" aria-hidden="true">
          <div className="upload-specimen__bubble">
            <span className="upload-specimen__from">Саша · 23:47</span>
            <p>
              Привет<mark className="upload-specimen__hl--bad">!</mark>{' '}
              <mark className="upload-specimen__hl--bad">Срочно</mark> займи 5000, потом объясню
              <mark className="upload-specimen__hl--bad">.</mark>
            </p>
          </div>
          <div className="upload-specimen__verdict">
            <div>
              <span className="upload-specimen__label">Похожесть на почерк</span>
              <span className="upload-specimen__score">12%</span>
            </div>
            <span className="badge danger">не похоже</span>
          </div>
          <div className="upload-specimen__meter">
            <span />
          </div>
          <ul className="upload-specimen__clues">
            <li>
              <i className="upload-specimen__dot upload-specimen__dot--bad" />
              Заглавные и точки — обычно пишет без них
            </li>
            <li>
              <i className="upload-specimen__dot upload-specimen__dot--bad" />
              «Срочно» ни разу не встречалось в переписке
            </li>
            <li>
              <i className="upload-specimen__dot upload-specimen__dot--good" />
              Время — в обычные часы активности
            </li>
          </ul>
        </figure>
      </section>

      <section className="card upload-card" aria-labelledby="upload-title">
        <Clawd pose="lurking" scale={0.5} className="upload-card__lurker" />
        <div className="upload-card__head">
          <h2 id="upload-title" className="upload-card__title">
            Загрузка экспорта
          </h2>
          <p className="muted upload-card__intro">
            Подойдёт личный чат (проверка автора) или групповой (поиск двойников).
          </p>
        </div>

        <label
          className={dropClass}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            className="visually-hidden"
            accept=".json,application/json"
            disabled={uploading}
            aria-label="Файл экспорта result.json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) pick(file)
            }}
          />
          <span className="upload-drop__icon" aria-hidden="true">
            {uploading ? (
              <span className="spinner spinner--lg" />
            ) : (
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 3v5h5" />
                <path d="M12 17v-6M9.5 13.5 12 11l2.5 2.5" />
              </svg>
            )}
          </span>
          {uploading ? (
            <span className="upload-drop__body">
              <span className="upload-drop__title">Загружаем и разбираем переписку…</span>
              {picked && (
                <span className="upload-drop__file">
                  {picked.name} · {formatSize(picked.size)}
                </span>
              )}
            </span>
          ) : (
            <span className="upload-drop__body">
              <span className="upload-drop__title">
                {dragOver ? 'Отпустите файл' : 'Выберите result.json'}
              </span>
              <span className="muted">или перетащите его сюда · JSON до 50 МБ</span>
              {picked && error !== null && (
                <span className="upload-drop__file">
                  {picked.name} · {formatSize(picked.size)} — выберите другой файл
                </span>
              )}
            </span>
          )}
        </label>

        {error !== null && <ErrorNotice error={error} showReuploadLink={false} />}

        <div className="upload-howto">
          <span className="upload-howto__label">Как получить файл</span>
          <ol className="upload-howto__path">
            <li>Telegram Desktop</li>
            <li>чат → «Экспорт истории чата»</li>
            <li>формат «Машиночитаемый JSON»</li>
          </ol>
        </div>

        {llm && (
          <div className="notice info upload-llm">
            <p className="upload-llm__text">
              Объяснения и контрольный вопрос пишет Claude API (Anthropic): туда уходят проверяемый текст и
              короткие фрагменты переписки — до 30 сообщений по 200 символов, включая сообщения других
              участников.
            </p>
          </div>
        )}
      </section>

      <section className="upload-section" aria-labelledby="upload-modes-title">
        <div className="upload-section__head">
          <h2 id="upload-modes-title" className="upload-section__title">
            Что можно проверить
          </h2>
        </div>
        <ul className="upload-modes">
          {MODES.map((mode) => (
            <li key={mode.key} className="card upload-mode">
              <span className="upload-mode__icon">
                <ModeIcon mode={mode.key} />
              </span>
              <h3 className="upload-mode__title">{mode.title}</h3>
              <p className="upload-mode__text">{mode.text}</p>
              <span className="upload-mode__foot">
                <span className="badge neutral">{mode.tag}</span>
                <span className="muted small">загрузите выше</span>
              </span>
            </li>
          ))}
          <li className="card interactive upload-mode upload-mode--link">
            <span className="upload-mode__icon">
              <ModeIcon mode="compare" />
            </span>
            <h3 className="upload-mode__title">Сравнение двух чатов</h3>
            <p className="upload-mode__text">
              Не пишет ли один человек в двух переписках под разными аккаунтами.
            </p>
            <span className="upload-mode__foot">
              <Link to="/compare" className="stretched-link upload-mode__link">
                Сравнить два чата →
              </Link>
            </span>
          </li>
        </ul>
      </section>

      {recent.length > 0 && (
        <section className="upload-section" aria-labelledby="upload-recent-title">
          <div className="upload-section__head">
            <h2 id="upload-recent-title" className="upload-section__title">
              Недавние чаты
            </h2>
          </div>
          <ul className="upload-recent">
            {recent.map((chat) => (
              <li key={chat.id} className="card interactive upload-recent__item">
                <Avatar name={chat.title} square />
                <span className="upload-recent__body">
                  <Link to={`/chats/${encodeURIComponent(chat.id)}`} className="stretched-link upload-recent__link">
                    {chat.title}
                  </Link>
                  <span className={`badge ${chat.kind === 'group' ? 'neutral' : 'accent'}`}>
                    {chat.kind === 'group' ? 'группа' : 'личный'}
                  </span>
                </span>
                <span className="upload-recent__arrow" aria-hidden="true">
                  →
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
