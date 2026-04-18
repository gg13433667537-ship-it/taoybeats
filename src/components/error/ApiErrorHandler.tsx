'use client'

import React, { ReactNode } from 'react'

interface ApiError {
  error: string
  code?: string | number
  status?: number
}

interface Props {
  children: ReactNode
  onError?: (error: ApiError) => void
}

interface State {
  hasError: boolean
  error: ApiError | null
}

export class ApiErrorHandler extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error: {
        error: error.message || 'An unexpected error occurred',
        status: 500,
      },
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ApiErrorHandler caught an error:', error, errorInfo)
    this.props.onError?.({
      error: error.message,
      status: 500,
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">API Error</span>
          </div>
          <p className="mt-2 text-sm text-red-600">
            {this.state.error?.error || 'An unexpected error occurred'}
          </p>
          {this.state.error?.code && (
            <p className="mt-1 text-xs text-red-500">
              Error code: {this.state.error.code}
            </p>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

export default ApiErrorHandler
