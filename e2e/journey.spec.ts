import { type Browser, type Page, expect, test } from '@playwright/test'

/**
 * The journey the product exists for: create → share → respond independently →
 * synthesise → compare → lock.
 *
 * Two participants rather than five, because the engine's reasoning is covered
 * exhaustively by the unit tests. What this proves is that the wiring holds:
 * autosave, resume, the no-anchoring rule, publication, reactions and the lock.
 */

const TODAY = new Date()
const iso = (offsetDays: number) =>
  new Date(TODAY.getTime() + offsetDays * 86_400_000).toISOString().slice(0, 10)

/** Fills in the whole core pass for one person and submits it. */
async function answerAs(page: Page, inviteUrl: string, name: string, city: string, budget: string) {
  await page.goto(inviteUrl)

  await expect(page.getByRole('heading', { name: 'Who are you?' })).toBeVisible()
  await page.getByRole('button', { name, exact: true }).click()

  // 1. City
  await expect(page.getByRole('heading', { name: 'Where are you travelling from?' })).toBeVisible()
  await page.getByRole('button', { name: city, exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // 2. Dates — leave everything as "can go".
  await expect(page.getByRole('heading', { name: 'When can you travel?' })).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // 3. Budget
  await expect(page.getByRole('heading', { name: 'What can you spend?' })).toBeVisible()
  await page.getByLabel('My absolute maximum').fill(budget)
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // 4. Vibes
  await expect(page.getByRole('heading', { name: 'What kind of trip?' })).toBeVisible()
  await page.getByRole('button', { name: 'Beach', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // 5. Deal-breakers — none.
  await expect(page.getByRole('heading', { name: 'What would make this a no?' })).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // 6. Review and submit
  await expect(page.getByRole('heading', { name: 'One last look' })).toBeVisible()
  await page.getByRole('button', { name: 'Submit my answers' }).click()

  // The heading uses a typographic apostrophe, so match on the parts that matter.
  await expect(page.getByRole('heading', { name: new RegExp(`you in, ${name}`) })).toBeVisible()
}

/** A separate browser context is a separate person: separate cookies. */
async function asNewPerson(browser: Browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  return { context, page }
}

test('a group goes from an empty form to one locked decision', async ({ page, browser }) => {
  /* ---------------------------------------------------- create the trip --- */
  await page.goto('/')
  await page.getByRole('link', { name: 'Plan a trip' }).click()

  await expect(page.getByRole('heading', { name: 'Set up the trip' })).toBeVisible()
  await page.getByLabel('What are you calling this trip?').fill('The one we actually book')
  await page.getByLabel('Rough window starts').fill(iso(14))
  await page.getByLabel('and ends').fill(iso(44))
  await page.getByLabel('How many days?').fill('4')
  await page.getByLabel('Responses needed by').fill(iso(10))

  await page.getByRole('textbox', { name: 'Your name' }).fill('Riya')
  await page.getByRole('textbox', { name: 'Person 2' }).fill('Karan')
  await page.getByRole('textbox', { name: 'Person 3' }).fill('Aisha')

  await page.getByRole('button', { name: 'Create the trip and get my link' }).click()

  /* --------------------------------------- the organizer gets two links --- */
  await expect(page).toHaveURL(/\/trip\/[A-Z0-9]+\/organizer/)
  await expect(page.getByRole('heading', { name: 'The one we actually book' })).toBeVisible()
  const organizerUrl = page.url()

  const inviteUrl = await page.locator('code').first().innerText()
  expect(inviteUrl).toMatch(/\/join\/[A-Z0-9]+$/)

  // The organizer link must never appear on the page shared with the group.
  const organizerCode = organizerUrl.split('/trip/')[1]!.split('/')[0]!
  expect(inviteUrl).not.toContain(organizerCode)

  await expect(page.getByRole('heading', { name: '0 of 3 responded' })).toBeVisible()
  await expect(page.getByText('Waiting for more responses')).toBeVisible()

  /* --------------------------------------------- everyone answers alone --- */
  const karan = await asNewPerson(browser)
  await answerAs(karan.page, inviteUrl, 'Karan', 'Bengaluru', '30000')

  // No anchoring: a participant sees nothing before the organizer publishes.
  await karan.page.goto(inviteUrl.replace('/join/', '/trip/') + '/results')
  await expect(karan.page.getByRole('heading', { name: 'Not ready yet' })).toBeVisible()
  await expect(karan.page.getByText('Best overall fit')).toHaveCount(0)

  const aisha = await asNewPerson(browser)
  await answerAs(aisha.page, inviteUrl, 'Aisha', 'Pune', '35000')

  /* --------------------------------------------------- autosave + resume --- */
  const riya = await asNewPerson(browser)
  await riya.page.goto(inviteUrl)
  await riya.page.getByRole('button', { name: 'Riya', exact: true }).click()
  await riya.page.getByRole('button', { name: 'Mumbai', exact: true }).click()
  await expect(riya.page.getByText('Saved')).toBeVisible()

  // Closing the tab mid-answer must not lose anything.
  await riya.page.reload()
  await expect(
    riya.page.getByRole('heading', { name: 'Where are you travelling from?' }),
  ).toBeVisible()
  await expect(riya.page.getByRole('button', { name: 'Mumbai', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await riya.page.close()
  await riya.context.close()

  const riyaAgain = await asNewPerson(browser)
  await answerAs(riyaAgain.page, inviteUrl, 'Riya', 'Mumbai', '28000')

  /* ------------------------------------------------- organizer publishes --- */
  await page.goto(organizerUrl)
  await expect(page.getByRole('heading', { name: '3 of 3 responded' })).toBeVisible()
  await expect(page.getByText('Everyone is in')).toBeVisible()

  // The early picture is the organizer's alone until they publish.
  await expect(page.getByRole('heading', { name: 'The full picture' })).toBeVisible()
  await expect(page.getByText('Only you can see this until you publish it.')).toBeVisible()

  await page.getByRole('button', { name: 'Publish results to the group' }).click()
  await expect(page.getByRole('heading', { name: 'Results are with the group' })).toBeVisible()

  /* --------------------------------------------- the group sees options --- */
  const resultsUrl = inviteUrl.replace('/join/', '/trip/') + '/results'
  await karan.page.goto(resultsUrl)
  await expect(karan.page.getByText(/options? work for everyone|option works for everyone/)).toBeVisible()
  await expect(karan.page.getByText('Best overall fit')).toBeVisible()

  // Every person appears on the alignment matrix, with a status.
  const matrix = karan.page.locator('table').first()
  for (const name of ['Riya', 'Karan', 'Aisha']) {
    await expect(matrix.getByRole('rowheader', { name: new RegExp(name) })).toBeVisible()
  }
  await expect(karan.page.getByRole('heading', { name: 'For you' }).first()).toBeVisible()

  /* ------------------------------------------------------ everyone reacts --- */
  const decideUrl = inviteUrl.replace('/join/', '/trip/') + '/decide'
  await karan.page.goto(decideUrl)
  await karan.page.getByRole('button', { name: 'Love it' }).first().click()
  await expect(karan.page.getByText('Your reaction')).toBeVisible()

  // A participant cannot lock the decision.
  await expect(karan.page.getByRole('button', { name: /^Lock in/ })).toHaveCount(0)
  await expect(karan.page.getByText('Waiting on the organizer')).toBeVisible()

  await aisha.page.goto(decideUrl)
  await aisha.page.getByRole('button', { name: 'Happy' }).first().click()

  /* ------------------------------------------------ the organizer locks --- */
  await page.goto(decideUrl)
  await expect(page.getByText('Where the group is landing')).toBeVisible()

  await page.getByRole('button', { name: /^Lock in/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Before you lock this in' })).toBeVisible()
  await page.getByRole('button', { name: /^Yes — we're going to/ }).click()

  /* ----------------------------------------------------- you have a trip --- */
  await expect(page.getByRole('heading', { name: 'You have a trip 🎉' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /doing what/ })).toBeVisible()
  await expect(page.getByText('Book the stay', { exact: true })).toBeVisible()
  await expect(page.getByText("IT'S DECIDED 🎉")).toBeVisible()

  // Decisions stick: reactions are frozen for everyone else too.
  await karan.page.goto(decideUrl)
  await expect(karan.page.getByRole('heading', { name: 'You have a trip 🎉' })).toBeVisible()
  await expect(karan.page.getByRole('button', { name: 'Love it' })).toHaveCount(0)

  await karan.context.close()
  await aisha.context.close()
  await riyaAgain.context.close()
})

test('an invalid invite link says so plainly', async ({ page }) => {
  await page.goto('/join/NOTAREALCODE')
  await expect(page.getByRole('heading', { name: /invite link doesn.t work/ })).toBeVisible()

  await page.goto('/trip/NOTAREALCODE/organizer')
  await expect(page.getByRole('heading', { name: /organizer link doesn.t work/ })).toBeVisible()
})

test('the participant flow works on a phone-sized screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const page = await context.newPage()

  await page.goto('/trip/new')
  await page.getByLabel('What are you calling this trip?').fill('Phone test')
  await page.getByLabel('Rough window starts').fill(iso(14))
  await page.getByLabel('and ends').fill(iso(44))
  await page.getByRole('textbox', { name: 'Your name' }).fill('Riya')
  await page.getByRole('textbox', { name: 'Person 2' }).fill('Karan')
  await page.getByRole('textbox', { name: 'Person 3' }).fill('Aisha')
  await page.getByRole('button', { name: 'Create the trip and get my link' }).click()
  await expect(page).toHaveURL(/\/organizer/)

  // Creating a trip signs the organizer in, so this goes straight into their
  // own form rather than the name picker.
  const inviteUrl = await page.locator('code').first().innerText()
  await page.goto(inviteUrl)
  await expect(page.getByText('Question 1 of 6')).toBeVisible()

  // Nothing overflows the viewport, and the next button stays reachable.
  await expect(page.getByRole('heading', { name: 'Where are you travelling from?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeInViewport()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  await context.close()
})
