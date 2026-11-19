"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { History, MessageSquareDashed, Settings2, Sparkles, SquarePen, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { useLastValue } from "@/hooks/use-last-value";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AssistantEffort } from "@react-menu/contracts";
import { useStoreRole } from "@/hooks/use-store-role";
import { useAppSelector } from "@/redux/hooks";
import { type AssistantUIMessage, pageOf, readAssistantPrefs, writeAssistantPrefs } from "@/lib/assistant";
import { randomId } from "@/lib/idempotency";
import { timeAgo } from "@/lib/relative-time";
import {
  useDeleteAssistantConversationMutation,
  useGetAssistantConversationsQuery,
  useGetAssistantStatusQuery,
  useLazyGetAssistantConversationQuery,
} from "@/redux/features/assistant/assistantApi";
import { AssistantChat } from "./assistant-chat";

type Conversation = { id: string; messages: AssistantUIMessage[] };

const newConversation = (): Conversation => ({ id: randomId(), messages: [] });

/**
 * The store assistant in the panel header: a button (and Ctrl/⌘ + J) that
 * opens it in a side sheet, for managers and attendants. The conversation
 * stays while the sheet is closed; the history menu reopens older ones.
 */
export function AssistantPanel() {
  const params = useParams<{ store?: string }>();
  const storeId = params.store ?? null;
  const role = useStoreRole(storeId ?? "");
  const allowed = storeId !== null && (role === "manager" || role === "attendant");
  const [open, setOpen] = useState(false);
  // Mounted on the first open, then kept (closing the sheet keeps the
  // conversation, and an answer still arriving goes on arriving).
  const [opened, setOpened] = useState(false);
  if (open && !opened) setOpened(true);

  useEffect(() => {
    if (!allowed) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allowed]);

  if (!allowed) return null;
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label="Abrir o assistente"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              onClick={() => setOpen(true)}
            />
          }
        >
          <Sparkles />
          <span className="max-sm:hidden">Assistente</span>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          Assistente
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>J</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          keepMounted
          side="right"
          showCloseButton={false}
          // Straight to the field (the header's first button would open its tooltip).
          // While the field is still disabled (status loading), the sheet itself.
          initialFocus={() => {
            const field = document.getElementById("assistant-prompt") as HTMLTextAreaElement | null;
            return field && !field.disabled ? field : document.querySelector<HTMLElement>("[data-slot=sheet-content]");
          }}
          // Whole width on phones; the sheet's default 3/4 squeezed the input.
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        >
          {opened && <AssistantSheet key={storeId} storeId={storeId} role={role} onClose={() => setOpen(false)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function AssistantSheet({
  storeId,
  role,
  onClose,
}: {
  storeId: string;
  role: "manager" | "attendant" | "kitchen" | null;
  /** Going to the settings closes the sheet (the page is behind it). */
  onClose: () => void;
}) {
  const pathname = usePathname();
  const page = pageOf(pathname);
  const storeName = useAppSelector((state) => state.auth.user?.stores.find((store) => store.id === storeId)?.name);
  const status = useGetAssistantStatusQuery(storeId);
  const conversations = useGetAssistantConversationsQuery(storeId, { skip: !status.data?.enabled });
  const [loadConversation, loading] = useLazyGetAssistantConversationQuery();
  const [deleteConversation] = useDeleteAssistantConversationMutation();
  // Remembered on this browser per store: the model, the mode and the open
  // conversation (back after a reload). A model the store stopped offering
  // falls back to its default.
  const [prefs] = useState(() => readAssistantPrefs(storeId));
  const [conversation, setConversation] = useState<Conversation>(newConversation);
  const [restoring, setRestoring] = useState(Boolean(prefs.conversationId));
  const [chosenModel, setChosenModelState] = useState<string | null>(prefs.model ?? null);
  const [effort, setEffortState] = useState<AssistantEffort>(prefs.effort ?? "fast");
  const setChosenModel = (id: string) => {
    setChosenModelState(id);
    writeAssistantPrefs(storeId, { model: id });
  };
  const setEffort = (value: AssistantEffort) => {
    setEffortState(value);
    writeAssistantPrefs(storeId, { effort: value });
  };
  const startConversation = (next: Conversation) => {
    setConversation(next);
    writeAssistantPrefs(storeId, { conversationId: next.messages.length ? next.id : null });
  };

  useEffect(() => {
    if (!prefs.conversationId) return;
    let cancelled = false;
    loadConversation({ storeId, id: prefs.conversationId })
      .unwrap()
      .then((detail) => {
        if (!cancelled) setConversation({ id: detail.id, messages: detail.messages as AssistantUIMessage[] });
      })
      // Gone (deleted, another device): a new one.
      .catch(() => writeAssistantPrefs(storeId, { conversationId: null }))
      .finally(() => !cancelled && setRestoring(false));
    return () => {
      cancelled = true;
    };
  }, [loadConversation, prefs.conversationId, storeId]);
  const models = status.data?.models ?? [];
  const model = models.some((item) => item.id === chosenModel) ? chosenModel : (status.data?.defaultModel ?? null);
  const manager = role === "manager";

  const openConversation = async (id: string) => {
    try {
      const detail = await loadConversation({ storeId, id }).unwrap();
      startConversation({ id, messages: detail.messages as AssistantUIMessage[] });
    } catch {
      toast.error("Não foi possível abrir a conversa.");
    }
  };

  // Asked first (a tap beside the row is easy on a phone); the dialog keeps
  // its title while it closes.
  const [removing, setRemoving] = useState<{ id: string; title: string } | null>(null);
  const shownRemoving = useLastValue(removing);
  const [deleting, setDeleting] = useState(false);
  const remove = async (id: string) => {
    setDeleting(true);
    try {
      await deleteConversation({ storeId, id }).unwrap();
      if (id === conversation.id) startConversation(newConversation());
      toast.success("Conversa apagada");
      setRemoving(null);
    } catch {
      // baseApi shows the API's answer.
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <SheetTitle className="flex items-center gap-2 text-base">
            Assistente
            <Badge variant="secondary" className="max-sm:hidden">
              Beta
            </Badge>
          </SheetTitle>
          <SheetDescription className="truncate text-xs">
            {storeName ?? "Pergunte sobre a loja"}
          </SheetDescription>
        </div>
        {status.data?.enabled && (
          <>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger render={<DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Conversas anteriores" />} />}>
                  {loading.isFetching ? <Spinner /> : <History />}
                </TooltipTrigger>
                <TooltipContent>Conversas anteriores</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="max-h-96 min-w-72 max-w-80">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Suas conversas nesta loja</DropdownMenuLabel>
                  {(conversations.data ?? []).length === 0 && (
                    <p className="px-2 py-3 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
                  )}
                  {(conversations.data ?? []).map((row) => (
                    <DropdownMenuItem key={row.id} className="group/row items-start gap-2" onClick={() => void openConversation(row.id)}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{row.title}</span>
                        <span className="text-xs text-muted-foreground">{timeAgo(row.updatedAt)}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Apagar "${row.title}"`}
                        className="opacity-60 hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          setRemoving({ id: row.id, title: row.title ?? "Conversa" });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                {manager && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem render={<Link href={`/app/stores/${storeId}?aba=assistente`} onClick={onClose} />}>
                      <Settings2 />
                      Configurar o assistente
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Nova conversa"
                    onClick={() => startConversation(newConversation())}
                  />
                }
              >
                <SquarePen />
              </TooltipTrigger>
              <TooltipContent>Nova conversa</TooltipContent>
            </Tooltip>
          </>
        )}
        <SheetClose render={<Button variant="ghost" size="icon-sm" aria-label="Fechar o assistente" />}>
          <X />
        </SheetClose>
      </header>

      {status.isLoading || restoring ? (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <Skeleton className="h-16 w-3/4 self-end" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !status.data?.enabled ? (
        <Empty className="flex-1 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareDashed />
            </EmptyMedia>
            <EmptyTitle>O assistente ainda não está ligado</EmptyTitle>
            <EmptyDescription>
              {manager
                ? "Escolha o provedor (Claude, ChatGPT ou Gemini), o modelo e cole a chave da API da loja."
                : "Peça a um gerente da loja para ligar o assistente nas configurações."}
            </EmptyDescription>
          </EmptyHeader>
          {manager && (
            <EmptyContent>
              <Link href={`/app/stores/${storeId}?aba=assistente`} className={buttonVariants()} onClick={onClose}>
                <Settings2 data-icon="inline-start" />
                Configurar o assistente
              </Link>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <AssistantChat
          key={`${storeId}:${conversation.id}`}
          storeId={storeId}
          conversationId={conversation.id}
          initialMessages={conversation.messages}
          page={page}
          role={role}
          usage={status.data.usage}
          models={models}
          model={model}
          onModelChange={setChosenModel}
          effort={effort}
          onEffortChange={setEffort}
          onAnswered={() => writeAssistantPrefs(storeId, { conversationId: conversation.id })}
        />
      )}
      <AlertDialogDestructive
        open={removing !== null}
        onOpenChange={(open) => !open && !deleting && setRemoving(null)}
        title="Apagar esta conversa?"
        description={`"${shownRemoving?.title ?? ""}" sai do seu histórico de vez.`}
        confirmLabel="Apagar"
        loading={deleting}
        onConfirm={() => removing && void remove(removing.id)}
      />
    </div>
  );
}
