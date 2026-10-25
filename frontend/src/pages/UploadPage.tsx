import { useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import ErrorNotice from '../components/ErrorNotice'
import { MAX_UPLOAD_BYTES, tooLargeMessage } from '../utils/errors'
import { loadRecentChats } from '../utils/recentChats'

export default function UploadPage() {
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [dragOver, setDragOver] = useState(false)
  const [recent] = useState(loadRecentChats)

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
      navigate(`/chats/${encodeURIComponent(chat.id)}`)
    } catch (err) {
      setError(err)
      setUploading(false)
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && !uploading) void upload(file)
  }

  return (
    <section>
      <h2>Загрузка экспорта</h2>
      <p>
        Экспорт переписки из Telegram Desktop: откройте чат → «Экспорт истории чата» → формат
        «Машиночитаемый JSON». Подойдёт личный чат (проверка автора) или групповой (поиск
        двойников).
      </p>

      <label
        className={`dropzone${dragOver ? ' dropzone--over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".json,application/json"
          disabled={uploading}
          aria-label="Файл экспорта result.json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void upload(file)
          }}
        />
        {uploading ? (
          <span className="loading">
            <span className="spinner" aria-hidden="true" />
            Загружаем и разбираем переписку…
          </span>
        ) : (
          <>
            <span className="dropzone__title">Выберите result.json</span>
            <span className="muted">или перетащите его сюда</span>
          </>
        )}
      </label>

      {error !== null && <ErrorNotice error={error} showReuploadLink={false} />}

      {recent.length > 0 && (
        <div className="recent">
          <h3>Недавние чаты</h3>
          <ul className="recent__list">
            {recent.map((chat) => (
              <li key={chat.id}>
                <Link to={`/chats/${encodeURIComponent(chat.id)}`}>{chat.title}</Link>{' '}
                <span className="muted">{chat.kind === 'group' ? 'группа' : 'личный'}</span>
              </li>
            ))}
          </ul>
          {recent.length >= 2 && <Link to="/compare">Сравнить два чата →</Link>}
        </div>
      )}
    </section>
  )
}
