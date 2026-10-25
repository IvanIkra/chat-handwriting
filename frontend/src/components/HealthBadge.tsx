import { useEffect, useState } from 'react'
import { api, useMocks, type Health } from '../api'

type HealthState =
  | { kind: 'loading' }
  | { kind: 'ok'; health: Health }
  | { kind: 'error' }

export default function HealthBadge() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' })

  useEffect(() => {
    api
      .getHealth()
      .then((health) => setState({ kind: 'ok', health }))
      .catch(() => setState({ kind: 'error' }))
  }, [])

  return (
    <p role="status" className={`health health--${state.kind}`}>
      <span className="health__dot" aria-hidden="true" />
      <span className="health__text">
        {useMocks && 'Моки · '}
        {state.kind === 'loading' && 'Проверяем бэкенд…'}
        {state.kind === 'ok' &&
          // llm — только «ключ задан»: отвечает ли LLM на самом деле, бэкенд не проверяет
          `Бэкенд: ${state.health.status}, LLM: ${state.health.llm ? 'ключ задан' : 'без ключа'}`}
        {state.kind === 'error' && 'Бэкенд недоступен'}
      </span>
    </p>
  )
}
