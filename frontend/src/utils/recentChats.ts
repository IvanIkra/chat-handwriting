import type { Chat } from '../api'

// В контракте нет списка чатов, поэтому открытые чаты запоминаем в этом браузере —
// чтобы для сравнения можно было выбрать второй чат

export type RecentChat = { id: string; title: string; kind: Chat['kind'] }

const KEY = 'recentChats'
const LIMIT = 10

export function loadRecentChats(): RecentChat[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter(
          (c): c is RecentChat =>
            typeof c?.id === 'string' && typeof c?.title === 'string' && typeof c?.kind === 'string',
        )
      : []
  } catch {
    return []
  }
}

/** Последний открытый — первым, без повторов */
export function rememberChat(chat: Chat): void {
  const entry: RecentChat = { id: chat.id, title: chat.title, kind: chat.kind }
  const list = [entry, ...loadRecentChats().filter((c) => c.id !== chat.id)].slice(0, LIMIT)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Хранилище недоступно (приватный режим) — просто не запоминаем
  }
}
