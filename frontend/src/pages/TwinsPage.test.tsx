import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { api } from '../api'
import TwinsPage from './TwinsPage'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  const { createMockApi } = await import('../api/mocks')
  return { ...actual, api: createMockApi({ delayMs: 0 }) }
})

function PairStub() {
  const { aId, bId } = useParams()
  return <p>пара {aId}/{bId}</p>
}

function renderTwins(chatId: string) {
  return render(
    <MemoryRouter initialEntries={[`/chats/${chatId}/twins`]}>
      <Routes>
        <Route path="/chats/:chatId/twins" element={<TwinsPage />} />
        <Route path="/chats/:chatId/twins/:aId/:bId" element={<PairStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('самопроверка, пары по убыванию score и исключённые авторы', async () => {
  renderTwins('c_19ab42')

  expect(await screen.findByText('90%')).toBeInTheDocument()
  expect(screen.getByText(/Проверено на 10 авторах/)).toBeInTheDocument()
  expect(screen.getByText(/мало собственных сообщений: Лёша/)).toBeInTheDocument()

  const list = screen.getByRole('heading', { name: 'Пары' }).nextElementSibling as HTMLElement
  const links = within(list).getAllByRole('link')
  expect(links.map((l) => l.textContent)).toEqual(['Катя и Дима_88', 'Аня и Катя', 'Аня и Дима_88'])
  expect(links[0]).toHaveAttribute('href', '/chats/c_19ab42/twins/user3003/user3004')
  expect(screen.getByText('Общие редкие слова: «щас», «ваще» — больше ни у кого в чате')).toBeInTheDocument()
})

test('граф: рёбра по парам, likely_same красное и толще, клик ведёт к сравнению', async () => {
  renderTwins('c_19ab42')

  const top = await screen.findByRole('link', { name: /^Катя и Дима_88: 84%/ })
  const weak = screen.getByRole('link', { name: /^Аня и Дима_88: 18%/ })
  expect(top).toHaveAttribute('data-verdict', 'likely_same')
  expect(top).toHaveClass('twins-graph__edge--likely_same')
  const width = (edge: HTMLElement) => Number(edge.querySelector('line')!.getAttribute('stroke-width'))
  expect(width(top)).toBeGreaterThan(width(weak))

  fireEvent.click(top)
  expect(await screen.findByText('пара user3003/user3004')).toBeInTheDocument()
})

test('ребро открывается с клавиатуры', async () => {
  renderTwins('c_19ab42')

  const edge = await screen.findByRole('link', { name: /^Аня и Катя: 21%/ })
  fireEvent.keyDown(edge, { key: 'Enter' })
  expect(await screen.findByText('пара user3001/user3003')).toBeInTheDocument()
})

test('личный чат: самопроверки нет', async () => {
  renderTwins('c_7f3a9b')

  expect(await screen.findByText(/Самопроверки нет/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Иван и Саша' })).toBeInTheDocument()
})

test('нет пар — пустое состояние без графа', async () => {
  vi.spyOn(api, 'getTwins').mockResolvedValueOnce({
    chat_id: 'c_19ab42',
    authors: [{ id: 'user3005', name: 'Лёша', message_count: 12, enough_data: false }],
    pairs: [],
    validation: null,
  })
  renderTwins('c_19ab42')

  expect(await screen.findByText(/Сравнивать некого/)).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Граф похожести участников' })).not.toBeInTheDocument()
})

test('неизвестный чат — ошибка', async () => {
  renderTwins('nope')
  expect(await screen.findByRole('alert')).toBeInTheDocument()
})
