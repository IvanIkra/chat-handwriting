import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Clawd from './components/Clawd'
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
            <Clawd pose="logo" scale={0.5} className="brand__mark" />
            <span className="brand__text">
              Это точно <span className="brand__accent">Клавдий</span>?
            </span>
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
        <div className="app-footer__stroll" aria-hidden="true">
          <Clawd pose="crab-walking" scale={0.25} className="app-footer__crab" />
        </div>
        <div className="app-footer__inner">
          <span className="app-footer__motto">Интернет больше не доказательство</span>
          <span>Стилометрия: сравниваем почерк сообщения с тем, как автор пишет обычно. Это вероятность, а не приговор.</span>
        </div>
      </footer>
    </div>
  )
}

export default App
