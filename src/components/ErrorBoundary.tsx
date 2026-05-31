import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('ClientFlow render failure', error, info.componentStack)
    }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="page">
          <section className="auth-card error-fallback">
            <div>
              <p className="eyebrow">Recovery mode</p>
              <h2>ClientFlow hit an unexpected UI error.</h2>
              <p>Refresh the page and try again. If this keeps happening, send the founder the current URL and action you were taking.</p>
            </div>
            <button onClick={() => window.location.reload()}>Reload app</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}
