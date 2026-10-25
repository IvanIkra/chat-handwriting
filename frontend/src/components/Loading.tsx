import { useEffect, useState } from 'react'
import Clawd from './Clawd'

type Props = {
  children: string
}

/** Подписи как у Claude Code, пока он думает: меняются каждые несколько секунд */
const PHRASES = [
  'сверяю запятые',
  'считаю скобочки',
  'ищу «срочно»',
  'листаю переписку',
  'принюхиваюсь к опечаткам',
  'сравниваю часы активности',
  'раскладываю по полочкам',
]

/** Состояние загрузки экрана: Clawd за ноутбуком, подпись и скелетон; читалки экрана слышат только подпись */
export default function Loading({ children }: Props) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  const phrase = PHRASES[Math.floor(seconds / 3) % PHRASES.length]

  return (
    <div className="loading" role="status">
      <div className="loading__head">
        <Clawd pose="laptop" className="loading__clawd" />
        <div className="loading__text">
          <p className="loading__label">
            <span className="spinner" aria-hidden="true" />
            <span className="shimmer-text">{children}</span>
          </p>
          <p className="loading__meta" aria-hidden="true">
            ({seconds} с · {phrase}…)
          </p>
        </div>
      </div>
      <div className="loading__skeleton" aria-hidden="true">
        <div className="loading__card">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
        <div className="loading__card">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      </div>
    </div>
  )
}
