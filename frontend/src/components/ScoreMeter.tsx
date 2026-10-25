import type { CheckVerdict } from '../api/types'

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

type Props = {
  verdict: CheckVerdict
  /** 0–1, null при not_enough_data */
  score: number | null
}

export default function ScoreMeter({ verdict, score }: Props) {
  // Неизвестный вердикт (бэкенд новее фронта) показываем как «не уверены», а не роняем страницу
  const known: CheckVerdict = Object.hasOwn(VERDICTS, verdict) ? verdict : 'uncertain'
  const v = VERDICTS[known]
  const percent = score === null ? null : Math.round(score * 100)

  return (
    <div className={`verdict verdict--${known}`}>
      <div className="verdict__head">
        <span className="verdict__icon" aria-hidden="true">
          {v.icon}
        </span>
        <div>
          <strong className="verdict__label">{v.label}</strong>
          <p className="muted">{v.hint}</p>
        </div>
        {percent !== null && <span className="verdict__score">{percent}%</span>}
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
          <div className="meter__fill" style={{ width: `${percent}%` }} />
          <div className="meter__scale" aria-hidden="true">
            <span>0%</span>
            <span>не похоже</span>
            <span>похоже</span>
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  )
}
