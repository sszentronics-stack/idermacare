import { expect, test } from '@playwright/test'
import { makeOrder, mockSupabase } from './support/mockSupabase'

test.describe('storefront basics', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page)
  })

  test('header has Blog and the three social links, on a white page', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('.ssz-header')
    await expect(header.getByRole('link', { name: 'Blog', exact: true })).toBeVisible()
    await expect(header.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/idermacare.pk/')
    await expect(header.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', 'https://www.facebook.com/idermacare.pk')
    await expect(header.getByRole('link', { name: 'TikTok' })).toHaveAttribute('href', 'https://www.tiktok.com/@idermacare.pk')
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(bg).toBe('rgb(255, 255, 255)')
  })

  test('blog lists posts and opens one', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.getByRole('heading', { name: 'The iDermaCare Blog' })).toBeVisible()
    await page.getByRole('link', { name: /Pimple Patches 101/ }).first().click()
    await expect(page).toHaveURL(/\/blog\/pimple-patch-guide$/)
    await expect(page.getByRole('heading', { name: /Pimple Patches 101/ })).toBeVisible()
    await page.getByRole('link', { name: /All posts/ }).click()
    await expect(page).toHaveURL(/\/blog$/)
  })

  test('an unknown blog post says so instead of breaking', async ({ page }) => {
    await page.goto('/blog/does-not-exist')
    await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible()
  })

  test('brand name in the footer is iDermaCare with the sales email', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.locator('footer')).toContainText('sales@idermacare.com')
    await expect(page.locator('footer')).not.toContainText('sszentraders')
  })
})

test.describe('track your order', () => {
  test('shows the timeline with dates for a matching order', async ({ page }) => {
    const order = makeOrder({
      orderStatus: 'shipped',
      history: [
        { status: 'pending', at: '2026-10-21T07:29:20.000Z', note: null },
        { status: 'confirmed', at: '2026-10-21T07:37:00.000Z', note: null },
        { status: 'processing', at: '2026-10-21T08:00:00.000Z', note: null },
        { status: 'packed', at: '2026-10-21T09:00:00.000Z', note: null },
        { status: 'shipped', at: '2026-10-22T09:00:00.000Z', note: null },
      ],
      tracking: { courier: 'leopards', trackingNumber: 'LP123456', status: 'in_transit' },
    })
    await mockSupabase(page, { orders: [order] })
    await page.goto('/track-order')
    await page.locator('#track-number').fill('aura-20261021-test01')
    await page.locator('#track-email').fill('buyer@example.com')
    await page.getByRole('button', { name: 'Track order' }).click()

    const timeline = page.getByRole('region', { name: 'Order progress' })
    await expect(timeline).toBeVisible()
    await expect(timeline.getByText('On its way')).toBeVisible()
    await expect(timeline.locator('.is-done')).toHaveCount(5)
    await expect(timeline.locator('.is-current')).toContainText('On its way')
    await expect(timeline.getByText('Delivered', { exact: true })).toBeVisible()
    await expect(timeline).toContainText('LP123456')
    await expect(page.getByText('Hero Mighty Patch Invisible+ — 39 patches × 1')).toBeVisible()
  })

  test('a wrong email does not reveal the order', async ({ page }) => {
    await mockSupabase(page, { orders: [makeOrder()] })
    await page.goto('/track-order')
    await page.locator('#track-number').fill('AURA-20261021-TEST01')
    await page.locator('#track-email').fill('someone-else@example.com')
    await page.getByRole('button', { name: 'Track order' }).click()
    await expect(page.getByRole('alert')).toContainText('No order matches')
    await expect(page.getByRole('region', { name: 'Order progress' })).toHaveCount(0)
    await expect(page.getByText('Hero Mighty Patch')).toHaveCount(0)
  })

  test('a cancelled order says so', async ({ page }) => {
    await mockSupabase(page, { orders: [makeOrder({ orderStatus: 'cancelled' })] })
    await page.goto('/track-order')
    await page.locator('#track-number').fill('AURA-20261021-TEST01')
    await page.locator('#track-email').fill('buyer@example.com')
    await page.getByRole('button', { name: 'Track order' }).click()
    await expect(page.getByText('This order was cancelled.')).toBeVisible()
  })
})
