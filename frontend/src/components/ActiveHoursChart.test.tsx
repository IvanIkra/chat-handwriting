import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ActiveHoursChart from './ActiveHoursChart'

test('пустой active_hours не роняет график', () => {
  const { container } = render(<ActiveHoursChart hours={[]} />)

  expect(screen.getByRole('img', { name: 'Активность по часам: нет данных' })).toBeInTheDocument()
  expect(container.querySelector('.hours-chart__peak')).toBeNull()
})
