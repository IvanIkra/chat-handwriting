import { useEffect, useState } from 'react'

type Health = { status: string; llm: boolean }

type HealthState =
  | { kind: 'loading' }
  | { kind: 'ok'; health: Health }
  | { kind: 'error' }

function App() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' })

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Health>
      })
      .then((health) => setState({ kind: 'ok', health }))
      .catch(() => setState({ kind: 'error' }))
  }, [])

  return (
    <main>
      <h1>Это точно Саша?</h1>
      <p role="status">
        {state.kind === 'loading' && 'Проверяем бэкенд…'}
        {state.kind === 'ok' &&
          `Бэкенд: ${state.health.status}, LLM: ${state.health.llm ? 'доступна' : 'нет'}`}
        {state.kind === 'error' && 'Бэкенд недоступен'}
      </p>
    </main>
  )
}

export default App
