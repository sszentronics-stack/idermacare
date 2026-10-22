import { expect, test } from '@playwright/test'
import { makeOrder, mockSupabase, signIn } from './support/mockSupabase'

test.describe('admin access', () => {
  test('a visitor who is not signed in is sent to the sign-in page', async ({ page }) => {
    await mockSupabase(page)
    await page.goto('/admin/orders')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })

  test('a signed-in customer who is not an admin is turned away', async ({ page }) => {
    await mockSupabase(page, { isAdmin: false })
    await signIn(page)
    await page.goto('/admin/orders')
    await expect(page.getByText(/limited to iDermaCare staff/i)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Orders' })).toHaveCount(0)
  })
})

test.describe('admin navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page, { orders: [makeOrder()] })
    await signIn(page)
  })

  test('shows the brand, every main group and plain-language links', async ({ page }) => {
    await page.goto('/admin')
    const sidebar = page.locator('.admin-sidebar')
    await expect(sidebar).toContainText('iDermaCare')
    await expect(sidebar).toContainText('Store admin')
    for (const group of ['Sell', 'Products', 'Website']) {
      await expect(sidebar.locator('.admin-nav-section-label', { hasText: group })).toBeVisible()
    }
    for (const link of ['Dashboard', 'Orders', 'Customers', 'Products', 'Stock levels', 'Website content', 'Offers & coupons']) {
      await expect(sidebar.getByRole('link', { name: link, exact: true })).toBeVisible()
    }
    // Rarely used tools stay tucked away until asked for.
    await expect(sidebar.getByRole('link', { name: 'Activity log' })).toHaveCount(0)
    await sidebar.getByRole('button', { name: /More tools/ }).click()
    await expect(sidebar.getByRole('link', { name: 'Activity log' })).toBeVisible()
  })

  test('uses a white and green look', async ({ page }) => {
    await page.goto('/admin')
    const sidebarBg = await page.locator('.admin-sidebar').evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(sidebarBg).toBe('rgb(255, 255, 255)')
    await page.getByRole('link', { name: 'Orders', exact: true }).click()
    const active = page.locator('.admin-nav a.active')
    await expect(active).toHaveText('Orders')
    const activeBg = await active.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(activeBg).toBe('rgb(44, 110, 73)')
  })

  test('opening a page from the menu changes the page and highlights the link', async ({ page }) => {
    await page.goto('/admin')
    await page.getByRole('link', { name: 'Website content', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/content$/)
    await expect(page.getByRole('heading', { name: 'Website content' })).toBeVisible()
    await expect(page.locator('.admin-nav a.active')).toHaveText('Website content')
  })

  test('on a phone the menu hides behind a Menu button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/admin')
    await expect(page.getByRole('link', { name: 'Orders', exact: true })).toBeHidden()
    await page.getByRole('button', { name: 'Menu' }).click()
    await expect(page.getByRole('link', { name: 'Orders', exact: true })).toBeVisible()
  })
})

