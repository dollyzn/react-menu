"use client";

import { useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { RotateCw, Sparkles, TriangleAlert } from "lucide-react";
import type { AssistantEffort, AssistantModelChoice, AssistantUsage, StoreRole } from "@react-menu/contracts";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { type AssistantUIMessage, chatErrorText, suggestionsFor } from "@/lib/assistant";
import { baseApi } from "@/redux/api/baseApi";
import { assistantTagsAfterAnswer, panelTagsAfterWrite } from "@/redux/features/assistant/assistantApi";
import { useAppDispatch } from "@/redux/hooks";
import { AssistantMessage, changedData, UserMessage } from "./assistant-message";
import { PromptInput, type PromptPhoto, type SessionContext } from "./prompt-input";

/**
 * The chat's connection to the API. The API keeps the conversation, so only
 * the newest message goes, with how hard to think and the screen the person
 * is on (also on the request the chat sends by itself after approvals).
 */
type Settings = { effort: AssistantEffort; page: string | null; model: string | null };

class AssistantTransport extends DefaultChatTransport<AssistantUIMessage> {
  #settings: Settings = { effort: "fast", page: null, model: null };

  constructor(storeId: string) {
    super({
      api: `${getApiBaseUrl()}stores/${storeId}/assistant/chat`,
      credentials: "include",
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: {
          id,
          message: messages.at(-1),
          effort: this.#settings.effort,
          page: this.#settings.page ?? undefined,
          model: this.#settings.model ?? undefined,
        },
      }),
    });
  }

  configure(settings: Settings) {
    this.#settings = settings;
  }
}

/**
 * This conversation's tokens (every answer's, summed) and how full the
 * context is (the last answer's last call), against its model's window.
 */
function sessionOf(messages: AssistantUIMessage[], models: AssistantModelChoice[], chosen: string | null): SessionContext {
  const tokens = { input: 0, output: 0, reasoning: 0, cachedInput: 0 };
  let contextTokens = 0;
  let lastModel: string | undefined;
  for (const message of messages) {
    const metadata = message.metadata;
    if (message.role !== "assistant" || !metadata?.tokens) continue;
    tokens.input += metadata.tokens.input;
    tokens.output += metadata.tokens.output;
    tokens.reasoning += metadata.tokens.reasoning;
    tokens.cachedInput += metadata.tokens.cachedInput;
    contextTokens = metadata.contextTokens ?? contextTokens;
    lastModel = metadata.model ?? lastModel;
  }
  const window = models.find((item) => item.id === (lastModel ?? chosen))?.contextWindow ?? null;
  return { tokens, contextTokens, contextWindow: window };
}

/** One-tap questions (Suggestion pattern): outline pills that scroll sideways. */
function Suggestions({ items, onPick, disabled }: { items: string[]; onPick: (text: string) => void; disabled?: boolean }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="list" aria-label="Sugestões">
      {items.map((text) => (
        <Button
          key={text}
          role="listitem"
          variant="outline"
          size="sm"
          className="shrink-0 rounded-full font-normal"
          disabled={disabled}
          onClick={() => onPick(text)}
        >
          {text}
        </Button>
      ))}
    </div>
  );
}

/**
 * A conversation with the store assistant: the thread (Chat pattern, on
 * Message Scroller), the field, and the answers streamed from the API
 * (AI SDK UI messages). Writes wait for an Aprovar/Recusar on their card;
 * the chat goes on by itself once every one is answered.
 */
