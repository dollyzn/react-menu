import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import drive from '@adonisjs/drive/services/main'
import app from '@adonisjs/core/services/app'
import ImagesBlur from '../../commands/images_blur.js'
import StoreRole from '#enums/store_role'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

/** A valid 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

test.group('Store images', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('the banner and the logo get blurred previews, in the panel and the menu', async ({
    client,
    assert,
  }) => {
    const { store } = await createMenuStore()
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)

    const response = await client
      .patch(`/api/v1/stores/${store.id}/images`)
      .file('banner', PNG, { filename: 'banner.png' })
      .file('photo', PNG, { filename: 'logo.png' })
      .loginAs(manager)
    response.assertStatus(200)
    const saved = response.body().data
    assert.match(saved.bannerBlur, /^data:image\/webp;base64,/)
    assert.match(saved.photoBlur, /^data:image\/webp;base64,/)

    const menu = await client.get(`/api/v1/public/menu/${store.slug}`)
    assert.equal(menu.body().data.store.bannerBlur, saved.bannerBlur)
    assert.equal(menu.body().data.store.photoBlur, saved.photoBlur)
  })

  test("another store's manager cannot change them", async ({ client }) => {
    const { store } = await createMenuStore()
    const other = await createMenuStore()
    const outsider = await createUser()
    await linkUser(other.store, outsider, StoreRole.MANAGER)

    const response = await client
      .patch(`/api/v1/stores/${store.id}/images`)
      .file('banner', PNG, { filename: 'banner.png' })
      .loginAs(outsider)
    response.assertStatus(403)
  })
})

test.group('images:blur', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(() => {
    drive.fake()
    return () => drive.restore()
  })

  test('makes the previews of photos stored before them', async ({ assert }) => {
    const { store, carne } = await createMenuStore()
    const disk = drive.use()
    await disk.put('items/old.png', PNG)
    carne.photoUrl = await disk.getUrl('items/old.png')
    carne.photoBlur = null
    await carne.save()

    const ace = await app.container.make('ace')
    const command = await ace.create(ImagesBlur, [`--store=${store.slug}`])
    await command.exec()
    command.assertSucceeded()

    await carne.refresh()
    assert.match(carne.photoBlur!, /^data:image\/webp;base64,/)
  })
})
