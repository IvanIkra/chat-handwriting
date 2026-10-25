// Мок-режим: ответы собраны из примеров docs/CONTRACT.md.
import { ApiError } from './client'
import type {
  Api,
  Author,
  Chat,
  CheckResult,
  PairDetails,
  StyleProfile,
  TwinPair,
  TwinsResult,
} from './types'

const personalChat: Chat = {
  id: 'c_7f3a9b',
  title: 'Саша',
  kind: 'personal',
  message_count: 1840,
  period: { from: '2025-03-01T09:12:00Z', to: '2026-10-24T22:40:00Z' },
  authors: [
    { id: 'user1001', name: 'Иван', message_count: 928, enough_data: true },
    { id: 'user2002', name: 'Саша', message_count: 912, enough_data: true },
  ],
}

const groupAuthors: Author[] = [
  { id: 'user3001', name: 'Аня', message_count: 210, enough_data: true },
  { id: 'user3003', name: 'Катя', message_count: 143, enough_data: true },
  { id: 'user3004', name: 'Дима_88', message_count: 97, enough_data: true },
  { id: 'user3005', name: 'Лёша', message_count: 12, enough_data: false },
]

// В контракте нет примера группового Chat — собран из примера /twins
const groupChat: Chat = {
  id: 'c_19ab42',
  title: 'Двор на Лесной',
  kind: 'group',
  message_count: groupAuthors.reduce((sum, a) => sum + a.message_count, 0),
  period: { from: '2026-10-01T08:00:00Z', to: '2026-10-24T21:15:00Z' },
  authors: groupAuthors,
}

const chats: Chat[] = [personalChat, groupChat]

const sashaProfile: StyleProfile = {
  author_id: 'user2002',
  name: 'Саша',
  message_count: 912,
  enough_data: true,
  avg_length: 38.2,
  traits: [
    { key: 'lowercase_start', label: 'Пишет с маленькой буквы', value: 0.94, description: '94% сообщений начинаются со строчной буквы' },
    { key: 'brackets_smile', label: 'Скобки вместо эмодзи', value: 0.41, description: '«)» или «))» в 41% сообщений' },
    { key: 'no_final_dot', label: 'Не ставит точку в конце', value: 0.99, description: 'Точка в конце — в 1% сообщений' },
  ],
  top_words: ['кста', 'ща', 'норм', 'ваще', 'го'],
  emoji: [
    { char: ')', count: 374 },
    { char: '🔥', count: 52 },
  ],
  active_hours: [0.04, 0.03, 0.01, 0, 0, 0, 0, 0.01, 0.02, 0.04, 0.06, 0.07, 0.07, 0.06, 0.06, 0.06, 0.07, 0.07, 0.08, 0.08, 0.07, 0.04, 0.03, 0.03],
}

const mismatchResult: CheckResult = {
  author_id: 'user2002',
  score: 0.12,
  verdict: 'mismatch',
  signals: [
    { feature: 'greeting', label: 'Приветствие', expected: '«прив», «йо» или без приветствия', observed: '«Привет!»', span: [0, 7], weight: 0.3 },
    { feature: 'capitalization', label: 'Заглавная буква в начале', expected: 'почти всегда строчная (94%)', observed: 'заглавная', span: [0, 1], weight: 0.2 },
    { feature: 'rare_words', label: 'Нетипичные слова', expected: 'не встречается в переписке', observed: '«срочно»', span: [9, 15], weight: 0.25 },
    { feature: 'active_hours', label: 'Время отправки', expected: 'обычно 08:00–23:00 UTC', observed: '03:12 UTC', span: null, weight: 0.1 },
  ],
  explanation:
    'Саша почти никогда не здоровается полным «Привет», не начинает с заглавной и ни разу за полтора года не писал «срочно». Сообщение отправлено в час, когда он обычно не пишет.',
  challenge_question:
    'Спроси, в какой бар вы ходили после концерта в мае — это обсуждалось в переписке 14.05.',
}

// Своего примера для «похоже» в контракте нет — нужен, чтобы на моках был виден второй вердикт
const matchResult: CheckResult = {
  author_id: 'user2002',
  score: 0.91,
  verdict: 'match',
  signals: [
    { feature: 'capitalization', label: 'Строчная буква в начале', expected: 'почти всегда строчная (94%)', observed: 'строчная', span: [0, 1], weight: 0.2 },
  ],
  explanation: null,
  challenge_question: null,
}

