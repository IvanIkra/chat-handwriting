import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import HealthBadge from './components/HealthBadge'
import ChatPage from './pages/ChatPage'
import CheckPage from './pages/CheckPage'
import ComparePage from './pages/ComparePage'
import NotFoundPage from './pages/NotFoundPage'
import PairPage from './pages/PairPage'
import ProfilePage from './pages/ProfilePage'
import TwinsPage from './pages/TwinsPage'
import UploadPage from './pages/UploadPage'

/** Знак: лупа над «пузырём» сообщения */
function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v4A2.5 2.5 0 0 1 13.5 12H9l-3.5 3v-3H6.5" opacity="0.55" />
      <circle cx="14.5" cy="14.5" r="4.5" />
      <path d="m18 18 3 3" />
      <path d="M13 14.5h3" opacity="0.8" />
    </svg>
  )
}

function App() {
  const location = useLocation()
  return (
    <div className="app">
      <a className="skip-link" href="#content">
        Перейти к содержимому
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="brand">
            <span className="brand__mark">
              <LogoMark />
            </span>
            <span className="brand__text">Это точно Саша?</span>
          </Link>
          <nav className="app-nav" aria-label="Основная навигация">
            <NavLink to="/" end>
              Главная
            </NavLink>
            <NavLink to="/compare">Сравнить чаты</NavLink>
          </nav>
          <div className="app-header__status">
            <HealthBadge />
          </div>
        </div>
      </header>
      <main id="content" className="app-main" tabIndex={-1}>
        {/* key: после перехода на другую страницу ошибка сбрасывается */}
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/chats/:chatId" element={<ChatPage />} />
            <Route path="/chats/:chatId/authors/:authorId" element={<ProfilePage />} />
            <Route path="/chats/:chatId/authors/:authorId/check" element={<CheckPage />} />
            <Route path="/chats/:chatId/twins" element={<TwinsPage />} />
            <Route path="/chats/:chatId/twins/:aId/:bId" element={<PairPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <footer className="app-footer">
        <div className="app-footer__inner">
          <span className="app-footer__motto">Интернет больше не доказательство</span>
          <span>Стилометрия: сравниваем почерк сообщения с тем, как автор пишет обычно. Это вероятность, а не приговор.</span>
        </div>
      </footer>
    </div>
  )
}

export default App
