"use client";

import { memo, useState } from "react";
import { Check, CircleX, Copy, Lightbulb, LoaderCircle, RefreshCw, ShieldQuestion, Sparkles } from "lucide-react";
import { Streamdown } from "streamdown";
import type { AssistantApprovalPreview } from "@react-menu/contracts";
import { PhotoAttachment } from "./photo-attachment";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import { useCopied } from "@/hooks/use-copied";
import {
  type AssistantPart,
  type AssistantToolPart,
  type AssistantUIMessage,
  isToolPart,
  TOOL_LABELS,
  toolNameOf,
} from "@/lib/assistant";
import { formatDay } from "@/lib/report-period";
import { cn } from "@/lib/utils";
import { ApprovalCard } from "./approval-card";
import { ToolResult } from "./tool-cards";
import { ToolCallDetails } from "./tool-call";

/** The reply as markdown (Streamdown), styled like the panel's text. */
export const Markdown = memo(function Markdown({ children, streaming }: { children: string; streaming?: boolean }) {
  return (
    <Streamdown
      mode={streaming ? "streaming" : "static"}
      isAnimating={streaming}
      controls={false}
      className="flex min-w-0 flex-col gap-2 text-sm leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_table]:text-xs [&_ul]:list-disc [&_ul]:pl-5"
    >
      {children}
    </Streamdown>
  );
});

/** "4s", "1min 12s". */
const seconds = (ms: number) => {
  const total = Math.max(1, Math.round(ms / 1000));
  return total < 60 ? `${total}s` : `${Math.floor(total / 60)}min ${total % 60}s`;
};

const textOf = (message: AssistantUIMessage) =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n\n")
    .trim();

/**
 * One thought of the model: providers send summaries that start with a bold
 * heading ("**Checking the stock**"), which becomes the step's title.
 */
