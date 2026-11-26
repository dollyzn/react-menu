import { randomInt } from 'node:crypto'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import AppException from '#exceptions/app_exception'
import WhatsAppAccount, { type TemplateState } from '#models/whatsapp_account'
import type Store from '#models/store'
import type User from '#models/user'
import WhatsAppClient, { WhatsAppApiError } from '#whatsapp/client'
import { whatsappConfig } from '#whatsapp/config'
import {
  LOGIN_CODE_PREVIEW,
  loginReply,
  NOTICES,
  type NoticeKind,
  previewOf,
  TEMPLATE_DEFINITIONS,
  TEMPLATE_LANGUAGE,
  TEMPLATES,
} from '#whatsapp/templates'
import env from '#start/env'

export type ConnectInput = {
  /** Embedded Signup's code (5 minutes). */
  code?: string
  /** Or a token already in hand (`whatsapp:connect`, a system user of the app's business). */
  token?: string
  wabaId: string
  phoneNumberId: string
  businessId?: string | null
  /** Finished as a WhatsApp Business app number (coexistence): not registered by us. */
  coexistence?: boolean
  /** The number is already on the Cloud API with a PIN we don't know (a test number). */
  skipRegister?: boolean
}

/** Meta answered something that only the manager can fix: show its reason. */
function refused(error: unknown, fallback: string): never {
  if (error instanceof WhatsAppApiError) {
    if (error.status === 0 || error.status >= 500) {
      throw new AppException(
        'O WhatsApp (Meta) não respondeu. Tente de novo em instantes.',
        503,
        'E_WHATSAPP_UNAVAILABLE'
      )
    }
    throw new AppException(`${fallback} (${error.message})`, 422, 'E_WHATSAPP_REFUSED', {
      metaCode: error.code,
    })
  }
  throw error
}

/**
 * A store's WhatsApp number (ADR 0025): connecting it through Embedded
 * Signup, our templates in its WABA, the webhook override and the switches.
 */
@inject()
export default class WhatsAppAccountService {
  constructor(private client: WhatsAppClient) {}

  async forStore(storeId: string) {
    return await WhatsAppAccount.findBy('storeId', storeId)
  }

  assertEnabled() {
    if (!whatsappConfig().enabled) {
      // A configuration of the platform, not a hiccup to retry.
      throw new AppException(
        'O WhatsApp não está configurado neste servidor.',
        409,
        'E_WHATSAPP_DISABLED'
      )
    }
  }

  /**
   * Finishes Embedded Signup: the business token, the number registered on
   * the Cloud API, the app subscribed to the WABA with our callback, and our
   * templates submitted for review. Doing it again (same or another number)
   * replaces the store's connection.
   */
  async connect(store: Store, input: ConnectInput, actor?: User) {
    this.assertEnabled()

    const taken = await WhatsAppAccount.query()
      .where('phoneNumberId', input.phoneNumberId)
      .whereNot('storeId', store.id)
      .first()
    if (taken) {
      throw new AppException(
        'Este número já está conectado a outra loja.',
        409,
        'E_WHATSAPP_NUMBER_IN_USE'
      )
    }

    let token = input.token
    if (!token) {
      try {
        token = await this.client.exchangeCode(input.code ?? '')
      } catch (error) {
        refused(error, 'O cadastro no WhatsApp expirou ou foi recusado. Conecte de novo')
      }
    }

    let info
    try {
      info = await this.client.phoneNumber(token, input.phoneNumberId)
    } catch (error) {
      refused(error, 'Não foi possível ler o número escolhido')
    }

    const current = await this.forStore(store.id)
    const sameNumber = current?.phoneNumberId === input.phoneNumberId
    // Another WABA than before: the old one stops sending us its events.
    if (current && current.wabaId !== input.wabaId) {
      await this.client.unsubscribeApp(current.accessToken, current.wabaId).catch((error) => {
        logger.warn({ err: error, storeId: store.id }, 'could not unsubscribe the previous WABA')
      })
    }
    const pin =
      (sameNumber && current?.registerPin) || String(randomInt(0, 1_000_000)).padStart(6, '0')
    const coexistence = Boolean(input.coexistence)

    if (!coexistence && !input.skipRegister) {
      try {
        await this.client.registerPhone(token, input.phoneNumberId, pin)
      } catch (error) {
        refused(error, 'O WhatsApp recusou ativar o número na API')
      }
    }

    const { webhookUrl, verifyToken } = whatsappConfig()
    try {
      await this.client.subscribeApp(token, input.wabaId, webhookUrl, verifyToken ?? '')
    } catch (error) {
      refused(error, 'O WhatsApp recusou o endereço de avisos (webhook)')
    }

    const account = current ?? new WhatsAppAccount()
    account.merge({
      storeId: store.id,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      businessId: input.businessId ?? null,
      displayPhoneNumber: info.display_phone_number,
      verifiedName: info.verified_name ?? null,
      accessToken: token,
      // The PIN we registered with; kept only when we did register it.
      registerPin:
        coexistence || input.skipRegister ? (sameNumber ? current!.registerPin : null) : pin,
      coexistence,
      webhookSubscribedAt: DateTime.now(),
      paymentIssueAt: null,
      brokenAt: null,
      lastError: null,
      connectedById: actor?.id ?? current?.connectedById ?? null,
      ...(!sameNumber && { templates: {}, templatesCheckedAt: null }),
    })
    if (!current) {
      account.notifyOrders = true
      account.customerLogin = true
      account.templates = {}
    }
    await account.save()

    // Templates are reviewed by Meta (minutes to a day): submitted now, their
    // status polled by the job (their webhook isn't ours to receive).
    await this.syncTemplates(account, { create: true }).catch((error) => {
      logger.warn({ err: error, storeId: store.id }, 'could not submit the WhatsApp templates')
    })
    const { default: SyncWhatsAppTemplates } = await import('#jobs/sync_whatsapp_templates')
    await SyncWhatsAppTemplates.scheduleFor(account)

    return account
  }

