import { expect, test } from 'vitest'
import { ApiError } from '../api'
import { describeError } from './errors'

test('validation показывает текст бэкенда и не предлагает повтор', () => {
  const view = describeError(new ApiError(422, 'validation', 'text: слишком длинный'))

  expect(view).toMatchObject({ message: 'text: слишком длинный', retry: false, reupload: false })
})

test('not_found показывает текст бэкенда — автор или пара, а не только чат', () => {
  const view = describeError(new ApiError(404, 'not_found', 'В этом чате нет такого автора'))

  expect(view.message).toBe('В этом чате нет такого автора')
  expect(view.reupload).toBe(true)
})

test('not_found без текста — подсказка про перезапуск бэкенда', () => {
  expect(describeError(new ApiError(404, 'not_found', '')).message).toMatch(/перезапускался/)
})

test('502 от прокси читается как «Нет связи»', () => {
  expect(describeError(new ApiError(502, 'network', 'Бэкенд недоступен'))).toMatchObject({
    title: 'Нет связи',
    retry: true,
  })
})
