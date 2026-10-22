import { test } from '@playwright/test'
import { makeOrder, mockSupabase, signIn } from './support/mockSupabase'
test('shots', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await mockSupabase(page, { orders: [makeOrder(), makeOrder({ id: '22222222-2222-4222-8222-222222222222', orderNumber: 'AURA-20261021-OTHER2', email: 'other@example.com', orderStatus: 'shipped' })] })
  await signIn(page)
  for (const [name, path] of [['orders', '/admin/orders'], ['order', '/admin/orders/11111111-1111-4111-8111-111111111111']]) {
    await page.goto(path); await page.waitForTimeout(1500)
    await page.screenshot({ path: `C:/Users/azema/AppData/Local/Temp/a2-${name}.png` })
  }
})
