import * as React from 'react'
import { cn } from '@/lib/cn'

export function Field({
  label, hint, error, htmlFor, children, className,
}: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-clay">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-ink placeholder:text-ink-muted/70 transition-colors focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClass, className)} {...props} />
  },
)

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(inputClass, 'appearance-none pr-8', className)} {...props} />
  },
)
