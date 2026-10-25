import { httpApi } from './client'
import { createMockApi } from './mocks'
import type { Api } from './types'

export { ApiError } from './client'
export type * from './types'

/** VITE_USE_MOCKS=true — работать на примерах из контракта, без бэкенда */
export const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

export const api: Api = useMocks ? createMockApi() : httpApi
