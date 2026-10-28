import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import drive from '@adonisjs/drive/services/main'
import StoreRole from '#enums/store_role'
import Item from '#models/item'
import { uploadKey } from '#helpers/uploads'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

/** A valid 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

async function managerStore() {
  const menu = await createMenuStore()
  const manager = await createUser()
  await linkUser(menu.store, manager, StoreRole.MANAGER)
  return { ...menu, manager }
}

test.group('Item photos', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('managers upload, replace and remove the photo; old files are deleted', async ({
    client,
    assert,
  }) => {
    const { store, carne, manager } = await managerStore()
    const url = `/api/v1/stores/${store.id}/items/${carne.id}/photo`
    const disk = drive.use()

    const first = await client
      .put(url)
      .file('photo', PNG, { filename: 'pastel.png' })
      .loginAs(manager)
    first.assertStatus(200)
    const firstUrl = first.body().data.photoUrl as string
    const firstKey = uploadKey(firstUrl, 'items')!
    assert.match(firstKey, new RegExp(`^items/${carne.id}_[\\w-]+\\.png$`))
    assert.isTrue(await disk.exists(firstKey))
    assert.properties(first.body().data, ['category', 'addons', 'optionGroups'])

    const second = await client
      .put(url)
      .file('photo', PNG, { filename: 'novo.png' })
      .loginAs(manager)
    const secondKey = uploadKey(second.body().data.photoUrl, 'items')!
    assert.notEqual(secondKey, firstKey)
    assert.isTrue(await disk.exists(secondKey))
    assert.isFalse(await disk.exists(firstKey), 'the replaced photo is deleted')

    const removed = await client.delete(url).loginAs(manager)
    const again = await client.delete(url).loginAs(manager)
    removed.assertStatus(200)
    again.assertStatus(200)
    assert.isNull(removed.body().data.photoUrl)
    assert.isFalse(await disk.exists(secondKey))
  })

  test('only images; nobody else; the item form cannot set a URL', async ({ client, assert }) => {
    const { store, carne, manager } = await managerStore()
    const attendant = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const other = await managerStore()
    const url = `/api/v1/stores/${store.id}/items/${carne.id}/photo`

    const text = await client
      .put(url)
      .file('photo', Buffer.from('not an image'), { filename: 'notes.txt' })
      .loginAs(manager)
    const missing = await client.put(url).loginAs(manager)
    const byAttendant = await client
      .put(url)
      .file('photo', PNG, { filename: 'a.png' })
      .loginAs(attendant)
    const byOtherStore = await client
      .put(url)
      .file('photo', PNG, { filename: 'a.png' })
      .loginAs(other.manager)
    // Another store's item through this store's URL.
    const foreignItem = await client
      .put(`/api/v1/stores/${store.id}/items/${other.carne.id}/photo`)
      .file('photo', PNG, { filename: 'a.png' })
      .loginAs(manager)
    const viaForm = await client
      .put(`/api/v1/stores/${store.id}/items/${carne.id}`)
      .json({ photoUrl: 'https://evil.example/tracker.png' })
      .loginAs(manager)

    text.assertStatus(422)
    missing.assertStatus(422)
    byAttendant.assertStatus(403)
    byOtherStore.assertStatus(403)
    foreignItem.assertStatus(404)
    viaForm.assertStatus(200)
    await carne.refresh()
    assert.isNull(carne.photoUrl, 'photos only arrive as uploads')
  })

  test('deleting an item deletes its photo; seeded demo photos are never deleted', async ({
    client,
    assert,
  }) => {
    const { store, carne, queijo, manager } = await managerStore()
    const disk = drive.use()
    const upload = await client
      .put(`/api/v1/stores/${store.id}/items/${carne.id}/photo`)
      .file('photo', PNG, { filename: 'a.png' })
      .loginAs(manager)
    const key = uploadKey(upload.body().data.photoUrl, 'items')!

    await client.delete(`/api/v1/stores/${store.id}/items/${carne.id}`).loginAs(manager)
    assert.isFalse(await disk.exists(key))

    // A demo photo (shared by several items) is replaced but stays on the disk.
    await disk.put('menu/demo-pastel.webp', 'demo')
    await Item.query()
      .where('id', queijo.id)
      .update({ photo_url: await disk.getUrl('menu/demo-pastel.webp') })
    await client
      .put(`/api/v1/stores/${store.id}/items/${queijo.id}/photo`)
      .file('photo', PNG, { filename: 'a.png' })
      .loginAs(manager)
    assert.isTrue(await disk.exists('menu/demo-pastel.webp'))
  })

  test('a missing upload answers 404, not 500', async ({ client }) => {
    const response = await client.get('/uploads/items/does-not-exist.webp')
    response.assertStatus(404)
  })
})
