import { useState, useCallback } from 'react'

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

let toastCallbacks: ((toast: Toast) => void)[] = []

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    const newToast = { ...t, id }
    setToasts(prev => [...prev, newToast])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
    toastCallbacks.forEach(cb => cb(newToast))
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, toast, dismiss }
}

// Simple global toast — works without a provider for quick calls
let globalToast: ((t: Omit<Toast, 'id'>) => void) | null = null

export function setGlobalToast(fn: (t: Omit<Toast, 'id'>) => void) {
  globalToast = fn
}

export function toast(t: Omit<Toast, 'id'>) {
  globalToast?.(t)
}
