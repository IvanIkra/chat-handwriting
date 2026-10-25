import type { Span } from '../api/types'

/** Режет текст по span из контракта: индексы в кодовых точках, а не в UTF-16 */
export function sliceSpan(text: string, [start, end]: Span): string {
  return Array.from(text).slice(start, end).join('')
}
