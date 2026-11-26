import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import AppException from '#exceptions/app_exception'
import { maskPhone, normalizeBrazilianPhone, phoneFromWaId, phoneVariants } from '#helpers/phone'
import Customer from '#models/customer'
import CustomerLoginChallenge, { LoginMethod } from '#models/customer_login_challenge'
import CustomerSession from '#models/customer_session'
import Order from '#models/order'
import type Store from '#models/store'
import type WhatsAppAccount from '#models/whatsapp_account'
import { MessageKind } from '#models/whatsapp_message'
import WhatsAppAccountService from '#services/whatsapp_account_service'
import WhatsAppMessageService from '#services/whatsapp_message_service'
import env from '#start/env'
import { LOGIN_CODE_MINUTES, TEMPLATES } from '#whatsapp/templates'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/** Codes the customer sends: no 0/O, 1/I/L, 5/S, 8/B, 2/Z to misread. */
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679'
const MESSAGE_CODE_LENGTH = 6
const CHALLENGE_MINUTES = 10
const MAX_ATTEMPTS = 5
/** Codes sent to one phone per 15 minutes (each costs the store a message). */
const SENDS_PER_PHONE = 3
const SESSION_DAYS = 90

function messageCode() {
  return Array.from(
    { length: MESSAGE_CODE_LENGTH },
    () => ALPHABET[randomInt(ALPHABET.length)]
  ).join('')
}

/** Codes we send have 10⁶ values: an HMAC keyed by APP_KEY keeps a leaked row useless. */
function codeHash(challengeId: string, code: string) {
  return createHmac('sha256', env.get('APP_KEY')).update(`${challengeId}:${code}`).digest('hex')
}

