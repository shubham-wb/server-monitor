import * as ToastPrimitives from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitives.Provider
const ToastViewport = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>) => (
  <ToastPrimitives.Viewport
    className={cn('fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]', className)}
    {...props}
  />
)

const Toast = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>) => (
  <ToastPrimitives.Root
    className={cn(
      'group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border border-white/10 bg-[#0d1117] p-4 pr-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
      className
    )}
    {...props}
  />
)

const ToastClose = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>) => (
  <ToastPrimitives.Close
    className={cn('absolute right-1 top-1 rounded-md p-1 text-gray-500 opacity-0 transition-opacity hover:text-gray-200 focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100', className)}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
)

const ToastTitle = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>) => (
  <ToastPrimitives.Title className={cn('text-sm font-semibold text-gray-100', className)} {...props} />
)

const ToastDescription = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>) => (
  <ToastPrimitives.Description className={cn('text-xs text-gray-500', className)} {...props} />
)

export { ToastProvider, ToastViewport, Toast, ToastClose, ToastTitle, ToastDescription }
