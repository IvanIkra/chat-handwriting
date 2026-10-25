import { Component, type ErrorInfo, type ReactNode } from 'react'
import ErrorNotice from './ErrorNotice'

type Props = { children: ReactNode }
type State = { error: unknown }

/** Падение страницы на неожиданных данных не роняет всё приложение: шапка и навигация остаются */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Страница упала:', error, info.componentStack)
  }

  render() {
    if (this.state.error !== null) return <ErrorNotice error={this.state.error} standalone />
    return this.props.children
  }
}
