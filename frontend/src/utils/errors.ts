import { ApiError } from '../api'

export type ErrorView = {
  title: string
  message: string
  /** Предложить загрузить файл заново */
  reupload: boolean
  /** Есть смысл просто повторить — сбой связи или сервера */
  retry: boolean
}

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const tooLargeMessage = 'Файл больше 50 МБ — такой экспорт бэкенд не примет.'

/** Переводит ошибку API в текст для пользователя (коды — из docs/CONTRACT.md) */
export function describeError(err: unknown): ErrorView {
  const code = err instanceof ApiError ? err.code : 'unknown'
  switch (code) {
    case 'invalid_export':
      return {
        title: 'Не тот файл',
        message:
          'Это не экспорт Telegram. В Telegram Desktop откройте чат → «Экспорт истории чата» → формат «Машиночитаемый JSON» и загрузите result.json.',
        reupload: true,
        retry: false,
      }
    case 'file_too_large':
      return { title: 'Слишком большой файл', message: tooLargeMessage, reupload: true, retry: false }
    case 'not_found':
      return {
        title: 'Не нашли',
        message: 'Чат не найден — возможно, бэкенд перезапускался и данные пропали.',
        reupload: true,
        retry: false,
      }
    case 'network':
      return {
        title: 'Нет связи',
        message: 'Бэкенд недоступен. Проверьте, что он запущен.',
        reupload: false,
        retry: true,
      }
    default:
      return { title: 'Что-то пошло не так', message: 'Попробуйте ещё раз.', reupload: false, retry: true }
  }
}