const topPair: TwinPair = {
  a: 'user3003',
  b: 'user3004',
  score: 0.84,
  verdict: 'likely_same',
  signals: [
    { feature: 'rare_words', label: 'Общие редкие слова', expected: null, observed: '«щас», «ваще» — больше ни у кого в чате', span: null, weight: 0.35 },
    { feature: 'punctuation', label: 'Одинаковая пунктуация', expected: null, observed: '«!!» и пробел перед «?» у обоих', span: null, weight: 0.25 },
    { feature: 'no_overlap', label: 'Не пишут одновременно', expected: null, observed: '0 случаев, когда оба писали в одну минуту', span: null, weight: 0.2 },
    { feature: 'switch_time', label: 'Быстрое переключение', expected: null, observed: 'медиана 31 с между сообщениями A и B', span: null, weight: 0.2 },
  ],
}

const groupTwins: TwinsResult = {
  chat_id: 'c_19ab42',
  authors: groupAuthors,
  pairs: [
    topPair,
    { a: 'user3001', b: 'user3003', score: 0.21, verdict: 'different', signals: [] },
    { a: 'user3001', b: 'user3004', score: 0.18, verdict: 'different', signals: [] },
  ],
  validation: { self_match_rate: 0.9, authors_tested: 10 },
}

const topPairDetails: PairDetails = {
  pair: topPair,
  a: groupAuthors[1],
  b: groupAuthors[2],
  examples: [
    {
      feature: 'rare_words',
      a: { text: 'щас гляну, ваще не помню где это', sent_at: '2026-10-20T18:02:11Z' },
      b: { text: 'ваще согласен!! щас скину', sent_at: '2026-10-20T18:02:44Z' },
    },
  ],
  timeline: { overlap_minutes: 0, median_switch_seconds: 31 },
  explanation:
    'Оба аккаунта используют «щас» и «ваще», которых нет больше ни у кого в чате, одинаково ставят «!!». За три недели они ни разу не писали в одну и ту же минуту, а когда один замолкает, второй появляется через полминуты.',
}

function notFound(): never {
  throw new ApiError(404, 'not_found', 'Чат или автор не найден')
}

function findChat(chatId: string): Chat {
  return chats.find((c) => c.id === chatId) ?? notFound()
}

function findAuthor(chatId: string, authorId: string): Author {
  return findChat(chatId).authors.find((a) => a.id === authorId) ?? notFound()
}

function twinsFor(chat: Chat): TwinsResult {
  if (chat.id === groupTwins.chat_id) return groupTwins
  const authors = chat.authors
  const pairs: TwinPair[] =
    authors.length >= 2 && authors.every((a) => a.enough_data)
      ? [{ a: authors[0].id, b: authors[1].id, score: 0.08, verdict: 'different', signals: [] }]
      : []
  return { chat_id: chat.id, authors, pairs, validation: null }
}

export function createMockApi({ delayMs = 300 }: { delayMs?: number } = {}): Api {
  // Копия, чтобы экраны не могли испортить общие примеры
  const respond = <T>(make: () => T): Promise<T> =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(structuredClone(make()))
        } catch (err) {
          reject(err)
        }
      }, delayMs)
    })

  return {
    getHealth: () => respond(() => ({ status: 'ok', llm: true })),

    uploadChat: (file) =>
      respond(() => {
        if (!file.name.endsWith('.json')) {
          throw new ApiError(400, 'invalid_export', 'Файл не похож на экспорт Telegram')
        }
        return file.name.startsWith('group') ? groupChat : personalChat
      }),

    getChat: (chatId) => respond(() => findChat(chatId)),

    getProfile: (chatId, authorId) =>
      respond(() => {
        const author = findAuthor(chatId, authorId)
        return {
          ...sashaProfile,
          author_id: author.id,
          name: author.name,
          message_count: author.message_count,
          enough_data: author.enough_data,
        }
      }),

    checkMessage: (chatId, authorId, { text }) =>
      respond(() => {
        const author = findAuthor(chatId, authorId)
        if (!text.trim()) {
          throw new ApiError(422, 'validation', 'Текст сообщения пустой')
        }
        if (!author.enough_data) {
          return {
            author_id: author.id,
            score: null,
            verdict: 'not_enough_data' as const,
            signals: [],
            explanation: null,
            challenge_question: null,
          }
        }
        const base = text.toLowerCase().includes('срочно') ? mismatchResult : matchResult
        return { ...base, author_id: author.id }
      }),

    getTwins: (chatId) => respond(() => twinsFor(findChat(chatId))),

    getPair: (chatId, aId, bId) =>
      respond(() => {
        const chat = findChat(chatId)
        const pair =
          twinsFor(chat).pairs.find(
            (p) => (p.a === aId && p.b === bId) || (p.a === bId && p.b === aId),
          ) ?? notFound()
        if (pair === topPair) return topPairDetails
        return {
          pair,
          a: findAuthor(chatId, pair.a),
          b: findAuthor(chatId, pair.b),
          examples: [],
          timeline: { overlap_minutes: 14, median_switch_seconds: null },
          explanation: null,
        }
      }),
  }
}
