'use client'

import { Play } from 'lucide-react'
import { useTransition } from 'react'
import { loadDemoAction } from '@/app/actions'
import { Button } from '@/components/ui/button'

export function LoadDemoButton() {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      size="lg"
      disabled={pending}
      onClick={() => start(() => { void loadDemoAction() })}
    >
      <Play className="size-4" aria-hidden />
      {pending ? 'Building the demo…' : 'Load demo trip'}
    </Button>
  )
}
