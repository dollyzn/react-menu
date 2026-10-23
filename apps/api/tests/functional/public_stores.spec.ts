import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreStatus from '#enums/store_status'
import { createStore } from '#tests/helpers/fixtures'

test.group('Public store listing (sitemap)', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('lists menus for search engines, not stores under maintenance', async ({
    client,
    assert,
  }) => {
    const open = await createStore()
    const closed = await createStore()
    closed.status = StoreStatus.CLOSED
    await closed.save()
    const maintenance = await createStore()
    maintenance.status = StoreStatus.MAINTENANCE
    await maintenance.save()

    const response = await client.get('/api/v1/public/stores')

    response.assertStatus(200)
    const slugs = response.body().data.map((store: { slug: string }) => store.slug)
    assert.includeMembers(slugs, [open.slug, closed.slug])
    assert.notInclude(slugs, maintenance.slug)
    assert.properties(response.body().data[0], ['slug', 'isDefault', 'updatedAt'])
  })
})
