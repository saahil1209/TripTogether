import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/cn'

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-paper-deep text-ink-soft',
        emerald: 'bg-emerald-soft text-emerald-deep',
        amber: 'bg-amber-soft text-amber',
        clay: 'bg-clay-soft text-clay',
        sky: 'bg-sky-soft text-sky',
        outline: 'border border-line text-ink-soft',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({
  className, tone, ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />
}
