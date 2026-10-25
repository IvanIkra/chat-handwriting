import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('показывает статус бэкенда из /api/health', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: 'ok', llm: false })),
  )
  vi.stubGlobal('fetch', fetchMock)

  render(<App />)

  expect(await screen.findByText('Бэкенд: ok, LLM: нет')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith('/api/health')
})

test('сообщает, если бэкенд недоступен', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

  render(<App />)

  expect(await screen.findByText('Бэкенд недоступен')).toBeInTheDocument()
})
