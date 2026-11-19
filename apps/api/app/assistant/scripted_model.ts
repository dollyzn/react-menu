import { simulateReadableStream, type LanguageModel } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

type MockOptions = NonNullable<ConstructorParameters<typeof MockLanguageModelV4>[0]>
type StreamResult = Awaited<ReturnType<MockLanguageModelV4['doStream']>>
/** What the model receives on each call (AI SDK language model prompt and settings). */
export type ModelCall = MockLanguageModelV4['doStreamCalls'][number]
export type StreamPart = StreamResult['stream'] extends ReadableStream<infer T> ? T : never

let counter = 0
const nextId = (prefix: string) => `${prefix}_${++counter}`

/** Stream parts for scripted turns. */
export const say = {
  text(text: string): StreamPart[] {
    const id = nextId('text')
    return [
      { type: 'text-start', id },
      // A few words at a time, like a real stream.
      ...(text.match(/\S+\s*/g) ?? []).map((delta) => ({ type: 'text-delta' as const, id, delta })),
      { type: 'text-end', id },
    ]
  },
  reasoning(text: string): StreamPart[] {
    const id = nextId('reasoning')
    return [
      { type: 'reasoning-start', id },
      { type: 'reasoning-delta', id, delta: text },
      { type: 'reasoning-end', id },
    ]
  },
  tool(toolName: string, input: Record<string, unknown>): StreamPart[] {
    return [
      { type: 'tool-call', toolCallId: nextId('call'), toolName, input: JSON.stringify(input) },
    ]
  },
}

/** A turn's parts, closed by the finish the AI SDK expects. */
function turn(parts: StreamPart[]): StreamResult {
  const calls = parts.some((part) => part.type === 'tool-call')
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: 'stream-start', warnings: [] },
        ...parts,
        {
          type: 'finish',
          finishReason: { unified: calls ? 'tool-calls' : 'stop', raw: undefined },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 5, text: 5, reasoning: 0 },
          },
        },
      ],
      chunkDelayInMs: null,
      initialDelayInMs: null,
    }),
  }
}

/**
 * A language model that answers each call with `respond(call)`: the
 * development fake and the tests use it (no provider, no key, no cost).
 */
export function scriptedModel(
  respond: (call: ModelCall) => StreamPart[],
  options: Pick<MockOptions, 'modelId' | 'provider'> = {}
): LanguageModel & MockLanguageModelV4 {
  const model: MockLanguageModelV4 = new MockLanguageModelV4({
    provider: options.provider ?? 'fake',
    modelId: options.modelId ?? 'fake',
    doStream: async (call) => turn(respond(call)),
  })
  return model
}
