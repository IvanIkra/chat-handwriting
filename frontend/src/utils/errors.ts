import { ApiError } from '../api'

export type ErrorView = {
  message: string
  /** Предложить загрузить файл заново */
  reupload: boolean
}

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const tooLargeMessage = 'Файл больше 50 МБ — такой экспорт бэкенд не примет.'

/** Переводит ошибку API в текст для пользователя (коды — из docs/CONTRACT.md) */
export function describeError(err: unknown): ErrorView {
  const code = err instanceof ApiError ? err.code : 'unknown'
  switch (code) {
    case 'invalid_export':
      return {
        message:
          'Это не экспорт Telegram. В Telegram Desktop откройте чат → «Экспорт истории чата» → формат «Машиночитаемый JSON» и загрузите result.json.',
        reupload: true,
      }
    case 'file_too_large':
      return { message: tooLargeMessage, reupload: true }
    case 'not_found':
      return {
        message: 'Чат не найден — возможно, бэкенд перезапускался и данные пропали.',
        reupload: true,
      }
    case 'network':
      return { message: 'Бэкенд недоступен. Проверьте, что он запущен.', reupload: false }
    default:
      return { message: 'Что-то пошло не так. Попробуйте ещё раз.', reupload: false }
  }
}
