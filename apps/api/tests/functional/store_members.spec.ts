import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import StoreRole from '#enums/store_role'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import Notification from '#models/notification'
import StaffInviteNotification from '#mails/staff_invite_notification'
import StoreAccessNotification from '#mails/store_access_notification'
import {
  createStaff,
  createStore,
  createUser,
  createUserWithPermissions,
  linkUser,
} from '#tests/helpers/fixtures'
import { SESSION_COOKIE, signIn } from '#tests/helpers/sign_in'

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
    assert.equal(url.searchParams.get('invite'), '1')

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
    assert.isFalse(pending.emailVerified)
    assert.isNotNull(pending.inviteExpiresAt)

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
    // The link reached their inbox: the address is verified.
    assert.isNotNull(invited.emailVerifiedAt)
    const accepted = await client.get(`/api/v1/stores/${store.id}/members`).loginAs(manager)
    assert.deepInclude(
      accepted.body().data.find((member: { id: string }) => member.id === invited.id),
      { invitePending: false, inviteExpiresAt: null, emailVerified: true }
    )
    const afterAccepted = await client
      .post(`/api/v1/stores/${store.id}/members/${invited.id}/invite`)
      .loginAs(manager)
    afterAccepted.assertStatus(409)
    afterAccepted.assertBodyContains({ code: 'E_INVITE_ACCEPTED' })
  })

  test('signing in also settles a pending invite', async ({ client, assert }) => {
    const user = await createStaff({ password: 'secret123' })
    user.invitePending = true
    await user.save()

    const { response: login } = await signIn(client, { email: user.email, password: 'secret123' })

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

  test('the e-mail sign-in code verifies the address', async ({ client, assert }) => {
    const user = await createStaff({ password: 'secret123' })
    assert.notExists(user.emailVerifiedAt)

    await signIn(client, { email: user.email, password: 'secret123' })

    await user.refresh()
    assert.isNotNull(user.emailVerifiedAt)
  })

  test('the team shows who is online', async ({ client, assert }) => {
    const { store, manager } = await storeWithManager()
    const attendant = await createUser()
    const kitchen = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    await linkUser(store, kitchen, StoreRole.KITCHEN)

    // The panel's heartbeat (any authenticated request counts).
    const ping = await client.get('/api/v1/auth/presence').loginAs(attendant)
    const list = await client.get(`/api/v1/stores/${store.id}/members`).loginAs(manager)

    ping.assertStatus(204)
    const byId = new Map(
      list.body().data.map((member: { id: string; online: boolean }) => [member.id, member])
    )
    assert.include(byId.get(attendant.id), { online: true })
    assert.isNotNull((byId.get(attendant.id) as { lastSeenAt: string | null }).lastSeenAt)
    assert.include(byId.get(kitchen.id), { online: false, lastSeenAt: null })
  })

  test('access to the store can be switched off and on, ending the sessions', async ({
    client,
    assert,
  }) => {
    const { store, manager } = await storeWithManager()
    const other = await storeWithManager()
    const attendant = await createUser({ password: 'secret123' })
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    await linkUser(other.store, attendant, StoreRole.ATTENDANT)
    const { session } = await signIn(client, { email: attendant.email, password: 'secret123' })

    const byAttendant = await client
      .put(`/api/v1/stores/${store.id}/members/${manager.id}/access`)
      .json({ enabled: false })
      .loginAs(attendant)
    const byOtherStore = await client
      .put(`/api/v1/stores/${store.id}/members/${attendant.id}/access`)
      .json({ enabled: false })
      .loginAs(other.manager)
    const self = await client
      .put(`/api/v1/stores/${store.id}/members/${manager.id}/access`)
      .json({ enabled: false })
      .loginAs(manager)
    const disabled = await client
      .put(`/api/v1/stores/${store.id}/members/${attendant.id}/access`)
      .json({ enabled: false })
      .loginAs(manager)

    byAttendant.assertStatus(403)
    byOtherStore.assertStatus(403)
    self.assertStatus(409)
    disabled.assertStatus(200)
    assert.isNotNull(disabled.body().data.disabledAt)
    assert.isFalse(disabled.body().data.online)

    // Another store is left: the open session goes on there, not here
    // (sessions aren't per store, and a manager here can't end them there).
    const here = await client
      .get(`/api/v1/stores/${store.id}/orders`)
      .withCookie(SESSION_COOKIE, session)
    const there = await client
      .get(`/api/v1/stores/${other.store.id}/orders`)
      .withCookie(SESSION_COOKIE, session)
    const me = await client.get('/api/v1/auth/me').withCookie(SESSION_COOKIE, session)
    here.assertStatus(403)
    there.assertStatus(200)
    assert.deepEqual(
      me.body().data.user.stores.map((item: { id: string }) => item.id),
      [other.store.id]
    )

    // Kept in the team, with the role, and back on.
    const enabled = await client
      .put(`/api/v1/stores/${store.id}/members/${attendant.id}/access`)
      .json({ enabled: true })
      .loginAs(manager)
    const again = await client.get(`/api/v1/stores/${store.id}/orders`).loginAs(attendant)
    enabled.assertBodyContains({ data: { id: attendant.id, role: 'attendant', disabledAt: null } })
    again.assertStatus(200)
  })

  test('a disabled manager does not count as an active manager', async ({ client }) => {
    const { store, manager } = await storeWithManager()
    const second = await createUser()
    await linkUser(store, second, StoreRole.MANAGER)

    const disableSecond = await client
      .put(`/api/v1/stores/${store.id}/members/${second.id}/access`)
      .json({ enabled: false })
      .loginAs(manager)
    // `second` is off: `manager` is the only active manager left.
    const demoteLast = await client
      .put(`/api/v1/stores/${store.id}/members/${manager.id}`)
      .json({ role: 'attendant' })
      .loginAs(manager)
    const disabledCanAct = await client.get(`/api/v1/stores/${store.id}/members`).loginAs(second)

    disableSecond.assertStatus(200)
    demoteLast.assertStatus(409)
    demoteLast.assertBodyContains({ code: 'E_LAST_MANAGER' })
    disabledCanAct.assertStatus(403)
  })

  test('managers can end a member sessions without removing access', async ({ client, assert }) => {
    const { store, manager } = await storeWithManager()
    const admin = await createUser({ superUser: true })
    const attendant = await createUser({ password: 'secret123' })
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    await linkUser(store, admin, StoreRole.MANAGER)
    const { session } = await signIn(client, { email: attendant.email, password: 'secret123' })

    const revoked = await client
      .delete(`/api/v1/stores/${store.id}/members/${attendant.id}/sessions`)
      .loginAs(manager)
    const onAdmin = await client
      .delete(`/api/v1/stores/${store.id}/members/${admin.id}/sessions`)
      .loginAs(manager)
    const disableAdmin = await client
      .put(`/api/v1/stores/${store.id}/members/${admin.id}/access`)
      .json({ enabled: false })
      .loginAs(manager)

    revoked.assertStatus(200)
    assert.equal(revoked.body().data.ended, 1)
    onAdmin.assertBodyContains({ code: 'E_SUPER_USER' })
    disableAdmin.assertBodyContains({ code: 'E_SUPER_USER' })
    const oldSession = await client.get('/api/v1/auth/me').withCookie(SESSION_COOKIE, session)
    const stillMember = await client.get(`/api/v1/stores/${store.id}/orders`).loginAs(attendant)
    oldSession.assertStatus(401)
    stillMember.assertStatus(200)
  })

  test('without a store to access, the account cannot sign in', async ({ client, assert }) => {
    const fake = mail.fake()
    const loose = await createUser({ password: 'secret123' })
    const admin = await createUser({ password: 'secret123', superUser: true })
    const { store, manager } = await storeWithManager()
    const disabled = await createUser({ password: 'secret123' })
    await linkUser(store, disabled, StoreRole.ATTENDANT)
    await client
      .put(`/api/v1/stores/${store.id}/members/${disabled.id}/access`)
      .json({ enabled: false })
      .loginAs(manager)

    const noStore = await client
      .post('/api/v1/auth/login')
      .json({ email: loose.email, password: 'secret123' })
    const onlyDisabled = await client
      .post('/api/v1/auth/login')
      .json({ email: disabled.email, password: 'secret123' })
    const wrongPassword = await client
      .post('/api/v1/auth/login')
      .json({ email: loose.email, password: 'wrong-password' })

    noStore.assertStatus(403)
    noStore.assertBodyContains({ code: 'E_NO_STORE_ACCESS' })
    onlyDisabled.assertStatus(403)
    // Only after the right password: it doesn't tell who has an account.
    wrongPassword.assertStatus(400)
    // No code is sent to someone who can't get in.
    assert.lengthOf(fake.mails.queued(), 0)
    mail.restore()
    // Super users see every store.
    const { response } = await signIn(client, { email: admin.email, password: 'secret123' })
    response.assertStatus(200)
  })

  test('losing the last store ends the open session', async ({ client }) => {
    const { store, manager } = await storeWithManager()
    const other = await storeWithManager()
    const attendant = await createUser({ password: 'secret123' })
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    await linkUser(other.store, attendant, StoreRole.ATTENDANT)
    const { session } = await signIn(client, { email: attendant.email, password: 'secret123' })

    // Removed from one store: the other keeps the session going.
    await client.delete(`/api/v1/stores/${store.id}/members/${attendant.id}`).loginAs(manager)
    const stillIn = await client.get('/api/v1/auth/me').withCookie(SESSION_COOKIE, session)
    // Removed from the last one: signed out.
    await client
      .delete(`/api/v1/stores/${other.store.id}/members/${attendant.id}`)
      .loginAs(other.manager)
    const out = await client.get('/api/v1/auth/me').withCookie(SESSION_COOKIE, session)

    stillIn.assertStatus(200)
    out.assertStatus(401)
  })

  test('a session left without stores ends on its next check', async ({ client }) => {
    const user = await createUser()
    // e.g. opened before this rule, or the membership deleted elsewhere.
    const me = await client.get('/api/v1/auth/me').loginAs(user)

    me.assertStatus(401)
  })

  test('switching off the only store ends the sessions and the trusted devices', async ({
    client,
    assert,
  }) => {
    const { store, manager } = await storeWithManager()
    const attendant = await createUser({ password: 'secret123' })
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const { session, trust } = await signIn(
      client,
      { email: attendant.email, password: 'secret123' },
      { remember: true }
    )
    assert.exists(trust)

    await client
      .put(`/api/v1/stores/${store.id}/members/${attendant.id}/access`)
      .json({ enabled: false })
      .loginAs(manager)

    const oldSession = await client.get('/api/v1/auth/me').withCookie(SESSION_COOKIE, session)
    oldSession.assertStatus(401)
    const devices = await db.from('trusted_devices').where('user_id', attendant.id)
    assert.lengthOf(devices, 0)
  })

  test('ending sessions needs every store of the person, and never another store', async ({
    client,
  }) => {
    const { store, manager } = await storeWithManager()
    const other = await storeWithManager()
    const both = await createUser()
    await linkUser(store, both, StoreRole.ATTENDANT)
    await linkUser(other.store, both, StoreRole.MANAGER)
    const onlyHere = await createUser()
    await linkUser(store, onlyHere, StoreRole.KITCHEN)

    const fromOtherStore = await client
      .delete(`/api/v1/stores/${store.id}/members/${onlyHere.id}/sessions`)
      .loginAs(other.manager)
    const worksElsewhere = await client
      .delete(`/api/v1/stores/${store.id}/members/${both.id}/sessions`)
      .loginAs(manager)
    const onlyThisStore = await client
      .delete(`/api/v1/stores/${store.id}/members/${onlyHere.id}/sessions`)
      .loginAs(manager)

    fromOtherStore.assertStatus(403)
    worksElsewhere.assertStatus(409)
    worksElsewhere.assertBodyContains({ code: 'E_OTHER_STORES' })
    onlyThisStore.assertStatus(200)
  })

  test('a switched-off member gets no invite', async ({ client }) => {
    const { store, manager } = await storeWithManager()
    await client
      .post(`/api/v1/stores/${store.id}/members`)
      .json({ email: 'desligado@example.com', role: 'attendant' })
      .loginAs(manager)
    const invited = await User.findByOrFail('email', 'desligado@example.com')
    await client
      .put(`/api/v1/stores/${store.id}/members/${invited.id}/access`)
      .json({ enabled: false })
      .loginAs(manager)

    const resent = await client
      .post(`/api/v1/stores/${store.id}/members/${invited.id}/invite`)
      .loginAs(manager)

    resent.assertStatus(409)
    resent.assertBodyContains({ code: 'E_ACCESS_DISABLED' })
  })

  test('someone allowed to create stores signs in before having one', async ({ client }) => {
    const founder = await createUserWithPermissions(['create_store'])
    founder.password = 'secret123'
    await founder.save()

    const { response } = await signIn(client, { email: founder.email, password: 'secret123' })

    response.assertStatus(200)
  })
})
