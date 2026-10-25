import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { api } from '../api'
import { localToUtcIso } from '../utils/format'
import CheckPage from './CheckPage'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  const { createMockApi } = await import('../api/mocks')
  return { ...actual, api: createMockApi({ delayMs: 0 }) }
})

const FAKE = 'Привет! срочно займи 5000 на карту, потом объясню'

async function renderCheck(chatId: string, authorId: string) {
  render(
    <MemoryRouter initialEntries={[`/chats/${chatId}/authors/${authorId}/check`]}>
      <Routes>
        <Route path="/chats/:chatId/authors/:authorId/check" element={<CheckPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function check(text: string) {
  fireEvent.change(await screen.findByLabelText('Сообщение'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Проверить' }))
}

test('фейк: «не похоже», «срочно» подсвечено, улики и контрольный вопрос', async () => {
  await renderCheck('c_7f3a9b', 'user2002')
  expect(await screen.findByRole('heading', { name: 'Это точно Саша?' })).toBeInTheDocument()

  await check(FAKE)

  expect(await screen.findByText('Не похоже')).toBeInTheDocument()
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '12')
  const marks = document.querySelectorAll('mark')
  expect([...marks].map((m) => m.textContent)).toEqual(['П', 'ривет!', 'срочно'])
  // Улика без span — в списке с пометкой
  const time = screen.getByText('Время отправки').closest('li')!
  expect(within(time).getByText('не в тексте')).toBeInTheDocument()
  expect(screen.getByText('Задайте контрольный вопрос')).toBeInTheDocument()
  expect(screen.getByText('Объяснение')).toBeInTheDocument()
})

test('наведение на подсветку выделяет улику в списке', async () => {
  await renderCheck('c_7f3a9b', 'user2002')
  await check(FAKE)
  await screen.findByText('Не похоже')

  fireEvent.pointerEnter(screen.getByText('срочно', { selector: 'mark' }))

  expect(screen.getByText('Нетипичные слова').closest('li')).toHaveClass('signal--active')
})

test('настоящее сообщение: «похоже», блоков LLM нет', async () => {
  await renderCheck('c_7f3a9b', 'user2002')
  await check('го в кино)')

  expect(await screen.findByText('Похоже на автора')).toBeInTheDocument()
  expect(screen.queryByText('Объяснение')).not.toBeInTheDocument()
  expect(screen.queryByText('Задайте контрольный вопрос')).not.toBeInTheDocument()
})

test('автор без данных: «мало данных», без шкалы', async () => {
  await renderCheck('c_19ab42', 'user3005')
  await check('привет')

  expect(await screen.findByText('Мало данных об авторе')).toBeInTheDocument()
  expect(screen.queryByRole('meter')).not.toBeInTheDocument()
})

test('пустой текст не отправляется, время уходит в UTC', async () => {
  const spy = vi.spyOn(api, 'checkMessage')
  await renderCheck('c_7f3a9b', 'user2002')

  expect(await screen.findByRole('button', { name: 'Проверить' })).toBeDisabled()

  fireEvent.change(screen.getByLabelText(/Когда отправлено/), { target: { value: '2026-10-26T03:12' } })
  await check('прив')

  await screen.findByText('Похоже на автора')
  expect(spy).toHaveBeenCalledWith('c_7f3a9b', 'user2002', {
    text: 'прив',
    sent_at: new Date('2026-10-26T03:12').toISOString(),
  })
  spy.mockRestore()
})

test('localToUtcIso: пустое и мусор — без времени', () => {
  expect(localToUtcIso('')).toBeUndefined()
  expect(localToUtcIso('не дата')).toBeUndefined()
  expect(localToUtcIso('2026-10-26T03:12')).toMatch(/^2026-10-2\dT\d\d:12:00\.000Z$/)
})

test('неизвестный автор — предлагает загрузить заново', async () => {
  await renderCheck('c_7f3a9b', 'user0')

  const alert = await screen.findByRole('alert')
  expect(within(alert).getByRole('link', { name: 'Загрузить файл заново' })).toBeInTheDocument()
})