export function AssistantChat({
  storeId,
  conversationId,
  initialMessages,
  page,
  role,
  usage,
  models,
  model,
  onModelChange,
  effort,
  onEffortChange,
  onAnswered,
}: {
  storeId: string;
  conversationId: string;
  initialMessages: AssistantUIMessage[];
  page: string | null;
  role: StoreRole | null;
  usage?: AssistantUsage;
  /** The store's models and the one chosen (kept by the panel across conversations). */
  models: AssistantModelChoice[];
  model: string | null;
  onModelChange: (id: string) => void;
  effort: AssistantEffort;
  onEffortChange: (effort: AssistantEffort) => void;
  /** After each answer: the conversation exists and is the one to come back to. */
  onAnswered?: () => void;
}) {
  const dispatch = useAppDispatch();
  // One transport per conversation (the chat is keyed by it); what it sends
  // with each request is kept up to date outside render.
  const [transport] = useState(() => new AssistantTransport(storeId));
  useEffect(() => transport.configure({ effort, page, model }), [transport, effort, page, model]);

  const { messages, sendMessage, status, stop, error, regenerate, addToolApprovalResponse, clearError } =
    useChat<AssistantUIMessage>({
      id: conversationId,
      messages: initialMessages,
      transport,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
      onFinish: ({ message }) => {
        // A change the assistant made: the panel's screens behind the sheet refetch.
        const wrote = changedData(message);
        dispatch(baseApi.util.invalidateTags([...assistantTagsAfterAnswer(storeId), ...(wrote ? panelTagsAfterWrite(storeId) : [])]));
        onAnswered?.();
      },
    });

  const busy = status === "submitted" || status === "streaming";
  const lastMetadataUsage = [...messages].reverse().find((message) => message.metadata?.usage)?.metadata?.usage;
  const currentUsage = lastMetadataUsage ?? usage;
  const limitReached = Boolean(currentUsage && currentUsage.used >= currentUsage.limit);
  const suggestions = suggestionsFor(page, role);
  const errorText = chatErrorText(error);
  const session = sessionOf(messages, models, model);
  const lastMessage = messages.at(-1);
  const lastChanged = lastMessage?.role === "assistant" && changedData(lastMessage);

  const send = (text: string, photos: PromptPhoto[] = []) => {
    clearError();
    void sendMessage({
      text,
      files: photos.map(({ mediaType, url, filename }) => ({ type: "file" as const, mediaType, url, filename })),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        {messages.length === 0 ? (
          <Empty className="h-full justify-center gap-4 border-0 px-4">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
                <Sparkles />
              </EmptyMedia>
              <EmptyTitle>Como posso ajudar?</EmptyTitle>
              <EmptyDescription>
                {role === "manager"
                  ? "Eu consulto o sistema por você: vendas, estoque, pedidos, fiado e cardápio. Antes de mudar qualquer coisa, mostro o que vai mudar e espero você aprovar."
                  : "Eu consulto por você os pedidos de agora, o cardápio e se a loja está aberta."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="w-full max-w-sm">
              <div className="flex w-full flex-col gap-2">
                {suggestions.slice(0, 4).map((text) => (
                  <Button key={text} variant="outline" className="h-auto justify-start py-2 text-left font-normal whitespace-normal" disabled={limitReached} onClick={() => send(text)}>
                    {text}
                  </Button>
                ))}
              </div>
            </EmptyContent>
          </Empty>
        ) : (
          <MessageScrollerProvider autoScroll>
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent aria-busy={busy} className="gap-6 px-4 py-4">
                  {messages.map((message, index) => {
                    const last = index === messages.length - 1;
                    return (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                        scrollAnchor={message.role === "user"}
                        // Cards are much taller than the 10rem estimate: rendering
                        // off-screen turns would make the scroll jump.
                        className="[content-visibility:visible]"
                      >
                        {message.role === "user" ? (
                          <UserMessage message={message} waiting={last && status === "submitted"} />
                        ) : (
                          <AssistantMessage
                            message={message}
                            last={last}
                            streaming={busy && last}
                            busy={busy}
                            // Not after a change went through: asking again would lose it.
                            onRetry={last && !changedData(message) ? () => void regenerate({ messageId: message.id }) : undefined}
                            onAnswer={(id, approved) => void addToolApprovalResponse({ id, approved })}
                          />
                        )}
                      </MessageScrollerItem>
                    );
                  })}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton aria-label="Ir para o fim da conversa" />
            </MessageScroller>
          </MessageScrollerProvider>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t bg-background/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        {errorText && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Não deu certo</AlertTitle>
            <AlertDescription>{errorText}</AlertDescription>
            {messages.length > 0 && !limitReached && !lastChanged && (
              <AlertAction>
                <Button size="sm" variant="outline" onClick={() => void regenerate()}>
                  <RotateCw data-icon="inline-start" />
                  Tentar de novo
                </Button>
              </AlertAction>
            )}
          </Alert>
        )}
        {limitReached && !errorText && (
          <p className="text-xs text-muted-foreground">A loja usou todas as mensagens de hoje. Amanhã libera de novo.</p>
        )}
        {messages.length > 0 && <Suggestions items={suggestions} onPick={(text) => send(text)} disabled={limitReached || busy} />}
        <PromptInput
          busy={busy}
          disabled={limitReached}
          usage={currentUsage}
          session={session}
          models={models}
          model={model}
          onModelChange={onModelChange}
          effort={effort}
          onEffortChange={onEffortChange}
          onSubmit={send}
          onStop={() => void stop()}
        />
      </div>
    </div>
  );
}
