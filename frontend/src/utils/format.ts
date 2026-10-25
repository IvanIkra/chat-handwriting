import type { TwinVerdict } from '../api/types'

/** plural(5, ['сообщение', 'сообщения', 'сообщений']) → '5 сообщений' */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many
  return `${n.toLocaleString('ru-RU')} ${word}`
}

export const messagesWord: [string, string, string] = ['сообщение', 'сообщения', 'сообщений']

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Значение datetime-local (местное время) → ISO в UTC, как требует контракт */
export function localToUtcIso(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export const twinVerdictLabel: Record<TwinVerdict, string> = {
  likely_same: 'вероятно, один человек',
  possible: 'возможно, один человек',
  different: 'разные люди',
}

/** '2026-10-20T18:02:11Z' → '20 окт. 2026 г., 18:02 UTC' */
export function formatDateTime(iso: string): string {
  const text = new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
  return `${text} UTC`
}
