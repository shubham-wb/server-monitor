import { useEffect } from 'react'
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose } from '@/components/ui/toast'
import { useToast, setGlobalToast } from '@/hooks/use-toast'

export function Toaster() {
  const { toasts, toast, dismiss } = useToast()

  useEffect(() => {
    setGlobalToast(toast)
  }, [toast])

  return (
    <ToastProvider>
      {toasts.map(t => (
        <Toast key={t.id} onOpenChange={open => !open && dismiss(t.id)}>
          <div className="grid gap-1">
            <ToastTitle>{t.title}</ToastTitle>
            {t.description && <ToastDescription>{t.description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
