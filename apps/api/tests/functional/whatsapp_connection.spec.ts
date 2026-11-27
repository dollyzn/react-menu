import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import WhatsAppAccountService from '#services/whatsapp_account_service'
import { DateTime } from 'luxon'
import StoreRole from '#enums/store_role'
import SyncWhatsAppTemplates from '#jobs/sync_whatsapp_templates'
import SyncWhatsAppBusinessApp from '#jobs/sync_whatsapp_business_app'
import { WhatsAppApiError } from '#whatsapp/client'
import WhatsAppAccount from '#models/whatsapp_account'
import { TEMPLATE_DEFINITIONS, TEMPLATES } from '#whatsapp/templates'
import { createMenuStore, createStaff, linkUser } from '#tests/helpers/fixtures'
import { emptyDatabase } from '#tests/helpers/database'
import { failJob, fakeQueue, runJob } from '#tests/helpers/queue'
import {
  connectStore,
  PHONE_NUMBER_ID,
  useFakeGraph,
  VERIFY_TOKEN,
  WABA_ID,
} from '#tests/helpers/fake_whatsapp'

const signup = { code: 'embedded-signup-code-123', wabaId: WABA_ID, phoneNumberId: PHONE_NUMBER_ID }

/**
 * A store connects its own number through Embedded Signup (ADR 0025): the
 * code becomes the business token, the number is registered, the app is
 * subscribed with our callback (never the app's default one) and our
 * templates are submitted, their review polled.
 */
