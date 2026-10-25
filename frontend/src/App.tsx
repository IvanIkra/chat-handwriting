import { Link, Route, Routes, useLocation } from 'react-router-dom'
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
    <main>
      <header>
        <h1>
          <Link to="/">Это точно Саша?</Link>
        </h1>
        <HealthBadge />
      </header>
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
  )
}

export default App
