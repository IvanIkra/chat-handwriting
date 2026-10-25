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
    <div role="alert" className="error">
      <span className="error__icon" aria-hidden="true">
        !
      </span>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
        {(reuploadLink || standalone) && (
          <div className="actions">
            {standalone && retry && (
              <button type="button" className="button" onClick={() => window.location.reload()}>
                Попробовать снова
              </button>
            )}
            {reuploadLink ? <Link to="/">Загрузить файл заново</Link> : standalone && <Link to="/">← На главную</Link>}
          </div>
        )}
      </div>
    </div>
  )
}
