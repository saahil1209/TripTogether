'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'

export function CopyButton({
  value, label = 'Copy', copiedLabel = 'Copied', ...props
}: { value: string; label?: string; copiedLabel?: string } & Omit<ButtonProps, 'onClick' | 'children'>) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Clipboard can be blocked; the raw text is always on screen as a fallback.
      setCopied(false)
    }
  }

  return (
    <Button type="button" onClick={copy} {...props}>
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? copiedLabel : label}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </Button>
  )
}
