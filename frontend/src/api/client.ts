import type { Api, ApiErrorBody } from './types'

/** Ошибка API по контракту; code = 'network', если бэкенд не ответил */
export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function isErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as ApiErrorBody).error?.code === 'string'
  )
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, init)
  } catch {
    throw new ApiError(0, 'network', 'Бэкенд недоступен')
  }

  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    if (isErrorBody(body)) {
      throw new ApiError(res.status, body.error.code, body.error.message)
    }
    throw new ApiError(res.status, 'unknown', `HTTP ${res.status}`)
  }
  return body as T
}

const enc = encodeURIComponent

export const httpApi: Api = {
  getHealth: () => request('/health'),

  uploadChat(file) {
    const form = new FormData()
    form.append('file', file)
    return request('/chats', { method: 'POST', body: form })
  },

  getChat: (chatId) => request(`/chats/${enc(chatId)}`),

  getProfile: (chatId, authorId) =>
    request(`/chats/${enc(chatId)}/authors/${enc(authorId)}/profile`),

  checkMessage: (chatId, authorId, body) =>
    request(`/chats/${enc(chatId)}/authors/${enc(authorId)}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  getTwins: (chatId) => request(`/chats/${enc(chatId)}/twins`),

  getPair: (chatId, aId, bId) =>
    request(`/chats/${enc(chatId)}/twins/${enc(aId)}/${enc(bId)}`),
}
