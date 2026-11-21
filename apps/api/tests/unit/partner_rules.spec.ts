import { test } from '@japa/runner'
import OrderStatus from '#enums/order_status'
import PartnerCancelPolicy from '#enums/partner_cancel_policy'
import PartnerCommissionType from '#enums/partner_commission_type'
import { partnerCancelOption } from '#partners/cancel_policy'
import { commissionFor } from '#partners/commission'

test.group('commissionFor', () => {
  test('percent of the subtotal, to the cent', ({ assert }) => {
    const rule = { type: PartnerCommissionType.PERCENT, value: 10 }
    assert.equal(commissionFor(rule, { subtotal: 45, units: 3 }), 4.5)
    assert.equal(commissionFor(rule, { subtotal: 100.05, units: 1 }), 10.01)
    assert.equal(commissionFor({ ...rule, value: 12.5 }, { subtotal: 33.3, units: 2 }), 4.16)
    assert.equal(commissionFor(rule, { subtotal: 0, units: 0 }), 0)
  })

  test('a fixed value for each unit', ({ assert }) => {
    const rule = { type: PartnerCommissionType.PER_UNIT, value: 1.5 }
    assert.equal(commissionFor(rule, { subtotal: 80, units: 4 }), 6)
    assert.equal(commissionFor({ ...rule, value: 0.1 }, { subtotal: 10, units: 3 }), 0.3)
  })
})

test.group('partnerCancelOption', () => {
  const unpaid = { status: OrderStatus.PENDING_PAYMENT, amountPaid: 0 }
  const at = (status: OrderStatus) => ({ status, amountPaid: 20 })

  test('an unpaid order can always be dropped', ({ assert }) => {
    for (const policy of Object.values(PartnerCancelPolicy)) {
      assert.equal(partnerCancelOption(policy, unpaid), 'cancel')
    }
  })

  test('within the window cancel, past it ask', ({ assert }) => {
    const { NEVER, UNTIL_KITCHEN, UNTIL_READY } = PartnerCancelPolicy
    assert.equal(partnerCancelOption(NEVER, at(OrderStatus.RECEIVED)), 'request')
    assert.equal(partnerCancelOption(UNTIL_KITCHEN, at(OrderStatus.RECEIVED)), 'cancel')
    assert.equal(partnerCancelOption(UNTIL_KITCHEN, at(OrderStatus.PREPARING)), 'request')
    assert.equal(partnerCancelOption(UNTIL_READY, at(OrderStatus.RECEIVED)), 'cancel')
    assert.equal(partnerCancelOption(UNTIL_READY, at(OrderStatus.PREPARING)), 'cancel')
    assert.equal(partnerCancelOption(UNTIL_READY, at(OrderStatus.READY)), 'request')
  })

  test('nothing once handed over or cancelled', ({ assert }) => {
    for (const policy of Object.values(PartnerCancelPolicy)) {
      assert.equal(partnerCancelOption(policy, at(OrderStatus.COMPLETED)), 'none')
      assert.equal(partnerCancelOption(policy, at(OrderStatus.CANCELLED)), 'none')
    }
  })
})
