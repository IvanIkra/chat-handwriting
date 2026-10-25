import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { rememberChat } from '../utils/recentChats'
import { api } from '../api'
import ComparePage from './ComparePage'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  const { createMockApi } = await import('../api/mocks')
  return { ...actual, api: createMockApi({ delayMs: 0 }) }
})

afterEach(() => {
  localStorage.clear()
})

function renderCompare(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/compare${search}`]}>
      <Routes>
        <Route path="/compare" element={<ComparePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function remember(...ids: string[]) {
  for (const id of ids) rememberChat(await api.getChat(id))
}

test('выбор двух запомненных чатов и результат: пара, улики, общий аккаунт', async () => {
  await remember('c_7f3a9b', 'c_51d0e2')
  renderCompare()

  const submit = screen.getByRole('button', { name: 'Сравнить' })
  expect(submit).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Первый чат'), { target: { value: 'c_7f3a9b' } })
  fireEvent.change(screen.getByLabelText('Второй чат'), { target: { value: 'c_51d0e2' } })
  fireEvent.click(submit)

  expect(await screen.findByRole('heading', { name: '«Саша» и «Alex»' })).toBeInTheDocument()
  expect(screen.getByText(/Иван — аккаунт есть в обоих чатах/)).toBeInTheDocument()
  const pair = screen.getByText('81%').closest('li') as HTMLElement
  expect(within(pair).getByText('вероятно, один человек')).toBeInTheDocument()
  expect(within(pair).getAllByRole('listitem').map((li) => li.textContent?.split(':')[0])).toEqual([
    'Общий почерк',
    'Одинаковая пунктуация',
    'Общие словечки',
    'Одинаковое время активности',
  ])
})

test('ссылка с a и b сразу показывает результат, a из ссылки есть в списке', async () => {
  renderCompare('?a=c_51d0e2&b=c_7f3a9b')

  expect(await screen.findByRole('heading', { name: '«Alex» и «Саша»' })).toBeInTheDocument()
  expect(screen.getByLabelText('Первый чат')).toHaveValue('c_51d0e2')
})

test('один и тот же чат — подсказка, запрос не уходит', async () => {
  const spy = vi.spyOn(api, 'compare')
  await remember('c_7f3a9b')
  renderCompare('?a=c_7f3a9b')

  fireEvent.change(screen.getByLabelText('Второй чат'), { target: { value: 'c_7f3a9b' } })
  expect(screen.getByText('Выберите два разных чата.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Сравнить' })).toBeDisabled()
  expect(spy).not.toHaveBeenCalled()
})

test('загрузка второго экспорта подставляет его во второй чат', async () => {
  await remember('c_7f3a9b')
  renderCompare('?a=c_7f3a9b')

  fireEvent.change(screen.getByLabelText('Загрузить ещё один экспорт'), {
    target: { files: [new File(['{}'], 'alex_result.json')] },
  })
  expect(await screen.findByDisplayValue('Alex (личный)')).toBe(screen.getByLabelText('Второй чат'))
})

test('сравнивать некого — пустое состояние', async () => {
  vi.spyOn(api, 'compare').mockResolvedValueOnce({
    a: await api.getChat('c_7f3a9b'),
    b: await api.getChat('c_51d0e2'),
    shared: ['user1001'],
    pairs: [],
  })
  renderCompare('?a=c_7f3a9b&b=c_51d0e2')

  expect(await screen.findByText(/Сравнивать некого/)).toBeInTheDocument()
})

test('неизвестный чат — ошибка', async () => {
  renderCompare('?a=c_7f3a9b&b=c_missing')
  expect(await screen.findByRole('alert')).toBeInTheDocument()
})
