import type { CheckReason, CheckVerdict } from '../api/types'
import Clawd, { type ClawdPose } from './Clawd'

const VERDICTS: Record<CheckVerdict, { icon: string; label: string; hint: string }> = {
  match: { icon: '✓', label: 'Похоже на автора', hint: 'Почерк совпадает с перепиской' },
  uncertain: { icon: '?', label: 'Не уверены', hint: 'Часть признаков совпадает, часть нет' },
  mismatch: { icon: '✕', label: 'Не похоже', hint: 'Сообщение написано не так, как обычно пишет автор' },
  not_enough_data: {
    icon: '…',
    label: 'Мало данных об авторе',
    hint: 'Собственных сообщений автора не хватает для надёжной проверки',
  },
}

/** not_enough_data из-за самого текста, а не автора */
const NO_STYLE_TEXT = {
  icon: '…',
  label: 'В тексте нет почерка',
  hint: 'Только ссылки, @упоминания, команды или код — добавьте обычный текст',
}

/** Как Clawd реагирует на вердикт */
const CLAWD: Record<CheckVerdict, ClawdPose> = {
  match: 'dancing',
  uncertain: 'magnifier',
  mismatch: 'pointing',
  not_enough_data: 'book',
}

type Props = {
  verdict: CheckVerdict
  /** 0–1, null при not_enough_data */
  score: number | null
  /** Почему not_enough_data; без него — мало сообщений у автора */
  reason?: CheckReason | null
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function ScoreMeter({ verdict, score, reason }: Props) {
  // Неизвестный вердикт (бэкенд новее фронта) показываем как «не уверены», а не роняем страницу
  const known: CheckVerdict = Object.hasOwn(VERDICTS, verdict) ? verdict : 'uncertain'
  const v = known === 'not_enough_data' && reason === 'no_style_text' ? NO_STYLE_TEXT : VERDICTS[known]
  const percent = score === null ? null : Math.min(100, Math.max(0, Math.round(score * 100)))
  const offset = percent === null ? CIRCUMFERENCE : CIRCUMFERENCE * (1 - percent / 100)

  return (
    <div className={`verdict verdict--${known}`}>
      <div className="verdict__main">
        <div className="verdict__gauge" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle className="verdict__track" cx="60" cy="60" r={RADIUS} />
            {percent !== null && (
              <circle
                className="verdict__arc"
                cx="60"
                cy="60"
                r={RADIUS}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
                style={{ ['--arc-length' as string]: CIRCUMFERENCE }}
              />
            )}
          </svg>
          <div className="verdict__center">
            {percent !== null ? (
              <span className="verdict__score">
                {percent}
                <small>%</small>
              </span>
            ) : (
              <span className="verdict__icon">{v.icon}</span>
            )}
          </div>
        </div>
        <div className="verdict__text">
          <strong className="verdict__label">{v.label}</strong>
          <p className="verdict__hint">{v.hint}</p>
        </div>
        <Clawd pose={CLAWD[known]} scale={0.34} className="verdict__clawd" />
      </div>
      {percent !== null && (
        <div
          className="meter"
          role="meter"
          aria-label="Похожесть на автора"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${percent}% — ${v.label}`}
        >
          <div className="meter__track">
            <div className="meter__fill" style={{ width: `${percent}%` }} />
            <div className="meter__marker" style={{ left: `${percent}%` }} />
          </div>
          <div className="meter__scale" aria-hidden="true">
            <span>0%</span>
            <span>не похоже</span>
            <span>сомнительно</span>
            <span>похоже</span>
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  )
}
