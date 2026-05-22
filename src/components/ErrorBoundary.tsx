import { Component, ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

type Props   = { children: ReactNode }
type State   = { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message:  error?.message ?? 'Unexpected error'
    }
  }

  componentDidCatch(error: Error) {
    // Log for debugging — replace with a real logger if needed
    console.error('[ErrorBoundary caught]:', error.message)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-gray-200
                          p-8 max-w-sm w-full text-center space-y-4">
            <div className="w-12 h-12 bg-red-50 rounded-full flex
                            items-center justify-center mx-auto">
              <RefreshCw size={22} className="text-red-500" />
            </div>
            <h2 className="text-base font-medium text-gray-900">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              We are currently facing technical difficulties.
              Please try again after sometime.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, message: '' })
                window.location.href = '/'
              }}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl
                         text-sm font-medium hover:bg-blue-700 transition"
            >
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}