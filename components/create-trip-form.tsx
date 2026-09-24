'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { createTripAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { addDays } from '@/lib/dates'
import {
  type CreateTripFormValues, createTripFormSchema, toCreateTripInput,
} from '@/lib/schemas'

function defaultWindow() {
  const today = new Date().toISOString().slice(0, 10)
  const start = addDays(today, 7)
  return { start, end: addDays(start, 30) }
}

export function CreateTripForm() {
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const { start, end } = defaultWindow()

  const form = useForm<CreateTripFormValues>({
    resolver: zodResolver(createTripFormSchema),
    defaultValues: {
      name: '',
      windowStart: start,
      windowEnd: end,
      tripLengthDays: 4,
      responseDeadline: addDays(start, -2),
      people: [{ name: '' }, { name: '' }, { name: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'people' })

  function onSubmit(values: CreateTripFormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await createTripAction(toCreateTripInput(values))
      // A successful create redirects, so anything returned here is a failure.
      if (result && !result.ok) {
        setServerError(result.message ?? 'Something went wrong.')
      }
    })
  }

  const errors = form.formState.errors
  const peopleError =
    errors.people?.message
    ?? errors.people?.root?.message
    ?? (Array.isArray(errors.people) ? errors.people.find(Boolean)?.name?.message : undefined)

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Card>
        <CardBody className="space-y-5">
          <Field
            label="What are you calling this trip?"
            htmlFor="name"
            hint="Whatever the group chat calls it is fine."
            error={errors.name?.message}
          >
            <Input id="name" placeholder="Goa? Gokarna? Somewhere." {...form.register('name')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rough window starts" htmlFor="windowStart" error={errors.windowStart?.message}>
              <Input id="windowStart" type="date" {...form.register('windowStart')} />
            </Field>
            <Field label="and ends" htmlFor="windowEnd" error={errors.windowEnd?.message}>
              <Input id="windowEnd" type="date" {...form.register('windowEnd')} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="How many days?"
              htmlFor="tripLengthDays"
              hint="Including travel days."
              error={errors.tripLengthDays?.message}
            >
              <Input
                id="tripLengthDays"
                type="number"
                min={2}
                max={21}
                {...form.register('tripLengthDays', { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="Responses needed by"
              htmlFor="responseDeadline"
              hint="Results can be published once this passes."
              error={errors.responseDeadline?.message}
            >
              <Input id="responseDeadline" type="date" {...form.register('responseDeadline')} />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <Field
            label="Who's coming?"
            hint="You first. Everyone picks their own name from this list — no accounts, no emails."
            error={peopleError}
          >
            <ul className="space-y-2">
              {fields.map((field, index) => (
                <li key={field.id} className="flex items-center gap-2">
                  <Input
                    aria-label={index === 0 ? 'Your name' : `Person ${index + 1}`}
                    placeholder={index === 0 ? 'Your name' : `Person ${index + 1}`}
                    {...form.register(`people.${index}.name` as const)}
                  />
                  {fields.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="shrink-0 rounded-full p-2 text-ink-muted transition-colors hover:bg-paper-deep hover:text-clay"
                      aria-label={index === 0 ? 'Remove your name' : `Remove person ${index + 1}`}
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Field>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ name: '' })}
            disabled={fields.length >= 12}
          >
            <Plus className="size-4" aria-hidden />
            Add someone
          </Button>
        </CardBody>
      </Card>

      {serverError ? (
        <p role="alert" className="rounded-xl bg-clay-soft px-4 py-3 text-sm text-clay">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? 'Creating…' : 'Create the trip and get my link'}
      </Button>
    </form>
  )
}
