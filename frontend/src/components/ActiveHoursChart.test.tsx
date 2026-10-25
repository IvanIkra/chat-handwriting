import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ActiveHoursChart from './ActiveHoursChart'

test('пустой active_hours не роняет график', () => {
  const { container } = render(<ActiveHoursChart hours={[]} />)

  expect(screen.getByRole('img', { name: 'Активность по часам: нет данных' })).toBeInTheDocument()
  expect(container.querySelector('.hours-chart__peak')).toBeNull()
})

test('внутри графика нет фокусируемых столбцов — с клавиатуры часы в таблице', () => {
  const hours = Array.from({ length: 24 }, (_, h) => (h === 21 ? 0.2 : 0.8 / 23))
  const { container } = render(<ActiveHoursChart hours={hours} />)

  expect(screen.getByRole('img', { name: 'Активность по часам, пик в 21:00 UTC' })).toBeInTheDocument()
  expect(container.querySelectorAll('svg [tabindex]')).toHaveLength(0)
  expect(screen.getByRole('table')).toBeInTheDocument()
})
