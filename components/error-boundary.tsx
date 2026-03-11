"use client"

import React from "react"

import { ErrorFallback } from "@/components/error-fallback"
import { reportClientError } from "@/lib/error-monitoring"
import { getUserFacingMessage } from "@/lib/errors"

interface ErrorBoundaryProps {
  children: React.ReactNode
  context?: string
  fallbackTitle?: string
  fallbackMessage?: string
  compact?: boolean
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    reportClientError(error, this.props.context || "render-boundary")
  }

  private reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <ErrorFallback
        title={this.props.fallbackTitle}
        message={
          this.props.fallbackMessage || getUserFacingMessage(this.state.error)
        }
        actionLabel="Reload section"
        onAction={this.reset}
        compact={this.props.compact}
      />
    )
  }
}
