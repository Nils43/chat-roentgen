import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    this.setState({ info: info.componentStack ?? null })
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ error: null, info: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-bg text-ink p-8 font-mono text-sm">
        <h1 className="text-2xl font-serif mb-4 text-b">Render error</h1>
        <p className="mb-2 text-ink-muted">{this.state.error.message}</p>
        <pre className="whitespace-pre-wrap text-xs text-ink-faint bg-bg-raised/40 p-4 rounded border border-line/40 overflow-auto max-h-[60vh]">
          {this.state.error.stack}
          {this.state.info ? `\n\nComponent stack:${this.state.info}` : ''}
        </pre>
        <button
          onClick={this.reset}
          className="mt-4 px-4 py-2 bg-ink text-bg rounded-full text-sm"
        >
          Try again
        </button>
      </div>
    )
  }
}