test.describe('admin orders', () => {
  test('lists orders and finds one by search', async ({ page }) => {
    await mockSupabase(page, {
      orders: [makeOrder(), makeOrder({ id: '22222222-2222-4222-8222-222222222222', orderNumber: 'AURA-20261021-OTHER2', email: 'other@example.com' })],
    })
    await signIn(page)
    await page.goto('/admin/orders')
    await expect(page.getByRole('link', { name: 'AURA-20261021-TEST01' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'AURA-20261021-OTHER2' })).toBeVisible()
    await page.getByPlaceholder(/Search order/).fill('other@')
    await expect(page.getByRole('link', { name: 'AURA-20261021-TEST01' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'AURA-20261021-OTHER2' })).toBeVisible()
  })

  test('walks an order from pending to delivered, one step at a time', async ({ page }) => {
    const backend = await mockSupabase(page, { orders: [makeOrder()] })
    await signIn(page)
    await page.goto('/admin/orders')
    await page.getByRole('link', { name: 'AURA-20261021-TEST01' }).click()
    await expect(page.getByRole('heading', { name: 'Order AURA-20261021-TEST01' })).toBeVisible()

    const steps: [string, string][] = [
      ['Confirm order', 'confirmed'],
      ['Start processing', 'processing'],
      ['Mark packed', 'packed'],
      ['Ready for pickup', 'ready_for_pickup'],
      ['Mark shipped', 'shipped'],
      ['Mark delivered', 'delivered'],
    ]
    for (const [label, status] of steps) {
      await page.locator('.admin-header-actions').getByRole('button', { name: label, exact: true }).click()
      // The confirmation dialog warns that the customer is emailed.
      const dialog = page.getByRole('dialog')
      await expect(dialog).toContainText('The customer is emailed')
      await dialog.getByRole('button', { name: label, exact: true }).click()
      await expect(page.locator('.admin-header-actions .admin-pill, .admin-header-actions [class*="pill"]').first()).toBeVisible()
      await expect.poll(() => backend.orders[0].orderStatus).toBe(status)
    }

    const sent = backend.calls.filter((call) => call.path.endsWith('/status')).map((call) => (call.body as { status: string }).status)
    expect(sent).toEqual(steps.map(([, status]) => status))
    // Nothing is left to do once the order is delivered.
    await expect(page.locator('.admin-header-actions').getByRole('button', { name: /Mark|Confirm|Start|Ready/ })).toHaveCount(0)
  })

  test('cancelling the dialog does not change the order', async ({ page }) => {
    const backend = await mockSupabase(page, { orders: [makeOrder()] })
    await signIn(page)
    await page.goto('/admin/orders/11111111-1111-4111-8111-111111111111')
    await page.locator('.admin-header-actions').getByRole('button', { name: 'Confirm order', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(backend.calls.filter((call) => call.path.endsWith('/status'))).toHaveLength(0)
    expect(backend.orders[0].orderStatus).toBe('pending')
  })

  test('prints an invoice with prices and a packing slip without them', async ({ page }) => {
    await mockSupabase(page, { orders: [makeOrder({ orderStatus: 'packed' })] })
    await signIn(page)
    await page.addInitScript(() => {
      ;(window as unknown as { printed: number }).printed = 0
      window.print = () => {
        ;(window as unknown as { printed: number }).printed += 1
      }
    })
    await page.goto('/admin/orders/11111111-1111-4111-8111-111111111111')
    const sheet = page.locator('.print-sheet')

    await page.getByRole('button', { name: 'Print invoice' }).click()
    await expect(sheet).toContainText('Invoice')
    await expect(sheet).toContainText('Total to collect')
    await expect(sheet).toContainText('Rs.4,600')
    await expect(sheet).toContainText('Test Buyer')

    await page.getByRole('button', { name: 'Print packing slip' }).click()
    await expect(sheet).toContainText('Packing slip')
    await expect(sheet).not.toContainText('Rs.4,600')
    await expect(sheet).toContainText('Hero Mighty Patch Invisible+')

    await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(2)
  })
})

test.describe('website content editor', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page)
    await signIn(page)
  })

  test('lists the parts of the website in plain language', async ({ page }) => {
    await page.goto('/admin/content')
    const tabs = page.getByRole('navigation', { name: 'Website parts' })
    for (const name of ['Shop details', 'Top message bar', 'Home page banners', 'Product videos', 'About page', 'Policies']) {
      await expect(tabs.getByRole('button', { name })).toBeVisible()
    }
    await tabs.getByRole('button', { name: 'About page' }).click()
    await expect(page.getByRole('heading', { name: 'About page' }).last()).toBeVisible()
  })

  test('tracks unsaved changes, saves them, and sends the new text to the database', async ({ page }) => {
    const backend = await mockSupabase(page)
    await page.goto('/admin/content')
    const status = page.locator('.cms-savebar-status')
    await expect(status).toHaveText('All changes saved.')
    const save = page.getByRole('button', { name: 'Save changes' })
    await expect(save).toBeDisabled()

    const name = page.getByLabel('Shop name')
    await name.fill('iDermaCare Pakistan')
    await expect(status).toHaveText('You have unsaved changes.')
    await expect(save).toBeEnabled()

    await page.getByLabel(/Bank \/ JazzCash/).fill('Bank: Test Bank\nTitle: iDermaCare\nIBAN: PK00TEST0000000000000000')
    await save.click()

    await expect(status).toHaveText('All changes saved.')
    await expect(save).toBeDisabled()
    const upsert = backend.calls.find((call) => call.path === '/rest/v1/site_content')
    expect(upsert, 'the editor should save to site_content').toBeTruthy()
    const document = (upsert!.body as { document: { business: { name: string; paymentInstructions: string } } }).document
    expect(document.business.name).toBe('iDermaCare Pakistan')
    expect(document.business.paymentInstructions).toContain('IBAN: PK00TEST')
  })

  test('adds a banner and can remove it again', async ({ page }) => {
    await page.goto('/admin/content')
    await page.getByRole('navigation', { name: 'Website parts' }).getByRole('button', { name: 'Home page banners' }).click()
    const before = await page.locator('.cms-item').count()
    await page.getByRole('button', { name: 'Add banner' }).click()
    await expect(page.locator('.cms-item')).toHaveCount(before + 1)
    await expect(page.locator('.cms-savebar-status')).toHaveText('You have unsaved changes.')
    await page.locator('.cms-item').last().getByRole('button', { name: 'Remove' }).first().click()
    await expect(page.locator('.cms-item')).toHaveCount(before)
  })
})
