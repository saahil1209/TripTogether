import { FitBadge } from '@/components/fit-badge'
import { cn } from '@/lib/cn'
import type { PersonFit } from '@/lib/recommendations'
import { rupees } from '@/lib/format'
import { CITY_LABELS } from '@/lib/types'

/**
 * Where each person stands, on one option. The point of the whole product: no
 * score is allowed to stand in for this.
 */
export function AlignmentMatrix({
  fits,
  youId,
  className,
}: {
  fits: PersonFit[]
  youId?: string | null
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-line', className)}>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Every participant’s fit with this option, with the main reason
        </caption>
        <thead>
          <tr className="bg-paper-deep text-xs uppercase tracking-[0.1em] text-ink-muted">
            <th scope="col" className="px-4 py-2.5 font-semibold">Person</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Fit</th>
            <th scope="col" className="hidden px-4 py-2.5 font-semibold sm:table-cell">Why</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft bg-card">
          {fits.map((fit) => (
            <tr key={fit.participantId} className={fit.participantId === youId ? 'bg-emerald-soft/40' : undefined}>
              <th scope="row" className="px-4 py-3.5 align-top font-medium text-ink">
                <span className="block">
                  {fit.name}
                  {fit.participantId === youId ? (
                    <span className="ml-1.5 text-xs font-normal text-emerald">{'· you'}</span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs font-normal text-ink-muted">
                  {CITY_LABELS[fit.fromCity]} · {fit.routeLabel}
                </span>
              </th>
              <td className="px-4 py-3.5 align-top">
                <FitBadge status={fit.status} />
                <span className="mt-1 block text-xs text-ink-muted">
                  ≈{rupees(fit.cost)} all-in
                </span>
              </td>
              <td className="hidden px-4 py-3.5 align-top text-sm text-ink-soft sm:table-cell">
                {fit.mainReason}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* The "why" column is hidden on narrow screens, so it reappears here. */}
      <ul className="divide-y divide-line-soft bg-card sm:hidden">
        {fits.map((fit) => (
          <li key={fit.participantId} className="px-4 py-3 text-sm text-ink-soft">
            <span className="font-medium text-ink">{fit.name}:</span> {fit.mainReason}
          </li>
        ))}
      </ul>
    </div>
  )
}
