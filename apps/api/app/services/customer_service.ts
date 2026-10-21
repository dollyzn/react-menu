import db from '@adonisjs/lucid/services/db'

const ACCENTED = 'áàâãäéèêëíìîïóòôõöúùûüç'
const PLAIN = 'aaaaaeeeeiiiiooooouuuuc'
/** Lowercase without Portuguese accents, in SQL and in JS alike. */
const FOLD_SQL = `translate(lower(c.name), '${ACCENTED}', '${PLAIN}')`
const fold = (value: string) =>
  [...value.toLowerCase()].map((ch) => PLAIN[ACCENTED.indexOf(ch)] ?? ch).join('')

export type CustomerSuggestion = {
  id: string
  name: string
  /** Digits with country code (55...). */
  phone: string
  ordersCount: number
  lastOrderAt: string | null
}

/** Customers of a store, for the POS autocomplete. */
export default class CustomerService {
  /**
   * By name (contains, accent/case-insensitive) or by part of the phone
   * (3+ digits). Most recent customers first.
   */
  async search(storeId: string, term: string, limit = 8): Promise<CustomerSuggestion[]> {
    const text = term.trim()
    const digits = text.replace(/\D/g, '')
    if (text.length < 2 && digits.length < 3) return []

    const rows = await db
      .from('customers as c')
      .leftJoin('orders as o', 'o.customer_id', 'c.id')
      .where('c.store_id', storeId)
      .where((match) => {
        match.whereRaw(`${FOLD_SQL} like ?`, [`%${fold(text)}%`])
        if (digits.length >= 3) match.orWhere('c.phone', 'like', `%${digits}%`)
      })
      .groupBy('c.id', 'c.name', 'c.phone')
      .select('c.id', 'c.name', 'c.phone')
      .count('o.id as orders_count')
      .max('o.created_at as last_order_at')
      .orderByRaw('max(o.created_at) desc nulls last')
      .limit(limit)

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      ordersCount: Number(row.orders_count),
      lastOrderAt: row.last_order_at ? new Date(row.last_order_at).toISOString() : null,
    }))
  }
}
