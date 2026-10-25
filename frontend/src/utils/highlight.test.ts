import { expect, test } from 'vitest'
import type { Signal } from '../api/types'
import { segmentText } from './highlight'

const sig = (span: [number, number] | null, weight: number): Signal => ({
  feature: 'f',
  label: 'l',
  expected: null,
  observed: 'o',
  span,
  weight,
})

test('перекрывающиеся span делят текст на куски со всеми уликами', () => {
  const text = 'Привет! срочно займи'
  const segments = segmentText(text, [sig([0, 7], 0.3), sig([0, 1], 0.2), sig([8, 14], 0.25), sig(null, 0.1)])

  expect(segments.map((s) => s.text)).toEqual(['П', 'ривет!', ' ', 'срочно', ' займи'])
  expect(segments[0]).toMatchObject({ signals: [0, 1], weight: 0.5 })
  expect(segments[1]).toMatchObject({ signals: [0], weight: 0.3 })
  expect(segments[2].signals).toEqual([])
  expect(segments[3].signals).toEqual([2])
  expect(segments.map((s) => s.text).join('')).toBe(text)
})

test('индексы в кодовых точках: эмодзи не рвутся', () => {
  const segments = segmentText('🔥🔥 ну ща', [sig([3, 5], 0.4)])

  expect(segments.map((s) => s.text)).toEqual(['🔥🔥 ', 'ну', ' ща'])
})

test('span за пределами текста обрезается, пустые отбрасываются', () => {
  const segments = segmentText('прив', [sig([2, 99], 0.3), sig([3, 3], 0.2)])

  expect(segments.map((s) => s.text)).toEqual(['пр', 'ив'])
  expect(segments[1].signals).toEqual([0])
})

test('без улик — один кусок', () => {
  expect(segmentText('го в кино)', [])).toEqual([{ text: 'го в кино)', signals: [], weight: 0 }])
})
