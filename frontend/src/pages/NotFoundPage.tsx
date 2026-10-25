import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section>
      <h2>Такой страницы нет</h2>
      <Link to="/">Загрузить экспорт</Link>
    </section>
  )
}