function sameHash(a: string, b: string) {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * A customer's order history behind a verified phone (ADR 0025). Customers
 * have no account: proving the phone once (by sending us a code from their
 * WhatsApp, or typing one we sent) opens a session for that store.
 */
@inject()
export default class CustomerLoginService {
  constructor(
    private accounts: WhatsAppAccountService,
    private messages: WhatsAppMessageService
  ) {}

  private async loginAccount(store: Store) {
    const account = await this.accounts.forStore(store.id)
    if (!account || !account.isUsable || !account.customerLogin) {
      throw new AppException(
        'Esta loja não oferece acesso ao histórico pelo WhatsApp.',
        409,
        'E_CUSTOMER_LOGIN_UNAVAILABLE'
      )
    }
    return account
  }

  /**
   * "Entrar pelo WhatsApp": a code for the customer to send us from their
   * phone, and the wa.me link that writes it for them. Their message, from
   * their number, proves the phone.
   */
  async startByMessage(store: Store) {
    const account = await this.loginAccount(store)
    const secret = randomBytes(32).toString('base64url')
    const code = messageCode()
    const challenge = await CustomerLoginChallenge.create({
      storeId: store.id,
      method: LoginMethod.MESSAGE,
      code,
      secretHash: sha256(secret),
      attempts: 0,
      expiresAt: DateTime.now().plus({ minutes: CHALLENGE_MINUTES }),
    })
    const text = `Quero ver meus pedidos na ${store.name}. Código: ${code}`
    return {
      id: challenge.id,
      secret,
      method: LoginMethod.MESSAGE,
      code,
      link: `https://wa.me/${account.waNumber}?text=${encodeURIComponent(text)}`,
      displayPhoneNumber: account.displayPhoneNumber,
      expiresAt: challenge.expiresAt.toISO()!,
    }
  }

  /** "Receber um código": we send the authentication template to the phone typed. */
  async startByCode(store: Store, phoneInput: string) {
    const account = await this.loginAccount(store)
    if (!account.templateApproved(TEMPLATES.LOGIN_CODE)) {
      throw new AppException(
        'O envio de código ainda não está liberado nesta loja. Entre pelo WhatsApp.',
        409,
        'E_CUSTOMER_LOGIN_UNAVAILABLE'
      )
    }
    const phone = normalizeBrazilianPhone(phoneInput)
    if (!phone) throw new AppException('Confira o número de celular.', 422, 'E_PHONE_INVALID')

    const recent = await CustomerLoginChallenge.query()
      .where({ storeId: store.id, method: LoginMethod.CODE })
      .whereIn('phone', phoneVariants(phone))
      .where('createdAt', '>', DateTime.now().minus({ minutes: 15 }).toSQL()!)
      .count('* as total')
      .first()
    if (Number(recent?.$extras.total ?? 0) >= SENDS_PER_PHONE) {
      throw new AppException(
        'Muitos códigos para este número. Espere alguns minutos ou entre pelo WhatsApp.',
        429,
        'E_LOGIN_TOO_MANY'
      )
    }

    const secret = randomBytes(32).toString('base64url')
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const challenge = await CustomerLoginChallenge.create({
      storeId: store.id,
      method: LoginMethod.CODE,
      secretHash: sha256(secret),
      phone,
      attempts: 0,
      expiresAt: DateTime.now().plus({ minutes: LOGIN_CODE_MINUTES }),
    })
    challenge.codeHash = codeHash(challenge.id, code)
    await challenge.save()

    await this.messages.sendCode(account, challenge.id, phone, code)
    return {
      id: challenge.id,
      secret,
      method: LoginMethod.CODE,
      phone: maskPhone(phone),
      expiresAt: challenge.expiresAt.toISO()!,
    }
  }

  /**
   * A message reached the store's number (webhook). When it carries the
   * code of a pending "Entrar pelo WhatsApp", the sender's number is the
   * customer's: the challenge is verified and they get a reply. Any other
   * message is the store's business, ignored here.
   */
  async receiveMessage(account: WhatsAppAccount, from: string | undefined, text: string) {
    if (!from) return false
    const phone = phoneFromWaId(from)
    if (!phone) return false
    const candidates = [
      ...new Set(
        text.toUpperCase().match(new RegExp(`[${ALPHABET}]{${MESSAGE_CODE_LENGTH}}`, 'g'))
      ),
    ]
    if (candidates.length === 0) return false

    const challenge = await CustomerLoginChallenge.query()
      .where({ storeId: account.storeId, method: LoginMethod.MESSAGE })
      .whereIn('code', candidates)
      .whereNull('verifiedAt')
      .where('expiresAt', '>', DateTime.now().toSQL()!)
      .orderBy('createdAt', 'desc')
      .first()
    if (!challenge) return false

    // Conditional: two deliveries of the same webhook verify it once.
    const updated = await CustomerLoginChallenge.query()
      .where('id', challenge.id)
      .whereNull('verifiedAt')
      .update({ verifiedAt: DateTime.now().toJSDate(), phone })
    if (Number(updated[0] ?? updated) === 0) return true

    const store = await account.related('store').query().firstOrFail()
    await this.messages.queue({
      storeId: account.storeId,
      kind: MessageKind.LOGIN_REPLY,
      dedupKey: `login:${challenge.id}:reply`,
      to: from,
      content: {
        type: 'text',
        body: `Pronto! Pode voltar ao cardápio da ${store.name}: seus pedidos já aparecem lá.`,
      },
    })
    return true
  }

  /**
   * The browser that started it asks for its session (polling while the
   * customer sends the message, or with the code typed). Single use.
   */
  async claim(store: Store, challengeId: string, secret: string, code?: string | null) {
    const challenge = await CustomerLoginChallenge.query()
      .where({ id: challengeId, storeId: store.id })
      .first()
    if (!challenge || !sameHash(challenge.secretHash, sha256(secret))) {
      throw new AppException('Pedido de acesso não encontrado.', 404, 'E_LOGIN_NOT_FOUND')
    }
    // A verified one may be claimed a little after it expired (the message
    // arrived just in time, the page was in the background).
    const over = challenge.verifiedAt
      ? challenge.verifiedAt < DateTime.now().minus({ minutes: 30 })
      : challenge.isExpired
    if (challenge.claimedAt || over) {
      throw new AppException(
        'Esse pedido de acesso expirou. Comece de novo.',
        410,
        'E_LOGIN_EXPIRED'
      )
    }

    if (challenge.method === LoginMethod.CODE && !challenge.verifiedAt) {
      if (challenge.attempts >= MAX_ATTEMPTS) {
        throw new AppException('Muitas tentativas. Peça outro código.', 429, 'E_LOGIN_LOCKED')
      }
      if (!code) return { status: 'pending' as const }
      const right = challenge.codeHash && sameHash(challenge.codeHash, codeHash(challenge.id, code))
      if (!right) {
        await CustomerLoginChallenge.query().where('id', challenge.id).increment('attempts', 1)
        throw new AppException('Código incorreto.', 422, 'E_LOGIN_CODE_INVALID', {
          attemptsLeft: Math.max(0, MAX_ATTEMPTS - challenge.attempts - 1),
        })
      }
      challenge.verifiedAt = DateTime.now()
      await challenge.save()
    }

    if (!challenge.verifiedAt || !challenge.phone) return { status: 'pending' as const }

    // Conditional: two polls at once get one session.
    const claimed = await CustomerLoginChallenge.query()
      .where('id', challenge.id)
      .whereNull('claimedAt')
      .update({ claimedAt: DateTime.now().toJSDate() })
    if (Number(claimed[0] ?? claimed) === 0) {
      throw new AppException(
        'Esse pedido de acesso expirou. Comece de novo.',
        410,
        'E_LOGIN_EXPIRED'
      )
    }

    const token = `cs_${randomBytes(32).toString('base64url')}`
    await CustomerSession.create({
      storeId: store.id,
      phone: challenge.phone,
      tokenHash: sha256(token),
      expiresAt: DateTime.now().plus({ days: SESSION_DAYS }),
    })
    return {
      status: 'verified' as const,
      customerToken: token,
      customer: await this.customerOf(store.id, challenge.phone),
    }
  }

  /** The session behind a `Customer-Token`, renewed by use (90 days from the last day used). */
  async session(storeId: string, token: string | null | undefined) {
    if (!token) return null
    const session = await CustomerSession.query()
      .where({ storeId, tokenHash: sha256(token) })
      .where('expiresAt', '>', DateTime.now().toSQL()!)
      .first()
    if (!session) return null
    const now = DateTime.now()
    if (!session.lastUsedAt || session.lastUsedAt < now.minus({ days: 1 })) {
      session.lastUsedAt = now
      session.expiresAt = now.plus({ days: SESSION_DAYS })
      await session.save()
    }
    return session
  }

  async signOut(storeId: string, token: string | null | undefined) {
    if (!token) return
    await CustomerSession.query()
      .where({ storeId, tokenHash: sha256(token) })
      .delete()
  }

  /** The store's orders of the verified phone, counter ones included, newest first. */
  async history(storeId: string, phone: string, limit = 30) {
    const customers = Customer.query()
      .where('storeId', storeId)
      .whereIn('phone', phoneVariants(phone))
      .select('id')
    return await Order.query()
      .where('storeId', storeId)
      .whereIn('customerId', customers)
      .preload('items', (items) => items.orderBy('id'))
      .orderBy('createdAt', 'desc')
      .limit(limit)
  }

  /** The name the store knows the phone by (the newest), masked phone. */
  async customerOf(storeId: string, phone: string) {
    const customer = await Customer.query()
      .where('storeId', storeId)
      .whereIn('phone', phoneVariants(phone))
      .orderBy('updatedAt', 'desc')
      .first()
    return { name: customer?.name ?? null, phone: maskPhone(phone) }
  }
}
