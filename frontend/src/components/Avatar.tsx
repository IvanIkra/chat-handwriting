import type { CSSProperties } from 'react'

/** Инициалы для аватара: «Иван Петров» → «ИП», «Саша» → «С» */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => Array.from(p)[0] ?? '')
  return letters.join('').toUpperCase() || '?'
}

/** Стабильный сдвиг оттенка по имени: у одного и того же человека аватар везде одного цвета */
function hueOf(name: string): number {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 360
  return hash
}

type Props = {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  square?: boolean
  ring?: boolean
  className?: string
}

/** Декоративный кружок с инициалами; имя рядом всегда написано текстом, поэтому скрыт от читалок */
export default function Avatar({ name, size = 'md', square = false, ring = false, className }: Props) {
  const classes = [
    'avatar',
    size !== 'md' && `avatar--${size}`,
    square && 'avatar--square',
    ring && 'avatar--ring',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <span className={classes} aria-hidden="true" style={{ '--avatar-hue': hueOf(name) } as CSSProperties}>
      {initials(name)}
    </span>
  )
}
