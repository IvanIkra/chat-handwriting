import { Link } from 'react-router-dom'
import { describeError } from '../utils/errors'

type Props = {
  error: unknown
  /** На экране загрузки ссылка на него же не нужна */
  showReuploadLink?: boolean
}

export default function ErrorNotice({ error, showReuploadLink = true }: Props) {
  const { message, reupload } = describeError(error)
  return (
    <div role="alert" className="error">
      <p>{message}</p>
      {reupload && showReuploadLink && <Link to="/">Загрузить файл заново</Link>}
    </div>
  )
}
