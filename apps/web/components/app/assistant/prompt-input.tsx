"use client";

import { useRef, useState } from "react";
import { ArrowUp, Brain, ChevronDown, Gauge, ImagePlus, Square, X, Zap, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import type {
  AssistantEffort,
  AssistantModelChoice,
  AssistantProvider,
  AssistantTokens,
  AssistantUsage,
} from "@react-menu/contracts";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentMedia,
} from "@/components/ui/attachment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import Image from "@/components/app/image";
import { ImageCompressError } from "@/lib/image-compress";
import { photoPart } from "@/lib/assistant";
import { ProviderLogo } from "./provider-logo";

export type PromptPhoto = Awaited<ReturnType<typeof photoPart>> & { id: string };

const EFFORTS: { value: AssistantEffort; label: string; icon: LucideIcon; description: string }[] = [
  {
    value: "fast",
    label: "Rápido",
    icon: Zap,
    description: "Responde em segundos. Para o dia a dia: vendas, estoque, pedidos, pausar um item.",
  },
  {
    value: "deep",
    label: "Detalhado",
    icon: Brain,
    description: "Pensa mais antes de responder: comparações, análises e montar o cardápio por foto. Mais lento e gasta mais.",
  },
];

const MAX_PHOTOS = 4;

/** "12,4 mil", "1,2 mi" */
const compact = (value: number) =>
  value.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export type SessionContext = {
  /** Tokens of the whole conversation so far. */
  tokens: AssistantTokens;
  /** Input of the last model call: how much of the window the conversation fills. */
  contextTokens: number;
  /** The model's window, when the provider says. */
  contextWindow: number | null;
};

