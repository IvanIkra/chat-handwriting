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