function ReasoningStep({ text, running, ms }: { text: string; running: boolean; ms?: number }) {
  const heading = text.trim().match(/^\*\*(.+?)\*\*\s*/);
  const title = heading?.[1] ?? (running ? "Pensando" : "Pensou");
  const body = (heading ? text.trim().slice(heading[0].length) : text).trim();
  const line = (
    <TraceLine status={running ? "running" : undefined}>
      <TraceIcon>{running ? <LoaderCircle className="animate-spin" /> : <Lightbulb />}</TraceIcon>
      <TraceTitle>{title}</TraceTitle>
      {!running && ms !== undefined && <TraceDescription>{seconds(ms)}</TraceDescription>}
    </TraceLine>
  );
  if (!body) return line;
  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="text-xs [&_p]:text-xs">
        <Markdown streaming={running}>{body}</Markdown>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

type StepPart = (AssistantPart & { type: "reasoning" }) | AssistantToolPart;

/**
 * The steps of a turn (Chain of Thought pattern): one summary line, "Pensou
 * em 3 passos", that opens into each thought and tool call; open while it
 * runs. Without any thinking, the tool lines show by themselves.
 */
function ChainOfThought({
  parts,
  streaming,
  timeOf,
}: {
  parts: StepPart[];
  streaming: boolean;
  /** How long a thought took (server-timed, from the message's metadata). */
  timeOf: (part: StepPart) => number | undefined;
}) {
  const [open, setOpen] = useState<boolean>();
  const steps = parts.filter((part) => part.type !== "reasoning" || part.text.trim() || (streaming && part.state === "streaming"));
  const thoughts = steps.filter((part) => part.type === "reasoning").length;
  const rows = steps.map((part, index) =>
    part.type === "reasoning" ? (
      <ReasoningStep key={index} text={part.text} running={streaming && part.state === "streaming"} ms={timeOf(part)} />
    ) : (
      <ToolRow key={part.toolCallId} part={part} streaming={streaming} />
    )
  );
  if (thoughts === 0) return <Trace>{rows}</Trace>;

  const running =
    streaming &&
    steps.some((part) =>
      part.type === "reasoning" ? part.state === "streaming" : part.state === "input-streaming" || part.state === "input-available"
    );
  const waiting = steps.some((part) => part.type !== "reasoning" && part.state === "approval-requested");
  const thinking = steps.reduce((sum, part) => sum + (part.type === "reasoning" ? (timeOf(part) ?? 0) : 0), 0);
  const count = `${steps.length} ${steps.length === 1 ? "passo" : "passos"}`;
  const title = running ? "Pensando" : thinking > 0 ? `Pensou por ${seconds(thinking)}` : `Pensou em ${count}`;
  return (
    <Trace>
      <TraceCollapsible open={open ?? (running || waiting)} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger>
          <TraceLine status={running ? "running" : undefined}>
            <TraceIcon>{running ? <LoaderCircle className="animate-spin" /> : <Sparkles />}</TraceIcon>
            <TraceTitle>{title}</TraceTitle>
            {!running && thinking > 0 && <TraceDescription>{count}</TraceDescription>}
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent keepMounted className="pl-3">
          <Trace>{rows}</Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

/** Before the first word of a reply: one quiet line, under the person's message. */
export function ThinkingLine() {
  return (
    <Trace>
      <TraceLine status="running">
        <TraceIcon>
          <LoaderCircle className="animate-spin" />
        </TraceIcon>
        <TraceTitle>Pensando</TraceTitle>
      </TraceLine>
    </Trace>
  );
}

/** What a call was about, read from its input ("10/11 a 16/11", "carne"). */
function inputSummary(part: AssistantToolPart) {
  const input = (part.input ?? {}) as Record<string, unknown>;
  const day = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDay(value) : null);
  const from = day(input.from ?? input.baseFrom);
  const to = day(input.to ?? input.baseTo);
  const range = from && to ? (from === to ? from : `${from} a ${to}`) : null;
  const text = typeof input.query === "string" ? input.query : typeof input.search === "string" && input.search ? input.search : null;
  return [text && `“${text}”`, range].filter(Boolean).join(" · ") || null;
}

/** One tool call as a step (Tool pattern): running, done, failed or declined. */
function ToolRow({ part, streaming }: { part: AssistantToolPart; streaming: boolean }) {
  const label = TOOL_LABELS[toolNameOf(part)] ?? { running: "Consultando", done: "Consultou", icon: Sparkles };
  const Icon = label.icon;
  const summary = inputSummary(part);
  const description = summary && <TraceDescription className="truncate">{summary}</TraceDescription>;

  const details = (
    <TraceCollapsibleContent>
      <ToolCallDetails
        name={toolNameOf(part)}
        input={part.input}
        output={part.state === "output-available" ? part.output : undefined}
        errorText={part.state === "output-error" ? part.errorText : undefined}
      />
    </TraceCollapsibleContent>
  );

  if (part.state === "output-error") {
    return (
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status="error">
            <TraceIcon>
              <CircleX />
            </TraceIcon>
            <TraceTitle>Não deu: {label.running.toLowerCase()}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        {details}
      </TraceCollapsible>
    );
  }
  if (part.state === "output-denied" || (part.state === "approval-responded" && !part.approval.approved)) {
    return (
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <CircleX />
            </TraceIcon>
            <TraceTitle>Recusado: {label.running.toLowerCase()}</TraceTitle>
            {description}
          </TraceLine>
        </TraceCollapsibleTrigger>
        {details}
      </TraceCollapsible>
    );
  }
  if (part.state === "approval-requested") {
    return (
      <TraceLine status="pending">
        <TraceIcon>
          <ShieldQuestion />
        </TraceIcon>
        <TraceTitle>Esperando sua aprovação</TraceTitle>
      </TraceLine>
    );
  }
  if (part.state === "output-available") {
    return (
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <Icon />
            </TraceIcon>
            <TraceTitle>{label.done}</TraceTitle>
            {description}
          </TraceLine>
        </TraceCollapsibleTrigger>
        {details}
      </TraceCollapsible>
    );
  }
  // input-streaming / input-available / approved and running.
  return (
    <TraceLine status={streaming ? "running" : "error"}>
      <TraceIcon>{streaming ? <LoaderCircle className="animate-spin" /> : <CircleX />}</TraceIcon>
      <TraceTitle>{streaming ? label.running : `Interrompido: ${label.running.toLowerCase()}`}</TraceTitle>
      {description}
    </TraceLine>
  );
}

type Segment =
  | { kind: "steps"; parts: StepPart[] }
  | { kind: "text"; text: string; last: boolean };

/** Steps grouped between texts, in the order they came. */
function segmentsOf(message: AssistantUIMessage): Segment[] {
  const segments: Segment[] = [];
  for (const part of message.parts) {
    if (part.type === "text") {
      if (part.text.trim()) segments.push({ kind: "text", text: part.text, last: false });
    } else if (part.type === "reasoning" || isToolPart(part)) {
      const last = segments.at(-1);
      if (last?.kind === "steps") last.parts.push(part as never);
      else segments.push({ kind: "steps", parts: [part as never] });
    }
  }
  const lastText = segments.findLast((segment) => segment.kind === "text");
  if (lastText?.kind === "text") lastText.last = true;
  return segments;
}

/** The approval card's data of a call (a `data-approval` part with the call's id). */
function previewOf(message: AssistantUIMessage, toolCallId: string) {
  for (const part of message.parts) {
    if (part.type === "data-approval" && part.id === toolCallId) return part.data as AssistantApprovalPreview;
  }
  return null;
}

export function UserMessage({ message, waiting }: { message: AssistantUIMessage; waiting?: boolean }) {
  const text = textOf(message);
  const photos = message.parts.filter((part) => part.type === "file");
  const bubble = (
    <Message align="end">
      <MessageContent>
        {photos.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {photos.map((photo, index) =>
              photo.type === "file" ? <PhotoAttachment key={index} photo={photo} className="w-52" /> : null
            )}
          </div>
        )}
        {text && (
          <Bubble align="end" variant="muted">
            <BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
          </Bubble>
        )}
      </MessageContent>
    </Message>
  );
  if (!waiting) return bubble;
  return (
    <div className="flex flex-col gap-6">
      {bubble}
      <ThinkingLine />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const { copied, copy } = useCopied();
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Copiar resposta" onClick={() => copy(text)} />}>
        {copied ? <Check /> : <Copy />}
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copiado!" : "Copiar"}</TooltipContent>
    </Tooltip>
  );
}

/** Writes this reply made after an approval: "Gerar de novo" would lose them. */
export function changedData(message: AssistantUIMessage) {
  return message.parts.some((part) => isToolPart(part) && "approval" in part && part.approval?.approved === true);
}

export function AssistantMessage({
  message,
  last,
  streaming,
  busy,
  onRetry,
  onAnswer,
}: {
  message: AssistantUIMessage;
  /** The newest message: only its approvals can still be answered. */
  last: boolean;
  /** This reply is the one streaming now. */
  streaming: boolean;
  busy: boolean;
  /** Only on the last reply. */
  onRetry?: () => void;
  onAnswer: (approvalId: string, approved: boolean) => void;
}) {
  const segments = segmentsOf(message);
  const text = textOf(message);
  // The n-th reasoning part took reasoningMs[n].
  const reasoning = message.parts.filter((part) => part.type === "reasoning");
  const timeOf = (part: StepPart) => {
    const index = reasoning.indexOf(part as never);
    return index >= 0 ? message.metadata?.reasoningMs?.[index] : undefined;
  };
  if (segments.length === 0) {
    return streaming ? (
      <Message>
        <MessageContent>
          <ThinkingLine />
        </MessageContent>
      </Message>
    ) : null;
  }
  return (
    <Message>
      <MessageContent className="gap-3">
        {segments.map((segment, index) => {
          if (segment.kind === "text") {
            return <Markdown key={index} streaming={streaming && segment.last}>{segment.text}</Markdown>;
          }
          const tools = segment.parts.filter(isToolPart);
          return (
            <div key={index} className="flex min-w-0 flex-col gap-3">
              <ChainOfThought parts={segment.parts} streaming={streaming} timeOf={timeOf} />
              {tools.map((part) => {
                const preview = previewOf(message, part.toolCallId);
                if (preview && "approval" in part && part.approval) {
                  // Mirrors what the API keeps: a newer message declines what was left waiting.
                  const state =
                    part.state === "approval-requested"
                      ? last
                        ? "waiting"
                        : "skipped"
                      : part.state === "output-denied" || part.approval.approved === false
                        ? "denied"
                        : part.state === "output-error"
                          ? "failed"
                          : "approved";
                  return (
                    <ApprovalCard
                      key={part.toolCallId}
                      preview={preview}
                      state={state}
                      error={part.state === "output-error" ? part.errorText : undefined}
                      disabled={busy}
                      onAnswer={(approved) => onAnswer(part.approval!.id, approved)}
                    />
                  );
                }
                return part.state === "output-available" ? (
                  <ToolResult key={part.toolCallId} name={toolNameOf(part)} output={part.output} />
                ) : null;
              })}
            </div>
          );
        })}
        {!streaming && text && (
          <MessageFooter className={cn("gap-0.5 px-0")}>
            <CopyButton text={text} />
            {onRetry && (
              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Gerar de novo" disabled={busy} onClick={onRetry} />}>
                  <RefreshCw />
                </TooltipTrigger>
                <TooltipContent>Gerar de novo</TooltipContent>
              </Tooltip>
            )}
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}
