import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import drive from '@adonisjs/drive/services/main'
import StoreRole from '#enums/store_role'
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

test.group('Add-on photos', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('managers upload, replace and remove it; the menu shows it with its preview', async ({
    client,
    assert,
  }) => {
    const { store, catupiry, manager } = await managerStore()
    const url = `/api/v1/stores/${store.id}/addons/${catupiry.id}/photo`
    const disk = drive.use()

    const first = await client
      .put(url)
      .file('photo', PNG, { filename: 'catupiry.png' })
      .loginAs(manager)
    first.assertStatus(200)
    const firstKey = uploadKey(first.body().data.photoUrl, 'addons')!
    assert.match(firstKey, new RegExp(`^addons/${catupiry.id}_[\\w-]+\\.png$`))
    assert.match(first.body().data.photoBlur, /^data:image\/webp;base64,/)

    // The customer's menu lists it with the photo and its preview.
    const menu = await client.get(`/api/v1/public/menu/${store.slug}`)
    const listed = menu
      .body()
      .data.categories.flatMap(
        (category: { items: { addons: { id: string }[] }[] }) => category.items
      )
      .flatMap(
        (item: { addons: { id: string; photoUrl: string; photoBlur: string }[] }) => item.addons
      )
      .find((addon: { id: string }) => addon.id === catupiry.id)
    assert.equal(listed.photoUrl, first.body().data.photoUrl)
    assert.equal(listed.photoBlur, first.body().data.photoBlur)

    const second = await client
      .put(url)
      .file('photo', PNG, { filename: 'novo.png' })
      .loginAs(manager)
    const secondKey = uploadKey(second.body().data.photoUrl, 'addons')!
    assert.isFalse(await disk.exists(firstKey), 'the replaced photo is deleted')

    const removed = await client.delete(url).loginAs(manager)
    removed.assertStatus(200)
    assert.isNull(removed.body().data.photoUrl)
    assert.isNull(removed.body().data.photoBlur)
    assert.isFalse(await disk.exists(secondKey))
  })

  test('only images; nobody else; the form cannot set a URL; deleting it deletes the photo', async ({
    client,
    assert,
  }) => {
    const { store, catupiry, manager } = await managerStore()
    const attendant = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const other = await managerStore()
    const url = `/api/v1/stores/${store.id}/addons/${catupiry.id}/photo`

    const text = await client
      .put(url)
      .file('photo', Buffer.from('not an image'), { filename: 'notes.txt' })
      .loginAs(manager)
    text.assertStatus(422)
    const byAttendant = await client
      .put(url)
      .file('photo', PNG, { filename: 'a.png' })
      .loginAs(attendant)
    byAttendant.assertStatus(403)
    const byOtherStore = await client
      .put(url)
      .file('photo', PNG, { filename: 'a.png' })
      .loginAs(other.manager)
    byOtherStore.assertStatus(403)
    const foreign = await client
      .put(`/api/v1/stores/${store.id}/addons/${other.catupiry.id}/photo`)
      .file('photo', PNG, { filename: 'a.png' })
      .loginAs(manager)
    foreign.assertStatus(404)

    const viaForm = await client
      .put(`/api/v1/stores/${store.id}/addons/${catupiry.id}`)
      .json({ photoUrl: 'https://evil.example/tracker.png' })
      .loginAs(manager)
    viaForm.assertStatus(200)
    await catupiry.refresh()
    assert.isNull(catupiry.photoUrl, 'photos only arrive as uploads')

    const upload = await client.put(url).file('photo', PNG, { filename: 'a.png' }).loginAs(manager)
    const key = uploadKey(upload.body().data.photoUrl, 'addons')!
    await client.delete(`/api/v1/stores/${store.id}/addons/${catupiry.id}`).loginAs(manager)
    assert.isFalse(await drive.use().exists(key))
  })
})