  /**
   * Reads our templates' status in the WABA and, with `create`, submits the
   * missing ones. A token that stopped working marks the connection broken.
   */
  async syncTemplates(account: WhatsAppAccount, options: { create: boolean }) {
    let existing
    try {
      existing = await this.client.listTemplates(account.accessToken, account.wabaId)
    } catch (error) {
      await this.noteFailure(account, error)
      throw error
    }

    const frontendUrl = env.get('FRONTEND_URL').replace(/\/$/, '')
    const templates: Record<string, TemplateState> = {}
    for (const definition of TEMPLATE_DEFINITIONS) {
      const found = existing.find(
        (template) => template.name === definition.name && template.language === TEMPLATE_LANGUAGE
      )
      if (found) {
        templates[definition.name] = {
          id: found.id,
          status: found.status,
          category: found.category,
          reason:
            found.rejected_reason && found.rejected_reason !== 'NONE'
              ? found.rejected_reason
              : null,
        }
        continue
      }
      if (!options.create) {
        templates[definition.name] = { id: null, status: 'MISSING', category: null, reason: null }
        continue
      }
      try {
        const created = await this.client.createTemplate(
          account.accessToken,
          account.wabaId,
          definition.create(frontendUrl)
        )
        templates[definition.name] = {
          id: created.id,
          status: created.status ?? 'PENDING',
          category: created.category ?? definition.category,
          reason: null,
        }
      } catch (error) {
        if (error instanceof WhatsAppApiError && error.transient) throw error
        templates[definition.name] = {
          id: null,
          status: 'MISSING',
          category: null,
          reason: error instanceof Error ? error.message.slice(0, 200) : null,
        }
      }
    }

    account.templates = templates
    account.templatesCheckedAt = DateTime.now()
    await account.save()
    return account
  }

  /** Applies the webhook override again (a new domain, or Meta lost it). */
  async resubscribe(account: WhatsAppAccount) {
    const { webhookUrl, verifyToken } = whatsappConfig()
    try {
      await this.client.subscribeApp(
        account.accessToken,
        account.wabaId,
        webhookUrl,
        verifyToken ?? ''
      )
    } catch (error) {
      await this.noteFailure(account, error)
      throw error
    }
    account.webhookSubscribedAt = DateTime.now()
    await account.save()
  }

  /** "Atualizar" in the panel: the number's name, the templates and the override again. */
  async refresh(account: WhatsAppAccount) {
    this.assertEnabled()
    try {
      const info = await this.client.phoneNumber(account.accessToken, account.phoneNumberId)
      account.displayPhoneNumber = info.display_phone_number
      account.verifiedName = info.verified_name ?? account.verifiedName
      await this.resubscribe(account)
      await this.syncTemplates(account, { create: true })
    } catch (error) {
      await this.noteFailure(account, error)
      refused(error, 'Não foi possível atualizar a conexão com o WhatsApp')
    }
    account.brokenAt = null
    account.lastError = null
    await account.save()
    return account
  }

