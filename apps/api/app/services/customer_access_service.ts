import { createHash, randomBytes } from 'node:crypto'
import Customer from '#models/customer'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/**
 * Order history across devices without accounts. Customers only give name
 * and phone, so knowing a phone must never reveal its orders. Instead the
 * device that places a customer's first order receives a random token; any
 * device holding it (shared through a link) can list that customer's
 * orders. A device that only knows the phone gets no token.
 */
export default class CustomerAccessService {
  /**
   * Token to hand to the device that just ordered: a new one for a customer
   * without token, the presented one if it is valid, otherwise none.
   */
  async tokenFor(customerId: string | null, presented?: string | null) {
    if (!customerId) return null
    const customer = await Customer.find(customerId)
    if (!customer) return null

    if (!customer.accessTokenHash) {
      const token = `ct_${randomBytes(32).toString('base64url')}`
      // Conditional update: of two first orders at once, only one device wins.
      const updated = await Customer.query()
        .where('id', customer.id)
        .whereNull('accessTokenHash')
        .update({ accessTokenHash: hash(token) })
      if (Number(updated[0] ?? updated) > 0) return token
      await customer.refresh()
    }
    return presented && hash(presented) === customer.accessTokenHash ? presented : null
  }

  async customerFor(storeId: string, token: string | null | undefined) {
    if (!token) return null
    return await Customer.query()
      .where({ storeId, accessTokenHash: hash(token) })
      .first()
  }
}