test.group('WhatsApp connection (store page)', (group) => {
  group.each.setup(() => emptyDatabase)
  const meta = useFakeGraph(group)

  async function setup() {
    const { store } = await createMenuStore()
    const manager = await createStaff()
    await linkUser(store, manager, StoreRole.MANAGER)
    return { store, manager }
  }

  test('connecting exchanges the code, registers the number and points the webhook to us', async ({
    client,
    assert,
  }) => {
    const queue = fakeQueue()
    const { store, manager } = await setup()

    const response = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json(signup)
      .loginAs(manager)

    response.assertStatus(200)
    const account = response.body().data.account
    assert.equal(account.displayPhoneNumber, '+55 11 3333-4444')
    assert.notProperty(account, 'accessToken')

    const graph = meta.graph
    assert.deepEqual(graph.called('exchangeCode')[0].args, [signup.code])
    const [register] = graph.called('registerPhone')
    assert.equal(register.args[0], `business-token-${signup.code}`)
    assert.match(String(register.args[2]), /^\d{6}$/)
    // The override: our endpoint and verify token, on the store's WABA.
    const [token, waba, callback, verifyToken] = graph.called('subscribeApp')[0].args
    assert.equal(token, `business-token-${signup.code}`)
    assert.equal(waba, WABA_ID)
    assert.match(String(callback), /^https?:\/\/[^/]+\/api\/v1\/webhooks\/whatsapp$/)
    assert.equal(verifyToken, VERIFY_TOKEN)
    // The templates go to Meta in the job, not in this request (about 5 s each).
    assert.lengthOf(graph.called('createTemplate'), 0)
    assert.isTrue(
      account.notices.every(
        (notice: { template: { status: string } }) => notice.template.status === 'SUBMITTING'
      )
    )
    assert.equal(account.loginTemplate.status, 'SUBMITTING')

    // The token and PIN are encrypted at rest.
    const saved = await WhatsAppAccount.findByOrFail('storeId', store.id)
    assert.equal(saved.accessToken, `business-token-${signup.code}`)
    const raw = await WhatsAppAccount.query()
      .where('id', saved.id)
      .pojo<{ access_token: string }>()
      .first()
    assert.notInclude(raw!.access_token, 'business-token')

    // The job submits every template right away, in pt_BR, then polls their
    // review (its webhook goes to the app's default callback).
    queue.assertPushed('SyncWhatsAppTemplates')
    const generation = saved.webhookSubscribedAt!.toMillis()
    await runJob(SyncWhatsAppTemplates, { accountId: saved.id, round: 0, generation })
    const created = graph
      .called('createTemplate')
      .map((call) => call.args[2] as { name: string; language: string })
    assert.sameMembers(
      created.map((template) => template.name),
      TEMPLATE_DEFINITIONS.map((definition) => definition.name)
    )
    assert.isTrue(created.every((template) => template.language === 'pt_BR'))
    await saved.refresh()
    assert.equal(saved.templates[TEMPLATES.ORDER_READY].status, 'PENDING')

    meta.graph.approveAll()
    await runJob(SyncWhatsAppTemplates, { accountId: saved.id, round: 1, generation })
    await saved.refresh()
    assert.isTrue(saved.templateApproved(TEMPLATES.ORDER_READY))
  })

  test('a WhatsApp Business app number (coexistence) is not registered again', async ({
    client,
    assert,
  }) => {
    const { store, manager } = await setup()
    const response = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json({ ...signup, coexistence: true })
      .loginAs(manager)
    response.assertStatus(200)
    assert.isTrue(response.body().data.account.coexistence)
    assert.lengthOf(meta.graph.called('registerPhone'), 0)
    assert.lengthOf(meta.graph.called('subscribeApp'), 1)
  })

  test("Meta's refusal is shown; nothing is saved", async ({ client, assert }) => {
    const { store, manager } = await setup()
    const response = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json({ ...signup, code: 'expired-code-0000' })
      .loginAs(manager)
    response.assertStatus(422)
    assert.equal(response.body().code, 'E_WHATSAPP_REFUSED')
    assert.isNull(await WhatsAppAccount.findBy('storeId', store.id))
  })

  test('a number connected to another store is refused', async ({ client }) => {
    const { store, manager } = await setup()
    const other = await createMenuStore()
    await connectStore(other.store, { phoneNumberId: PHONE_NUMBER_ID })
    const response = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json(signup)
      .loginAs(manager)
    response.assertStatus(409)
    response.assertBodyContains({ code: 'E_WHATSAPP_NUMBER_IN_USE' })
  })

  test('connecting another WABA unsubscribes the previous one', async ({ client, assert }) => {
    const { store, manager } = await setup()
    const previous = await connectStore(store, { wabaId: '555000111' })
    const response = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json(signup)
      .loginAs(manager)
    response.assertStatus(200)
    assert.deepEqual(meta.graph.called('unsubscribeApp')[0].args, [
      previous.accessToken,
      '555000111',
    ])
  })

  test("with only the code (Meta's window message lost), the WABA and number come from the token", async ({
    client,
    assert,
  }) => {
    const { store, manager } = await setup()
    const response = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json({ code: signup.code })
      .loginAs(manager)
    response.assertStatus(200)
    const saved = await WhatsAppAccount.findByOrFail('storeId', store.id)
    assert.equal(saved.wabaId, WABA_ID)
    assert.equal(saved.phoneNumberId, PHONE_NUMBER_ID)

    // Two numbers in the WABA: which one is the store's is the manager's to say.
    meta.graph.numbers = [PHONE_NUMBER_ID, '999888777']
    const ambiguous = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json({ code: signup.code })
      .loginAs(manager)
    ambiguous.assertStatus(422)
    ambiguous.assertBodyContains({ code: 'E_WHATSAPP_CHOOSE_NUMBER' })
  })

  test('a refused reconnect keeps the working WABA subscribed', async ({ client, assert }) => {
    const { store, manager } = await setup()
    await connectStore(store, { wabaId: '555000111' })
    meta.graph.refuseRegister = true
    const response = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json(signup)
      .loginAs(manager)
    response.assertStatus(422)
    assert.lengthOf(meta.graph.called('unsubscribeApp'), 0)
    const kept = await WhatsAppAccount.findByOrFail('storeId', store.id)
    assert.equal(kept.wabaId, '555000111')
  })

  test("after a reconnect, the old connection's review polling stops", async ({ assert }) => {
    fakeQueue()
    const { store } = await setup()
    const account = await connectStore(store, { webhookSubscribedAt: DateTime.now() })
    const before = account.webhookSubscribedAt!.minus({ hours: 1 }).toMillis()
    await runJob(SyncWhatsAppTemplates, { accountId: account.id, round: 3, generation: before })
    assert.lengthOf(meta.graph.called('listTemplates'), 0)
    // The current connection's chain does poll.
    const current = account.webhookSubscribedAt!.toMillis()
    await runJob(SyncWhatsAppTemplates, { accountId: account.id, round: 0, generation: current })
    assert.lengthOf(meta.graph.called('listTemplates'), 1)
  })

  test('a WhatsApp Business app onboarding with only the WABA: its number, never registered, contacts then history synced once', async ({
    client,
    assert,
  }) => {
    const queue = fakeQueue()
    const { store, manager } = await setup()
    meta.graph.onBizApp = true
    const response = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json({ code: signup.code, wabaId: WABA_ID, coexistence: true })
      .loginAs(manager)
    response.assertStatus(200)
    assert.deepInclude(response.body().data.account, {
      coexistence: true,
      appSync: { contacts: 'pending', history: 'pending', error: null },
    })
    assert.lengthOf(meta.graph.called('registerPhone'), 0)
    // The WABA came from the event: only its numbers were read.
    assert.lengthOf(meta.graph.called('grantedWabas'), 0)
    assert.deepEqual(meta.graph.called('phoneNumbers')[0].args.slice(1), [WABA_ID])

    queue.assertPushed('SyncWhatsAppBusinessApp')
    const saved = await WhatsAppAccount.findByOrFail('storeId', store.id)
    const generation = saved.appOnboardedAt!.toMillis()
    await runJob(SyncWhatsAppBusinessApp, { accountId: saved.id, generation })
    assert.deepEqual(
      meta.graph.called('syncAppData').map((call) => call.args[2]),
      ['smb_app_state_sync', 'history']
    )
    // Once only: Meta allows each step a single time.
    await runJob(SyncWhatsAppBusinessApp, { accountId: saved.id, generation })
    assert.lengthOf(meta.graph.called('syncAppData'), 2)
    await saved.refresh()
    assert.equal(saved.appSync.contacts?.requestId, 'req-smb_app_state_sync')
  })

  test('the number tells it is on the app even without the event: the code-only path never registers it', async ({
    client,
    assert,
  }) => {
    fakeQueue()
    const { store, manager } = await setup()
    meta.graph.onBizApp = true
    const response = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json({ code: signup.code })
      .loginAs(manager)
    response.assertStatus(200)
    assert.isTrue(response.body().data.account.coexistence)
    assert.lengthOf(meta.graph.called('registerPhone'), 0)

    // A number without its WABA is refused.
    const orphan = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json({ code: signup.code, phoneNumberId: PHONE_NUMBER_ID })
      .loginAs(manager)
    orphan.assertStatus(422)
  })

  test('the app sync: Meta not answering is retried, a refusal or the 24-hour deadline is recorded', async ({
    assert,
  }) => {
    const { store } = await setup()
    const account = await connectStore(store, {
      coexistence: true,
      appOnboardedAt: DateTime.now(),
    })
    const generation = account.appOnboardedAt!.toMillis()

    meta.graph.failNextSync = new WhatsAppApiError('Meta did not answer', 0, null)
    await assert.rejects(() =>
      runJob(SyncWhatsAppBusinessApp, { accountId: account.id, generation })
    )
    await account.refresh()
    assert.isUndefined(account.appSync.contacts)

    meta.graph.failNextSync = new WhatsAppApiError('Sync not allowed', 400, 100)
    await runJob(SyncWhatsAppBusinessApp, { accountId: account.id, generation })
    await account.refresh()
    assert.equal(account.appSync.contacts?.error, 'Sync not allowed')
    assert.isUndefined(account.appSync.history)

    // A day later: too late to sync.
    const other = await createMenuStore()
    const late = await connectStore(other.store, {
      coexistence: true,
      appOnboardedAt: DateTime.now().minus({ hours: 25 }),
    })
    await runJob(SyncWhatsAppBusinessApp, {
      accountId: late.id,
      generation: late.appOnboardedAt!.toMillis(),
    })
    await late.refresh()
    assert.match(String(late.appSync.contacts?.error), /24 horas/)
  })

  test('a signup that ended without a number, other than the app onboarding, connects nothing', async ({
    client,
    assert,
  }) => {
    const { store, manager } = await setup()
    const response = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json({ code: signup.code, wabaId: WABA_ID })
      .loginAs(manager)
    response.assertStatus(422)
    response.assertBodyContains({ code: 'E_WHATSAPP_CHOOSE_NUMBER' })
    assert.lengthOf(meta.graph.called('registerPhone'), 0)
  })

  test("only the code, and Meta can't say whether the number is on the app: connect again, never register", async ({
    client,
    assert,
  }) => {
    const { store, manager } = await setup()
    meta.graph.onBizApp = undefined
    const response = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json({ code: signup.code })
      .loginAs(manager)
    response.assertStatus(422)
    response.assertBodyContains({ code: 'E_WHATSAPP_UNKNOWN_NUMBER' })
    assert.lengthOf(meta.graph.called('registerPhone'), 0)
  })

  test('the app sync belongs to its onboarding: "Atualizar" and token reconnects keep it, a job that gives up says so', async ({
    client,
    assert,
  }) => {
    const queue = fakeQueue()
    const { store, manager } = await setup()
    const onboardedAt = DateTime.now().minus({ minutes: 5 })
    const account = await connectStore(store, {
      coexistence: true,
      appOnboardedAt: onboardedAt,
      appSync: { contacts: { requestId: 'req-1', error: null, at: onboardedAt.toISO()! } },
    })
    // Before the sync existed (no onboarding time): not shown at all.
    const other = await createMenuStore()
    const older = await connectStore(other.store, { coexistence: true })
    const service = await app.container.make(WhatsAppAccountService)
    assert.isNull(service.present(older).account!.appSync)

    // "Atualizar" re-applies the webhook: the sync's onboarding is untouched.
    meta.graph.approveAll()
    const refreshed = await client
      .post(`/api/v1/stores/${store.id}/whatsapp/refresh`)
      .loginAs(manager)
    refreshed.assertStatus(200)
    await account.refresh()
    assert.equal(account.appOnboardedAt!.toMillis(), onboardedAt.toMillis())

    // A token reconnect (whatsapp:connect) keeps the sync and sends no job.
    meta.graph.onBizApp = true
    queue.clearPushedJobs()
    await service.connect(store, {
      token: 'system-token',
      wabaId: account.wabaId,
      phoneNumberId: account.phoneNumberId,
    })
    await account.refresh()
    assert.equal(account.appSync.contacts?.requestId, 'req-1')
    queue.assertNotPushed('SyncWhatsAppBusinessApp')

    // The job gave up on history (Meta kept not answering): it fails, the panel stops waiting.
    await failJob(
      SyncWhatsAppBusinessApp,
      { accountId: account.id, generation: onboardedAt.toMillis() },
      new Error('Meta did not answer')
    )
    await account.refresh()
    assert.match(String(account.appSync.history?.error), /não respondeu/)
    assert.equal(account.appSync.contacts?.requestId, 'req-1')
  })

  test('settings, refresh and disconnect', async ({ client, assert }) => {
    const { store, manager } = await setup()
    const account = await connectStore(store)
    const base = `/api/v1/stores/${store.id}/whatsapp`

    const settings = await client
      .put(`${base}/settings`)
      .json({ notifyOrders: false })
      .loginAs(manager)
    settings.assertStatus(200)
    assert.isFalse(settings.body().data.account.notifyOrders)
    assert.isTrue(settings.body().data.account.customerLogin)

    // Refresh: the templates as Meta has them now (one was rejected).
    meta.graph.templates = TEMPLATE_DEFINITIONS.map((definition, index) => ({
      id: `tpl-${index}`,
      name: definition.name,
      language: 'pt_BR',
      status: definition.name === TEMPLATES.LOGIN_CODE ? 'REJECTED' : 'APPROVED',
      category: definition.category,
      rejected_reason: definition.name === TEMPLATES.LOGIN_CODE ? 'INVALID_FORMAT' : 'NONE',
    }))
    const refreshed = await client.post(`${base}/refresh`).loginAs(manager)
    refreshed.assertStatus(200)
    assert.deepInclude(refreshed.body().data.account.loginTemplate, {
      status: 'REJECTED',
      reason: 'INVALID_FORMAT',
    })
    assert.lengthOf(meta.graph.called('subscribeApp'), 1)

    const gone = await client.delete(base).loginAs(manager)
    gone.assertStatus(200)
    assert.deepEqual(meta.graph.called('unsubscribeApp')[0].args, [
      'business-token',
      account.wabaId,
    ])
    assert.isNull(await WhatsAppAccount.findBy('storeId', store.id))
    // Again: harmless.
    const again = await client.delete(base).loginAs(manager)
    again.assertStatus(200)
  })

  test('only managers of the store', async ({ client }) => {
    const { store } = await setup()
    const attendant = await createStaff()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const outsider = await createStaff()
    const otherStore = await createMenuStore()
    await linkUser(otherStore.store, outsider, StoreRole.MANAGER)

    const byAttendant = await client.get(`/api/v1/stores/${store.id}/whatsapp`).loginAs(attendant)
    byAttendant.assertStatus(403)
    const byOutsider = await client
      .post(`/api/v1/stores/${store.id}/whatsapp`)
      .json(signup)
      .loginAs(outsider)
    byOutsider.assertStatus(403)
    const anonymous = await client.get(`/api/v1/stores/${store.id}/whatsapp`)
    anonymous.assertStatus(401)
  })
})