  async updateSettings(
    account: WhatsAppAccount,
    input: {
      notifyOrders?: boolean
      customerLogin?: boolean
      notices?: Partial<Record<NoticeKind, boolean>>
    }
  ) {
    const { notices, ...switches } = input
    account.merge(switches)
    if (notices) {
      // Only what differs from each notice's default is kept.
      const next = { ...account.notices }
      for (const notice of NOTICES) {
        const on = notices[notice.kind]
        if (on === undefined) continue
        if (on === notice.defaultOn) delete next[notice.kind]
        else next[notice.kind] = on
      }
      account.notices = next
    }
    await account.save()
    return account
  }

  /**
   * Disconnects the store: the app leaves the WABA (best effort: the number
   * may already be gone) and the connection is forgotten. Sent messages stay.
   */
  async disconnect(account: WhatsAppAccount) {
    try {
      await this.client.unsubscribeApp(account.accessToken, account.wabaId)
    } catch (error) {
      logger.warn({ err: error, storeId: account.storeId }, 'could not unsubscribe from the WABA')
    }
    await account.delete()
  }

  /** A refusal that says something about the connection itself. */
  async noteFailure(account: WhatsAppAccount, error: unknown) {
    if (!(error instanceof WhatsAppApiError)) return
    if (error.tokenInvalid) {
      account.brokenAt = DateTime.now()
      account.lastError = error.message.slice(0, 300)
      await account.save()
    } else if (error.paymentIssue && !account.paymentIssueAt) {
      account.paymentIssueAt = DateTime.now()
      await account.save()
    }
  }

  /**
   * What the public menu offers (PublicMenu `whatsapp`): the checkout's
   * "avisos pelo WhatsApp" and the history sign-in ways.
   */
  publicFeatures(account: WhatsAppAccount | null) {
    const usable = Boolean(account?.isUsable)
    return {
      // Offered when at least one notice the store sends can go out.
      notifications:
        usable &&
        account!.notifyOrders &&
        NOTICES.some(
          (notice) => account!.noticeOn(notice.kind) && account!.templateApproved(notice.name)
        ),
      login:
        usable && account!.customerLogin
          ? { message: true, code: account!.templateApproved(TEMPLATES.LOGIN_CODE) }
          : null,
    }
  }

  /** What the panel shows (WhatsAppConnection contract); never the token. */
  present(account: WhatsAppAccount | null) {
    const config = whatsappConfig()
    return {
      available: config.enabled,
      signup: config.enabled
        ? {
            appId: config.appId,
            configId: config.configId,
            graphVersion: config.graphVersion,
            fake: config.fake,
          }
        : null,
      account: account
        ? {
            displayPhoneNumber: account.displayPhoneNumber,
            verifiedName: account.verifiedName,
            wabaId: account.wabaId,
            coexistence: account.coexistence,
            notifyOrders: account.notifyOrders,
            customerLogin: account.customerLogin,
            broken: Boolean(account.brokenAt),
            lastError: account.lastError,
            paymentIssue: Boolean(account.paymentIssueAt),
            notices: NOTICES.map((notice) => ({
              kind: notice.kind,
              label: notice.label,
              when: notice.when,
              enabled: account.noticeOn(notice.kind),
              template: this.templateState(account, notice.name, notice.label),
              preview: { text: previewOf(notice), button: notice.button?.text ?? null },
            })),
            loginTemplate: this.templateState(account, TEMPLATES.LOGIN_CODE, 'Código de acesso'),
            // The two ways of the history sign-in, as the customer reads them.
            loginSteps: [
              {
                kind: 'message' as const,
                label: 'Entrar pelo WhatsApp',
                when: 'O cliente manda a mensagem pronta para a loja; a resposta confirma a entrada. Grátis: quem escreveu foi o cliente.',
                template: null,
                preview: { text: loginReply(account.verifiedName ?? 'loja'), button: null },
              },
              {
                kind: 'code' as const,
                label: 'Receber um código',
                when: 'O cliente digita o celular e recebe um código de 6 dígitos (mensagem cobrada).',
                template: this.templateState(account, TEMPLATES.LOGIN_CODE, 'Código de acesso'),
                preview: { text: LOGIN_CODE_PREVIEW, button: 'Copiar código' },
              },
            ],
            templatesCheckedAt: account.templatesCheckedAt?.toISO() ?? null,
            connectedAt: account.createdAt.toISO()!,
          }
        : null,
    }
  }

  private templateState(account: WhatsAppAccount, name: string, label: string) {
    const state = account.templates?.[name]
    return {
      name,
      label,
      status: state?.status ?? 'MISSING',
      category: state?.category ?? null,
      reason: state?.reason ?? null,
    }
  }
}
