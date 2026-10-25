import { Link } from 'react-router-dom'
import { describeError } from '../utils/errors'

type Props = {
  error: unknown
  /** На экране загрузки ссылка на него же не нужна */
  showReuploadLink?: boolean
  /** Ошибка вместо всего экрана: можно повторить загрузку страницы и уйти на главную */
  standalone?: boolean
}

export default function ErrorNotice({ error, showReuploadLink = true, standalone = false }: Props) {
  const { title, message, reupload, retry } = describeError(error)
  const reuploadLink = reupload && showReuploadLink
  return (
    <div role="alert" className={`notice danger error-notice${standalone ? ' error-notice--standalone' : ''}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 7.5v5.5" />
        <path d="M12 16.5h.01" />
      </svg>
      <div className="error-notice__body">
        <strong className="error-notice__title">{title}</strong>
        <p className="error-notice__message">{message}</p>
        {(reuploadLink || standalone) && (
          <div className="error-notice__actions">
            {standalone && retry && (
              <button type="button" className="button primary" onClick={() => window.location.reload()}>
                Попробовать снова
              </button>
            )}
            {reuploadLink ? (
              <Link to="/" className={standalone ? 'button' : undefined}>
                Загрузить файл заново
              </Link>
            ) : (
              standalone && (
                <Link to="/" className="button ghost">
                  ← На главную
                </Link>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
