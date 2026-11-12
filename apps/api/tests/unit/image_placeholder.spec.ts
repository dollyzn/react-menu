import { test } from '@japa/runner'
import { crc32, deflateSync } from 'node:zlib'
import { blurPlaceholder } from '#helpers/image_placeholder'

/** A PNG chunk: length, type, data and CRC. */
function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** A PNG whose header says width × height (grayscale), with a tiny body. */
function png(width: number, height: number) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.writeUInt8(8, 8) // bit depth
  header.writeUInt8(0, 9) // grayscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc(height * (width + 1)))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

test.group('Image placeholder', () => {
  test('a normal image gets a tiny WebP preview', async ({ assert }) => {
    const blur = await blurPlaceholder(png(64, 48))
    assert.match(blur!, /^data:image\/webp;base64,/)
    assert.isBelow(blur!.length, 400)
  })

  test('an image huge in pixels (small in bytes) is never decoded', async ({ assert }) => {
    // 10000 × 10000 = 100 MP: over the limit, refused from its header.
    const started = Date.now()
    assert.isNull(await blurPlaceholder(png(10_000, 10_000)))
    assert.isBelow(Date.now() - started, 2000)
  })
})
