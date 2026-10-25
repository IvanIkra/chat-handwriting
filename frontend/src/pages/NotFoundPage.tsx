import { Link } from 'react-router-dom'
import ClawdMark from '../components/ClawdMark'
import './NotFoundPage.css'

export default function NotFoundPage() {
  return (
    <section className="page notfound">
      <div className="card notfound-card">
        <p className="notfound-code" aria-hidden="true">
          4
          <span className="notfound-code__zero">
            <ClawdMark mood="search" />
          </span>
          4
        </p>
        <h2 className="notfound-title">Такой страницы нет</h2>
        <p className="notfound-text">
          Ссылка устарела или в адресе опечатка. Чаты хранятся в памяти сервера только до его
          перезапуска — если вы открывали чат раньше, загрузите экспорт заново.
        </p>
        <div className="notfound-actions">
          <Link to="/" className="button primary">
            Загрузить экспорт
          </Link>
          <Link to="/compare" className="button ghost">
            Сравнить два чата
          </Link>
        </div>
      </div>
    </section>
  )
}
