type Props = {
  children: string
}

/** Состояние загрузки экрана: спиннер, подпись и скелетон; читалки экрана слышат подпись */
export default function Loading({ children }: Props) {
  return (
    <div className="loading" role="status">
      <p className="loading__label">
        <span className="spinner" aria-hidden="true" />
        {children}
      </p>
      <div className="loading__skeleton" aria-hidden="true">
        <div className="loading__card">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
        <div className="loading__card">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      </div>
    </div>
  )
}
