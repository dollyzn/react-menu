import { test } from '@japa/runner'
import StoreRole from '#enums/store_role'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { emptyDatabase } from '#tests/helpers/database'

async function managedStore(role = StoreRole.MANAGER) {
  const user = await createUser()
  const { store } = await createMenuStore()
  await linkUser(store, user, role)
  return { store, user }
}

test.group('Ingredient badges', (group) => {
  group.each.setup(() => emptyDatabase)

  test('an automatic badge follows the name, renames included', async ({ client, assert }) => {
    const { store, user } = await managedStore()
    const url = `/api/v1/stores/${store.id}/ingredients`

    const created = await client.post(url).json({ name: 'Queijo', unit: 'g' }).loginAs(user)
    created.assertStatus(200)
    const ingredient = created.body().data
    assert.include(ingredient, { icon: null, iconColor: null, iconLabel: null })
    assert.deepEqual(ingredient.badge, { emoji: '🧀', color: 'yellow', label: null })

    // The form sends the parts it left on automatic back as null.
    const renamed = await client
      .put(`${url}/${ingredient.id}`)
      .json({ name: 'Catupiry', icon: null, iconColor: null, iconLabel: null })
      .loginAs(user)
    renamed.assertStatus(200)
    assert.deepEqual(renamed.body().data.badge, { emoji: '🧀', color: 'sky', label: 'CAT' })

    const fries = await client
      .put(`${url}/${ingredient.id}`)
      .json({ name: 'Batata frita' })
      .loginAs(user)
    assert.equal(fries.body().data.badge.emoji, '🍟')
  })

  test("the manager's picks stay through a rename; no tag hides it", async ({ client, assert }) => {
    const { store, user } = await managedStore()
    const url = `/api/v1/stores/${store.id}/ingredients`

    const created = await client
      .post(url)
      .json({ name: 'Mussarela', unit: 'g', icon: '🥛', iconColor: 'pink', iconLabel: 'mz' })
      .loginAs(user)
    created.assertStatus(200)
    const { id, badge, iconLabel } = created.body().data
    assert.equal(iconLabel, 'MZ')
    assert.deepEqual(badge, { emoji: '🥛', color: 'pink', label: 'MZ' })

    const updated = await client
      .put(`${url}/${id}`)
      .json({ name: 'Mussarela de búfala', iconLabel: false })
      .loginAs(user)
    assert.equal(updated.body().data.iconLabel, false)
    assert.deepEqual(updated.body().data.badge, { emoji: '🥛', color: 'pink', label: null })
  })

  test('colors and tags outside the rules are refused', async ({ client }) => {
    const { store, user } = await managedStore()
    const url = `/api/v1/stores/${store.id}/ingredients`

    const color = await client
      .post(url)
      .json({ name: 'Catupiry', unit: 'g', iconColor: 'black' })
      .loginAs(user)
    color.assertStatus(422)

    const label = await client
      .post(url)
      .json({ name: 'Catupiry', unit: 'g', iconLabel: 'CATU' })
      .loginAs(user)
    label.assertStatus(422)
  })

  test('managers preview the automatic badge of a name', async ({ client, assert }) => {
    const { store, user } = await managedStore()

    const response = await client
      .get(`/api/v1/stores/${store.id}/ingredients/badge`)
      .qs({ name: 'Cheddar' })
      .loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, { emoji: '🧀', color: 'orange', label: 'CHE' })
  })

  test("attendants and other stores' managers can't preview badges", async ({ client }) => {
    const { store } = await managedStore()
    const outsider = await managedStore()
    const attendant = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const url = `/api/v1/stores/${store.id}/ingredients/badge`

    const other = await client.get(url).qs({ name: 'Cheddar' }).loginAs(outsider.user)
    other.assertStatus(403)
    const staff = await client.get(url).qs({ name: 'Cheddar' }).loginAs(attendant)
    staff.assertStatus(403)
  })
})
