import { describe, expect, it } from 'vitest'
import {
  InvalidRedemptionError,
  assertRedeemable,
  computeEarnedPoints,
  computeMaxRedeemablePoints,
  computeRedemptionValue,
  sumLedgerBalance,
} from './index.ts'

describe('computeEarnedPoints', () => {
  it('earns 1 point per Rs. 100 (10000 minor units), floored', () => {
    expect(computeEarnedPoints(460000)).toBe(46)
    expect(computeEarnedPoints(469999)).toBe(46)
    expect(computeEarnedPoints(9999)).toBe(0)
  })

  it('returns far less than the money spent (about 1%)', () => {
    const spent = 1000000
    expect(computeRedemptionValue(computeEarnedPoints(spent))).toBe(spent / 100)
  })

  it('never returns negative points for bad input', () => {
    expect(computeEarnedPoints(-500)).toBe(0)
    expect(computeEarnedPoints(NaN)).toBe(0)
  })
})

describe('computeRedemptionValue', () => {
  it('values each point at Rs. 1 (100 minor units)', () => {
    expect(computeRedemptionValue(50)).toBe(5000)
  })

  it('rejects zero/negative/non-integer point counts by returning 0', () => {
    expect(computeRedemptionValue(0)).toBe(0)
    expect(computeRedemptionValue(-10)).toBe(0)
    expect(computeRedemptionValue(1.5)).toBe(0)
  })
})

describe('sumLedgerBalance', () => {
  it('sums signed points across earn/redeem/reversal entries', () => {
    const entries = [{ points: 500 }, { points: -200 }, { points: 200 }, { points: -50 }]
    expect(sumLedgerBalance(entries)).toBe(450)
  })

  it('returns 0 for an empty ledger', () => {
    expect(sumLedgerBalance([])).toBe(0)
  })
})

describe('computeMaxRedeemablePoints', () => {
  it('caps at the lesser of balance and what the subtotal can absorb', () => {
    // balance affords 300 pts, subtotal (10000 minor units) affords 100 pts
    expect(computeMaxRedeemablePoints(300, 10000)).toBe(100)
    // balance affords 30 pts, subtotal affords 100 pts
    expect(computeMaxRedeemablePoints(30, 10000)).toBe(30)
  })

  it('never returns negative for a negative balance', () => {
    expect(computeMaxRedeemablePoints(-20, 10000)).toBe(0)
  })
})

describe('assertRedeemable', () => {
  it('accepts a redemption within limits', () => {
    expect(() => assertRedeemable(50, 100, 10000)).not.toThrow()
  })

  it('rejects a redemption exceeding the balance/subtotal cap', () => {
    expect(() => assertRedeemable(500, 100, 10000)).toThrow(InvalidRedemptionError)
  })

  it('rejects a non-positive or non-integer request', () => {
    expect(() => assertRedeemable(0, 100, 10000)).toThrow(InvalidRedemptionError)
    expect(() => assertRedeemable(-5, 100, 10000)).toThrow(InvalidRedemptionError)
    expect(() => assertRedeemable(1.5, 100, 10000)).toThrow(InvalidRedemptionError)
  })
})
