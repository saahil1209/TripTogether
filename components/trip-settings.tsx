'use client'

import { AlertTriangle, Check, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  addParticipantAction, removeParticipantAction, renameParticipantAction,
  updateTripSettingsAction,
} from '@/app/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, SectionTitle } from '@/components/ui/card'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/field'
import { cn } from '@/lib/cn'

export interface SettingsPerson {
  id: string
  name: string
  hasResponded: boolean
}

export interface SettingsValues {
  name: string
  windowStart: string
  windowEnd: string
  tripLengthDays: number
  responseDeadline: string | null
  decisionDeadline: string | null
}

export function TripSettings({
  organizerCode,
  initial,
  people,
  locked,
  published,
}: {
  organizerCode: string
  initial: SettingsValues
  people: SettingsPerson[]
  locked: boolean
  published: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl">Trip settings</h2>
            <p className="mt-1 text-ink-soft">
              Change the dates, the length or who’s coming. Everything recalculates.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
            <Settings2 className="size-4" aria-hidden />
            {open ? 'Done' : 'Edit'}
          </Button>
        </div>

        {locked ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            The decision is locked, so the trip can’t be changed. Unlock it on the decision page
            first — that’s deliberate: a locked decision shouldn’t move because someone edited a date.
          </p>
        ) : null}

        {open && !locked ? (
          <div className="mt-6 space-y-8">
            <SettingsForm
              organizerCode={organizerCode}
              initial={initial}
              published={published}
              onSaved={() => router.refresh()}
            />
            <PeopleEditor
              organizerCode={organizerCode}
              people={people}
              published={published}
              onChanged={() => router.refresh()}
            />
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------- the trip */

function SettingsForm({
  organizerCode, initial, published, onSaved,
}: {
  organizerCode: string
  initial: SettingsValues
  published: boolean
  onSaved: () => void
}) {
  const [values, setValues] = useState(initial)
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const dirty = JSON.stringify(values) !== JSON.stringify(initial)

  function save() {
    setErrors({})
    setNotice(null)
    start(async () => {
      const result = await updateTripSettingsAction(organizerCode, values)
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setNotice(result.message ?? 'Could not save those changes.')
        return
      }
      const messages: string[] = ['Saved.']
      if (result.unpublished) {
        messages.push('The published results described the old trip, so they’ve been pulled back — publish again when you’re ready.')
      }
      if (result.widened) {
        messages.push('You widened the window. Anyone who already answered never saw the new days, so their availability there is an assumption — worth asking them to revisit.')
      }
      setNotice(messages.join(' '))
      onSaved()
    })
  }

  return (
    <section>
      <SectionTitle>The trip</SectionTitle>
      <div className="mt-3 space-y-4">
        <Field label="Trip name" htmlFor="settings-name" error={errors.name}>
          <Input
            id="settings-name"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Window starts" htmlFor="settings-start" error={errors.windowStart}>
            <Input
              id="settings-start"
              type="date"
              value={values.windowStart}
              onChange={(e) => setValues({ ...values, windowStart: e.target.value })}
            />
          </Field>
          <Field label="and ends" htmlFor="settings-end" error={errors.windowEnd}>
            <Input
              id="settings-end"
              type="date"
              value={values.windowEnd}
              onChange={(e) => setValues({ ...values, windowEnd: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Trip length, in days"
            htmlFor="settings-length"
            error={errors.tripLengthDays}
          >
            <Input
              id="settings-length"
              type="number"
              min={2}
              max={21}
              value={values.tripLengthDays}
              onChange={(e) =>
                setValues({ ...values, tripLengthDays: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field
            label="Responses needed by"
            htmlFor="settings-response-deadline"
            hint="Results can be published once this passes, even if someone hasn’t answered."
            error={errors.responseDeadline}
          >
            <Input
              id="settings-response-deadline"
              type="date"
              value={values.responseDeadline ?? ''}
              onChange={(e) =>
                setValues({ ...values, responseDeadline: e.target.value || null })
              }
            />
          </Field>
        </div>

        <Field
          label="Reactions freeze on"
          htmlFor="settings-decision-deadline"
          hint="Optional. After this date nobody can change their reaction, so the decision stops drifting."
          error={errors.decisionDeadline}
        >
          <Input
            id="settings-decision-deadline"
            type="date"
            value={values.decisionDeadline ?? ''}
            onChange={(e) =>
              setValues({ ...values, decisionDeadline: e.target.value || null })
            }
          />
        </Field>

        {published && dirty ? (
          <p className="flex items-start gap-2 rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Results are published. Changing the dates or length pulls them back, because they
            would no longer describe this trip.
          </p>
        ) : null}

        {notice ? (
          <p
            role="status"
            className={cn(
              'rounded-xl px-4 py-3 text-sm',
              Object.keys(errors).length > 0
                ? 'bg-clay-soft text-clay'
                : 'bg-emerald-soft text-emerald-deep',
            )}
          >
            {notice}
          </p>
        ) : null}

        <Button onClick={save} disabled={pending || !dirty}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- the people */

function PeopleEditor({
  organizerCode, people, published, onChanged,
}: {
  organizerCode: string
  people: SettingsPerson[]
  published: boolean
  onChanged: () => void
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  function add() {
    if (!newName.trim()) return
    setError(null)
    start(async () => {
      const result = await addParticipantAction(organizerCode, newName)
      if (result.ok) {
        setNewName('')
        onChanged()
      } else setError(result.message ?? 'Could not add them.')
    })
  }

  function rename(id: string) {
    setError(null)
    start(async () => {
      const result = await renameParticipantAction(organizerCode, id, editName)
      if (result.ok) {
        setEditing(null)
        onChanged()
      } else setError(result.message ?? 'Could not rename them.')
    })
  }

  return (
    <section className="border-t border-line-soft pt-6">
      <SectionTitle>Who’s coming</SectionTitle>

      <ul className="mt-3 space-y-2">
        {people.map((person) => (
          <li
            key={person.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3.5 py-2.5"
          >
            {editing === person.id ? (
              <>
                <Input
                  aria-label={`New name for ${person.name}`}
                  className="flex-1"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') rename(person.id)
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
                <Button size="sm" onClick={() => rename(person.id)} disabled={pending}>
                  <Check className="size-4" aria-hidden />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  <X className="size-4" aria-hidden />
                  <span className="sr-only">Cancel</span>
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-ink">{person.name}</span>
                {person.hasResponded ? (
                  <Badge tone="emerald">Responded</Badge>
                ) : (
                  <Badge tone="neutral">Waiting</Badge>
                )}
                <button
                  type="button"
                  aria-label={`Rename ${person.name}`}
                  onClick={() => { setEditing(person.id); setEditName(person.name) }}
                  className="rounded-full p-2 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <RemovePersonButton
                  organizerCode={organizerCode}
                  person={person}
                  published={published}
                  disabled={people.length <= 2}
                  onRemoved={onChanged}
                />
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Field className="flex-1" label="Add someone" htmlFor="new-participant">
          <Input
            id="new-participant"
            value={newName}
            placeholder="Their name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          />
        </Field>
        <Button variant="outline" onClick={add} disabled={pending || !newName.trim()}>
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      </div>

      {published ? (
        <p className="mt-3 text-sm text-ink-muted">
          Adding or removing someone pulls the published results back — they were built from a
          different group.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-clay-soft px-4 py-3 text-sm text-clay">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function RemovePersonButton({
  organizerCode, person, published, disabled, onRemoved,
}: {
  organizerCode: string
  person: SettingsPerson
  published: boolean
  disabled: boolean
  onRemoved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Remove ${person.name} from the trip`}
          className="rounded-full p-2 text-ink-muted transition-colors hover:bg-clay-soft hover:text-clay disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-muted"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Remove {person.name}?</DialogTitle>
        <DialogDescription>
          {person.hasResponded
            ? `Their answers and reactions go with them, and every option is recalculated without their constraints. If they come back, they'll have to fill the form in again.`
            : `They'll be taken off the list. Nothing else changes.`}
          {published ? ' The published results will be pulled back.' : ''}
        </DialogDescription>

        {error ? <p role="alert" className="mt-4 text-sm text-clay">{error}</p> : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="ghost">Keep them</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await removeParticipantAction(organizerCode, person.id)
                if (result.ok) {
                  setOpen(false)
                  onRemoved()
                } else setError(result.message ?? 'Could not remove them.')
              })
            }
          >
            <Trash2 className="size-4" aria-hidden />
            {pending ? 'Removing…' : `Remove ${person.name}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
