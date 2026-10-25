import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { ApiError } from '../api'
import ErrorNotice from './ErrorNotice'
import Loading from './Loading'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderError(error: unknown, standalone = false) {
  render(
    <MemoryRouter>
      <ErrorNotice error={error} standalone={standalone} />
    </MemoryRouter>,
  )
}

test('нет связи на весь экран: заголовок, повтор и ссылка на главную', () => {
  const reload = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload })
  renderError(new ApiError(0, 'network', 'Бэкенд недоступен'), true)

  expect(screen.getByRole('alert')).toHaveTextContent('Нет связи')
  fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }))
  expect(reload).toHaveBeenCalled()
  expect(screen.getByRole('link', { name: '← На главную' })).toHaveAttribute('href', '/')
})

test('чат не найден: только предложение загрузить заново, без повтора', () => {
  renderError(new ApiError(404, 'not_found', 'нет'), true)

  expect(screen.getByRole('link', { name: 'Загрузить файл заново' })).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '← На главную' })).not.toBeInTheDocument()
})

test('ошибка внутри формы — без кнопок, повтор делается самой формой', () => {
  renderError(new ApiError(500, 'unknown', 'HTTP 500'))

  expect(screen.getByRole('alert')).toHaveTextContent('Что-то пошло не так')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

test('загрузка озвучивается подписью', () => {
  render(<Loading>Загружаем чат…</Loading>)
  expect(screen.getByRole('status')).toHaveTextContent('Загружаем чат…')
})
