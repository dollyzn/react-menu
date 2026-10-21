import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import StoreRole from '#enums/store_role'
import User from '#models/user'
import Notification from '#models/notification'
import StaffInviteNotification from '#mails/staff_invite_notification'
import StoreAccessNotification from '#mails/store_access_notification'
import { createStore, createUser, linkUser } from '#tests/helpers/fixtures'

async function storeWithManager() {
  const manager = await createUser({ name: 'Gerente' })
  const store = await createStore()
  await linkUser(store, manager, StoreRole.MANAGER)
  return { store, manager }
}

test.group('Store members', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(() => {
    mail.fake()
    return () => mail.restore()
  })

  test('only managers of the store see and change the team', async ({ client }) => {
    const { store, manager } = await storeWithManager()
    const attendant = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const other = await storeWithManager()

    const list = await client.get(`/api/v1/stores/${store.id}/members`).loginAs(manager)
    const byAttendant = await client.get(`/api/v1/stores/${store.id}/members`).loginAs(attendant)
    const byOtherStore = await client
      .get(`/api/v1/stores/${store.id}/members`)
      .loginAs(other.manager)

    list.assertStatus(200)
    list.assertBodyContains({
      data: [
        { id: manager.id, role: 'manager' },
        { id: attendant.id, role: 'attendant' },
      ],
    })
    byAttendant.assertStatus(403)
    byOtherStore.assertStatus(403)
  })

  test('adding by e-mail links existing accounts and invites new people', async ({
    client,
    assert,
  }) => {
    const fake = mail.fake()
    const { store, manager } = await storeWithManager()
    const existing = await createUser({ name: 'Bruna' })

    const linked = await client
      .post(`/api/v1/stores/${store.id}/members`)
      .json({ email: existing.email.toUpperCase(), role: 'attendant' })
      .loginAs(manager)
    const invited = await client
      .post(`/api/v1/stores/${store.id}/members`)
      .json({ email: 'novo.cozinheiro@example.com', name: 'Caio', role: 'kitchen' })
      .loginAs(manager)
    const again = await client
      .post(`/api/v1/stores/${store.id}/members`)
      .json({ email: existing.email, role: 'kitchen' })
      .loginAs(manager)

    linked.assertStatus(200)
    linked.assertBodyContains({ data: { id: existing.id, role: 'attendant' } })
    invited.assertStatus(200)
    invited.assertBodyContains({ data: { name: 'Caio', role: 'kitchen' } })
    again.assertStatus(409)

    // Only the new person gets an invite; its link creates the password.
    fake.mails.assertQueuedCount(StaffInviteNotification, 1)
    // The existing account is told in the panel and by e-mail.
    fake.mails.assertQueuedCount(StoreAccessNotification, 1)
    const added = await Notification.query().where('userId', existing.id).firstOrFail()
    assert.equal(added.type, 'store.member_added')
    const [invite] = fake.mails.queued((sent) => sent instanceof StaffInviteNotification)
    const url = new URL((invite as unknown as { setPasswordUrl: string }).setPasswordUrl)
    assert.equal(url.searchParams.get('convite'), '1')

    const setPassword = await client
      .post('/api/v1/auth/reset-password')
      .json({ token: url.searchParams.get('token'), password: 'senha-da-cozinha' })
    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: 'novo.cozinheiro@example.com', password: 'senha-da-cozinha' })
    setPassword.assertStatus(200)
    login.assertStatus(200)
  })

  test('a pending invite can be resent until the person signs in', async ({ client, assert }) => {
    const fake = mail.fake()
    const { store, manager } = await storeWithManager()
    const other = await storeWithManager()
    await client
      .post(`/api/v1/stores/${store.id}/members`)
      .json({ email: 'pendente@example.com', role: 'attendant' })
      .loginAs(manager)
    const invited = await User.findByOrFail('email', 'pendente@example.com')

    const list = await client.get(`/api/v1/stores/${store.id}/members`).loginAs(manager)
    list.assertBodyContains({ data: [{ id: manager.id, invitePending: false }] })
    const pending = list.body().data.find((member: { id: string }) => member.id === invited.id)
    assert.isTrue(pending.invitePending)

    const resent = await client
      .post(`/api/v1/stores/${store.id}/members/${invited.id}/invite`)
      .loginAs(manager)
    const fromOtherStore = await client
      .post(`/api/v1/stores/${store.id}/members/${invited.id}/invite`)
      .loginAs(other.manager)
    resent.assertStatus(200)
    fromOtherStore.assertStatus(403)
    fake.mails.assertQueuedCount(StaffInviteNotification, 2)

    // Only the latest link works.
    const [first, latest] = fake.mails
      .queued((sent) => sent instanceof StaffInviteNotification)
      .map((sent) => new URL((sent as unknown as { setPasswordUrl: string }).setPasswordUrl))
    const old = await client
      .post('/api/v1/auth/reset-password')
      .json({ token: first.searchParams.get('token'), password: 'senha-nova-123' })
    const current = await client
      .post('/api/v1/auth/reset-password')
      .json({ token: latest.searchParams.get('token'), password: 'senha-nova-123' })
    old.assertStatus(422)
    current.assertStatus(200)

    await invited.refresh()
    assert.isFalse(invited.invitePending)
    const afterAccepted = await client
      .post(`/api/v1/stores/${store.id}/members/${invited.id}/invite`)
      .loginAs(manager)
    afterAccepted.assertStatus(409)
    afterAccepted.assertBodyContains({ code: 'E_INVITE_ACCEPTED' })
  })

  test('signing in also settles a pending invite', async ({ client, assert }) => {
    const user = await createUser({ password: 'secret123' })
    user.invitePending = true
    await user.save()

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: 'secret123' })

    login.assertStatus(200)
    await user.refresh()
    assert.isFalse(user.invitePending)
  })

  test('roles change, and the store always keeps a manager', async ({ client }) => {
    const { store, manager } = await storeWithManager()
    const attendant = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)

    const demoteLast = await client
      .put(`/api/v1/stores/${store.id}/members/${manager.id}`)
      .json({ role: 'kitchen' })
      .loginAs(manager)
    const removeLast = await client
      .delete(`/api/v1/stores/${store.id}/members/${manager.id}`)
      .loginAs(manager)
    const promote = await client
      .put(`/api/v1/stores/${store.id}/members/${attendant.id}`)
      .json({ role: 'manager' })
      .loginAs(manager)
    const leave = await client
      .delete(`/api/v1/stores/${store.id}/members/${manager.id}`)
      .loginAs(manager)

    demoteLast.assertStatus(409)
    demoteLast.assertBodyContains({ code: 'E_LAST_MANAGER' })
    removeLast.assertStatus(409)
    promote.assertBodyContains({ data: { id: attendant.id, role: 'manager' } })
    leave.assertStatus(200)
  })

  test('removed members lose access to the store right away', async ({ client, assert }) => {
    const { store, manager } = await storeWithManager()
    const attendant = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)

    const before = await client.get(`/api/v1/stores/${store.id}/orders`).loginAs(attendant)
    const removed = await client
      .delete(`/api/v1/stores/${store.id}/members/${attendant.id}`)
      .loginAs(manager)
    const after = await client.get(`/api/v1/stores/${store.id}/orders`).loginAs(attendant)
    const unknown = await client
      .delete(`/api/v1/stores/${store.id}/members/${attendant.id}`)
      .loginAs(manager)

    before.assertStatus(200)
    removed.assertStatus(200)
    after.assertStatus(403)
    unknown.assertStatus(404)
    // The account still exists (it may belong to other stores).
    assert.isNotNull(await User.find(attendant.id))
  })
})
