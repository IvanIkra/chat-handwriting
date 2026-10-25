import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import PairPage from './PairPage'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  const { createMockApi } = await import('../api/mocks')
  return { ...actual, api: createMockApi({ delayMs: 0 }) }
})

function renderPair(chatId: string, aId: string, bId: string) {
  return render(
    <MemoryRouter initialEntries={[`/chats/${chatId}/twins/${aId}/${bId}`]}>
      <Routes>
        <Route path="/chats/:chatId/twins/:aId/:bId" element={<PairPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('пара: вердикт, улики по весу, сообщения рядом, таймлайн и объяснение', async () => {
  renderPair('c_19ab42', 'user3003', 'user3004')

  expect(await screen.findByRole('heading', { name: 'Катя и Дима_88' })).toBeInTheDocument()
  expect(screen.getByText('84%')).toBeInTheDocument()
  expect(screen.getByText('вероятно, один человек')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '← К двойникам' })).toHaveAttribute('href', '/chats/c_19ab42/twins')

  const signals = screen.getByRole('heading', { name: 'Улики' }).nextElementSibling as HTMLElement
  expect(within(signals).getAllByRole('listitem').map((li) => li.querySelector('strong')!.textContent)).toEqual([
    'Общие редкие слова',
    'Одинаковая пунктуация',
    'Не пишут одновременно',
    'Быстрое переключение',
  ])

  const examples = screen.getByRole('heading', { name: 'Похожие сообщения' }).nextElementSibling as HTMLElement
  expect(within(examples).getByText('Общие редкие слова')).toBeInTheDocument()
  expect(within(examples).getByText('щас гляну, ваще не помню где это')).toBeInTheDocument()
  expect(within(examples).getByText('ваще согласен!! щас скину')).toBeInTheDocument()
  expect(within(examples).getAllByText('20 окт. 2026 г., 18:02 UTC')).toHaveLength(2)

  expect(screen.getByText('0 минут')).toBeInTheDocument()
  expect(screen.getByText('31 с')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Объяснение' })).toBeInTheDocument()
})

test('пара без примеров, объяснения и переключений', async () => {
  renderPair('c_19ab42', 'user3001', 'user3003')

  expect(await screen.findByRole('heading', { name: 'Аня и Катя' })).toBeInTheDocument()
  expect(screen.getByText('разные люди')).toBeInTheDocument()
  expect(screen.getByText('Общих черт почерка не нашлось.')).toBeInTheDocument()
  expect(screen.getByText('Примеров нет.')).toBeInTheDocument()
  expect(screen.getByText('14 минут')).toBeInTheDocument()
  expect(screen.getByText(/ни разу не шли сразу/)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Объяснение' })).not.toBeInTheDocument()
})

test('несуществующая пара — ошибка', async () => {
  renderPair('c_19ab42', 'user3001', 'user3005')
  expect(await screen.findByRole('alert')).toBeInTheDocument()
})
