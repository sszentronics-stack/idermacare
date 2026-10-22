import { expect, test } from '@playwright/test'
import { makeOrder, mockSupabase, signIn } from './support/mockSupabase'

/** Everything here runs at iPhone width (390px) with touch, like a real shopper's phone. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const STOREFRONT_PAGES = ['/', '/shop', '/blog', '/blog/pimple-patch-guide', '/track-order', '/about', '/contact', '/cart', '/login', '/register', '/shipping']

async function tooWide(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

test.describe('storefront on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page)
  })

  for (const path of STOREFRONT_PAGES) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await page.goto(path)
      await page.waitForTimeout(800)
      expect(await tooWide(page)).toBeLessThanOrEqual(0)
    })
  }

  test('header and footer controls are big enough to tap (44px)', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(800)
    const small = await page.evaluate(() => {
      const bad: string[] = []
      const check = (selector: string) =>
        document.querySelectorAll(selector).forEach((el) => {
          const r = el.getBoundingClientRect()
          if (r.width > 0 && r.height > 0 && (r.height < 43.5 || r.width < 43.5)) {
            bad.push(`${selector} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}"`)
          }
        })
      check('.ssz-header .ssz-icon-btn')
      check('.ssz-logo')
      check('.ssz-footer li a')
      return bad
    })
    expect(small).toEqual([])
  })

  test('slide dots have a bigger invisible tap area', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(800)
    const area = await page.locator('.ssz-banner__dot').first().evaluate((el) => {
      const after = getComputedStyle(el, '::after')
      return { content: after.content, height: parseFloat(after.height) }
    })
    expect(area.content).not.toBe('none')
    expect(area.height).toBeGreaterThanOrEqual(40)
  })

  test('the menu opens and links are easy to reach', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open menu' }).click()
    const drawer = page.getByRole('navigation', { name: 'Mobile' })
    for (const name of ['Home', 'Shop', 'Blog', 'About us', 'Contact', 'Account']) {
      const link = drawer.getByRole('link', { name, exact: true })
      await expect(link).toBeVisible()
      const box = await link.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(40)
    }
    await expect(drawer.getByRole('link', { name: 'Instagram' })).toBeVisible()
  })

  test('form fields are 16px so iPhones do not zoom in', async ({ page }) => {
    await page.goto('/track-order')
    const sizes = await page.locator('main input').evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)))
    expect(sizes.length).toBeGreaterThan(0)
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16)
  })

  test('checkout shows a compact Step x of 5 bar', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'aura-beauty-cart',
        JSON.stringify([{ id: 'local:8dc8bc31-15c2-4524-85d8-51e8d2b21d31', variantId: '8dc8bc31-15c2-4524-85d8-51e8d2b21d31', local: true, slug: 'hero', name: 'Hero Mighty Patch Invisible+', price: 3999, qty: 1 }]),
      )
    })
    await page.goto('/checkout')
    const bar = page.locator('.ssz-stepbar')
    await expect(bar).toBeVisible()
    await expect(bar).toContainText('Step 1 of 5')
    await expect(bar).toContainText('Contact')
    // The wide desktop list of steps is hidden on a phone.
    await expect(page.getByRole('list', { name: 'Checkout progress' })).toBeHidden()
    expect(await tooWide(page)).toBeLessThanOrEqual(0)
  })

  test('the floating WhatsApp button leaves room under the page content', async ({ page }) => {
    await page.goto('/contact')
    const pad = await page.locator('main').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom))
    expect(pad).toBeGreaterThanOrEqual(64)
  })
})

test.describe('admin on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page, {
      orders: [makeOrder(), makeOrder({ id: '22222222-2222-4222-8222-222222222222', orderNumber: 'AURA-20261021-OTHER2', email: 'other@example.com', orderStatus: 'shipped' })],
    })
    await signIn(page)
  })

  test('the top bar stays slim on short pages', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.getByRole('link', { name: 'AURA-20261021-TEST01' })).toBeVisible()
    const height = await page.locator('.admin-sidebar').evaluate((el) => el.getBoundingClientRect().height)
    expect(height).toBeLessThan(100)
  })

  test('the brand logo letter is visible on its green square', async ({ page }) => {
    await page.goto('/admin/orders')
    const mark = page.locator('.admin-brand-mark')
    await expect(mark).toHaveText('i')
    const color = await mark.evaluate((el) => getComputedStyle(el).color)
    expect(color).toBe('rgb(255, 255, 255)')
  })

  test('the orders list shows order, customer email, total and status without sideways scrolling', async ({ page }) => {
    await page.goto('/admin/orders')
    const row = page.locator('tbody tr').first()
    await expect(row).toContainText('AURA-20261021-TEST01')
    await expect(row).toContainText('buyer@example.com')
    await expect(row).toContainText('Rs.4,600')
    await expect(row).toContainText(/pending/i)
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Payment' })).toBeHidden()
    const tableOverflow = await page.locator('.admin-table-wrap').evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(tableOverflow).toBeLessThanOrEqual(1)
  })

  test('order buttons are large and in tidy rows', async ({ page }) => {
    await page.goto('/admin/orders/11111111-1111-4111-8111-111111111111')
    await expect(page.getByRole('heading', { name: /Order AURA/ })).toBeVisible()
    const buttons = page.locator('.admin-header-actions .admin-btn')
    expect(await buttons.count()).toBeGreaterThanOrEqual(3)
    for (const height of await buttons.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) {
      expect(height).toBeGreaterThanOrEqual(43.5)
      expect(height).toBeLessThan(70) // labels fit on one line
    }
    expect(await tooWide(page)).toBeLessThanOrEqual(0)
  })

  test('the website content editor fits the phone', async ({ page }) => {
    await page.goto('/admin/content')
    await expect(page.getByRole('heading', { name: 'Website content' })).toBeVisible()
    expect(await tooWide(page)).toBeLessThanOrEqual(0)
    const tabHeight = await page.locator('.cms-tab').first().evaluate((el) => el.getBoundingClientRect().height)
    expect(tabHeight).toBeGreaterThanOrEqual(43.5)
  })
})