function Meter({ label, value, max, hint }: { label: string; value: number; max: number; hint?: string }) {
  const percent = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {compact(value)} / {compact(max)}
        </span>
      </div>
      <Progress value={percent} aria-label={label} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * How full things are (Context pattern): this conversation's share of the
 * model's context window and its tokens, and the store's messages today.
 */
function ContextMeter({ usage, session }: { usage?: AssistantUsage; session: SessionContext }) {
  const windowPercent = session.contextWindow
    ? Math.min(100, Math.round((session.contextTokens / session.contextWindow) * 100))
    : null;
  const dayPercent = usage ? Math.min(100, Math.round((usage.used / Math.max(usage.limit, 1)) * 100)) : null;
  const label =
    windowPercent !== null && session.contextTokens > 0
      ? `${windowPercent}%`
      : session.contextTokens > 0
        ? compact(session.contextTokens)
        : dayPercent !== null
          ? `${dayPercent}%`
          : null;
  if (label === null) return null;
  const rows = [
    { label: "Entrada", value: session.tokens.input },
    { label: "Do cache", value: session.tokens.cachedInput },
    { label: "Saída", value: session.tokens.output },
    { label: "Raciocínio", value: session.tokens.reasoning },
  ];
  return (
    // A popover, not a hover card: phones have no hover, so a tap opens it too.
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={10}
        closeDelay={100}
        render={<InputGroupButton size="xs" variant="ghost" className="tabular-nums text-muted-foreground" aria-label="Uso do contexto e do limite" />}
      >
        <Gauge />
        {label}
      </PopoverTrigger>
      <PopoverContent side="top" className="flex w-72 flex-col gap-4">
        {session.contextTokens > 0 && (
          <div className="flex flex-col gap-3">
            {session.contextWindow ? (
              <Meter
                label="Contexto da conversa"
                value={session.contextTokens}
                max={session.contextWindow}
                hint="Quanto da memória do modelo esta conversa já ocupa. Cheia, comece uma nova."
              />
            ) : (
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Contexto da conversa</span>
                <span className="text-muted-foreground tabular-nums">{compact(session.contextTokens)} tokens</span>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {rows.map((row) => (
                <div key={row.label} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="tabular-nums">{compact(row.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {usage && (
          <Meter
            label="Mensagens da loja hoje"
            value={usage.used}
            max={usage.limit}
            hint={
              usage.tokens
                ? `${compact(usage.tokens.input + usage.tokens.output)} tokens hoje, todos os modelos. Volta a zero amanhã.`
                : "O limite é da loja toda e volta a zero amanhã."
            }
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

const PROVIDER_SHORT: Record<AssistantProvider, string> = { anthropic: "Claude", openai: "ChatGPT", google: "Gemini" };

/** The model of the next answer (Model Selector pattern), grouped by provider. */
function ModelMenu({
  models,
  value,
  onChange,
}: {
  models: AssistantModelChoice[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const current = models.find((model) => model.id === value) ?? models[0];
  if (!current || models.length < 2) {
    return current ? (
      <span className="flex min-w-0 max-w-36 items-center gap-1 px-1 text-xs text-muted-foreground" title={current.model}>
        <ProviderLogo provider={current.provider} className="size-3.5" />
        <span className="truncate">{current.name}</span>
      </span>
    ) : null;
  }
  const providers = [...new Set(models.map((model) => model.provider))];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<InputGroupButton size="xs" variant="ghost" aria-label={`Modelo: ${current.name}`} className="min-w-0 max-w-36 shrink" />}>
        <ProviderLogo provider={current.provider} />
        <span className="truncate">{current.name}</span>
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="min-w-56">
        <DropdownMenuRadioGroup value={current.id} onValueChange={(next) => onChange(String(next))}>
          {providers.map((provider) => (
            <DropdownMenuGroup key={provider}>
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <ProviderLogo provider={provider} className="size-3.5" />
                {PROVIDER_SHORT[provider]}
              </DropdownMenuLabel>
              {models
                .filter((model) => model.provider === provider)
                .map((model) => (
                  <DropdownMenuRadioItem key={model.id} value={model.id} closeOnClick className="items-start py-1.5">
                    <span className="flex flex-col">
                      <span>{model.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {model.model}
                        {model.contextWindow ? ` · ${compact(model.contextWindow)} de contexto` : ""}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Send and stop in one place: the arrow lifts in when there is something to
 * send, swaps for a stop square while the answer streams.
 */
function SendButton({ busy, ready, onStop }: { busy: boolean; ready: boolean; onStop: () => void }) {
  const reduce = useReducedMotion();
  const swap = reduce
    ? {}
    : { initial: { scale: 0.4, opacity: 0, rotate: -45 }, animate: { scale: 1, opacity: 1, rotate: 0 }, exit: { scale: 0.4, opacity: 0, rotate: 45 } };
  return (
    <motion.span
      animate={reduce ? undefined : { scale: busy || ready ? 1 : 0.92 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="inline-flex"
    >
      <InputGroupButton
        type={busy ? "button" : "submit"}
        size="icon-sm"
        variant={busy || ready ? "default" : "outline"}
        className="rounded-full transition-colors duration-200"
        aria-label={busy ? "Parar a resposta" : "Enviar"}
        aria-disabled={!busy && !ready}
        onClick={(event) => {
          if (busy) onStop();
          else if (!ready) event.preventDefault();
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={busy ? "stop" : "send"} {...swap} transition={{ duration: 0.18 }} className="inline-flex">
            {busy ? <Square className="fill-current" /> : <ArrowUp />}
          </motion.span>
        </AnimatePresence>
      </InputGroupButton>
    </motion.span>
  );
}

/**
 * The message field (Prompt Input pattern): photos above the text, then the
 * attach button, how hard the assistant thinks, today's usage and send/stop.
 */
export function PromptInput({
  busy,
  disabled,
  usage,
  session,
  models,
  model,
  onModelChange,
  effort,
  onEffortChange,
  onSubmit,
  onStop,
}: {
  busy: boolean;
  disabled?: boolean;
  usage?: AssistantUsage;
  session: SessionContext;
  models: AssistantModelChoice[];
  model: string | null;
  onModelChange: (id: string) => void;
  effort: AssistantEffort;
  onEffortChange: (effort: AssistantEffort) => void;
  onSubmit: (text: string, photos: PromptPhoto[]) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<PromptPhoto[]>([]);
  const [reading, setReading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSend = (text.trim().length > 0 || photos.length > 0) && !busy && !reading && !disabled;
  const current = EFFORTS.find((item) => item.value === effort) ?? EFFORTS[0];

  const addFiles = async (files: File[]) => {
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) toast.error(`Envie até ${MAX_PHOTOS} fotos por mensagem.`, { id: "assistant-photos" });
    setReading(true);
    try {
      const added: PromptPhoto[] = [];
      for (const file of files.slice(0, Math.max(room, 0))) {
        added.push({ ...(await photoPart(file)), id: `${file.name}-${file.size}-${Date.now()}` });
      }
      setPhotos((list) => [...list, ...added]);
    } catch (error) {
      toast.error(error instanceof ImageCompressError ? error.message : "Não foi possível ler a foto.", { id: "assistant-photos" });
    } finally {
      setReading(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    onSubmit(text.trim(), photos);
    setText("");
    setPhotos([]);
  };

  return (
    <form ref={formRef} onSubmit={submit} className="w-full">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Escolher fotos"
        onChange={(event) => {
          void addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <InputGroup className="@container/prompt rounded-2xl bg-background shadow-xs">
        {photos.length > 0 && (
          <InputGroupAddon align="block-start" className="flex-wrap gap-2">
            {photos.map((photo) => (
              <Attachment key={photo.id} size="sm" className="w-auto">
                <AttachmentMedia className="size-12">
                  <Image src={photo.url} alt={photo.filename} width={48} height={48} unoptimized className="size-full object-cover" />
                </AttachmentMedia>
                <AttachmentActions>
                  <AttachmentAction
                    aria-label={`Remover ${photo.filename}`}
                    onClick={() => setPhotos((list) => list.filter((item) => item.id !== photo.id))}
                  >
                    <X />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            ))}
          </InputGroupAddon>
        )}
        <InputGroupTextarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
            if (files.length) {
              event.preventDefault();
              void addFiles(files);
            }
          }}
          onKeyDown={(event) => {
            // Phones' keyboards have no Shift: there Enter is a new line and
            // the send button sends (a menu list takes several lines).
            const touch = window.matchMedia("(pointer: coarse)").matches;
            if (event.key === "Enter" && !event.shiftKey && !touch && !event.nativeEvent.isComposing) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          placeholder="Pergunte sobre vendas, estoque, pedidos…"
          id="assistant-prompt"
          aria-label="Mensagem para o assistente"
          maxLength={4000}
          disabled={disabled}
          className="max-h-40 min-h-14 p-3"
        />
        <InputGroupAddon align="block-end" className="min-w-0 gap-1">
          <InputGroupButton
            size="icon-sm"
            variant="ghost"
            aria-label="Anexar foto"
            disabled={disabled || reading || photos.length >= MAX_PHOTOS}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus />
          </InputGroupButton>
          <ModelMenu models={models} value={model} onChange={onModelChange} />
          <DropdownMenu>
            <DropdownMenuTrigger render={<InputGroupButton size="xs" variant="ghost" aria-label={`Modo de resposta: ${current.label}`} />}>
              <current.icon />
              {/* Narrow screens keep only the icon, so the model and send fit. */}
              <span className="@max-[22rem]/prompt:hidden">{current.label}</span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="max-w-72">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Como o assistente responde</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={effort} onValueChange={(value) => onEffortChange(value as AssistantEffort)}>
                  {EFFORTS.map((item) => (
                    <DropdownMenuRadioItem key={item.value} value={item.value} closeOnClick className="items-start py-2">
                      <item.icon className="mt-0.5" />
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-xs whitespace-normal text-muted-foreground">{item.description}</span>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="ml-auto flex items-center gap-1">
            <ContextMeter usage={usage} session={session} />
            <SendButton busy={busy} ready={canSend} onStop={onStop} />
          </div>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
