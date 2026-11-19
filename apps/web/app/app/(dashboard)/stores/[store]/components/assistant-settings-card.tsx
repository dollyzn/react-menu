"use client";

import { useState } from "react";
import {
  Check,
  CircleDollarSign,
  ExternalLink,
  KeyRound,
  MoreHorizontal,
  Plus,
  RotateCw,
  Sparkles,
  Star,
  Trash2,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AssistantCostPeriod,
  AssistantModelChoice,
  AssistantModelOption,
  AssistantModelPricing,
  AssistantProvider,
} from "@react-menu/contracts";
import { useLastValue } from "@/hooks/use-last-value";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { apiErrorText, MODEL_SUGGESTIONS, PROVIDERS } from "@/lib/assistant";
import { cn } from "@/lib/utils";
import { ProviderLogo } from "@/components/app/assistant/provider-logo";
import {
  useGetAssistantCostsQuery,
  useGetAssistantStatusQuery,
  useListAssistantModelsMutation,
  useUpdateAssistantSettingsMutation,
} from "@/redux/features/assistant/assistantApi";

type Model = Omit<AssistantModelChoice, "id">;

const compact = (value: number) => value.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const idOf = (model: Model) => `${model.provider}:${model.model}`;
const usd = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: value < 1 ? 4 : 2 });
const priceLine = (pricing: AssistantModelPricing | null | undefined) =>
  pricing ? `${usd(pricing.input)} entrada · ${usd(pricing.output)} saída por 1M tokens` : "Sem preço: defina para estimar o custo";

/** The provider's logo on a tile (never shrinks next to long model names). */
function ProviderMark({ provider, className }: { provider: AssistantProvider; className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background", className)}>
      <ProviderLogo provider={provider} className="size-[55%]" />
    </span>
  );
}

const providerLabel = (provider: AssistantProvider) => PROVIDERS.find((item) => item.value === provider)!.label;

/**
 * The store assistant (managers): the providers the store connected with its
 * own keys (Claude, ChatGPT, Gemini; encrypted like the Mercado Pago
 * credentials, never shown again), the models offered in the chat with the
 * default one, and today's usage. Every change saves at once.
 */
export function AssistantSettingsCard({ store }: { store: Store }) {
  const [save, { isLoading }] = useUpdateAssistantSettingsMutation();
  const status = useGetAssistantStatusQuery(store.id);
  const costs = useGetAssistantCostsQuery(store.id);
  const [pricing, setPricing] = useState<Model | null>(null);
  const [connecting, setConnecting] = useState<AssistantProvider | null>(null);
  const [disconnecting, setDisconnecting] = useState<AssistantProvider | null>(null);
  const shownDisconnecting = useLastValue(disconnecting);
  const models: Model[] = store.assistantModels ?? [];
  const priceOf = (model: Model) => costs.data?.prices.find((price) => price.id === idOf(model));
  const connected = store.assistantProviders ?? [];

  const update = async (data: Parameters<typeof save>[0]["data"], done: string) => {
    try {
      await save({ storeId: store.id, data }).unwrap();
      toast.success(done);
      return true;
    } catch {
      // baseApi shows the API's answer.
      return false;
    }
  };

  const setModels = (next: Model[], defaultModel = store.assistantDefaultModel, done = "Modelos atualizados") =>
    update({ models: next, defaultModel }, done);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-5 text-primary" /> Assistente
          <Badge variant={store.assistantEnabled ? "default" : "secondary"}>{store.assistantEnabled ? "Ligado" : "Desligado"}</Badge>
        </CardTitle>
        <CardDescription>
          Um assistente no painel (Ctrl + J) que responde sobre vendas, estoque, pedidos e fiado, e altera preços,
          pausa itens, abre e fecha a loja ou lança estoque depois que você aprova. Usa as contas da loja nos
          provedores conectados: o custo das mensagens vai para elas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-medium">Provedores</h3>
            <p className="text-xs text-muted-foreground">Conecte com a chave da API da conta da loja. Pode usar mais de um.</p>
          </div>
          <ItemGroup className="gap-2">
            {PROVIDERS.map((provider) => {
              const on = connected.includes(provider.value);
              const count = models.filter((model) => model.provider === provider.value).length;
              return (
                <Item key={provider.value} variant="outline" size="sm">
                  <ItemMedia>
                    <ProviderMark provider={provider.value} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {provider.label}
                      {on && (
                        <Badge variant="outline" className="text-success">
                          <Check /> Conectado
                        </Badge>
                      )}
                    </ItemTitle>
                    <ItemDescription>
                      {on ? (count ? `${count} ${count === 1 ? "modelo" : "modelos"} no chat` : "Nenhum modelo no chat ainda") : "Sem chave"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {on ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Opções de ${provider.label}`} />}>
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setConnecting(provider.value)}>
                            <KeyRound /> Trocar a chave
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDisconnecting(provider.value)}>
                            <Unplug /> Desconectar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setConnecting(provider.value)}>
                        Conectar
                      </Button>
                    )}
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-medium">Modelos no chat</h3>
              <p className="text-xs text-muted-foreground">
                Quem usa o assistente escolhe entre estes; a conversa começa no padrão.
              </p>
            </div>
            <AddModel
              storeId={store.id}
              connected={connected}
              chosen={models}
              disabled={isLoading || connected.length === 0}
              onAdd={(model) =>
                setModels([...models, model], store.assistantDefaultModel ?? idOf(model), `${model.name} adicionado`)
              }
            />
          </div>
          {models.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              {connected.length ? "Adicione um modelo para ligar o assistente." : "Conecte um provedor para escolher os modelos."}
            </p>
          ) : (
            <ItemGroup className="gap-2">
              {models.map((model) => {
                const isDefault = idOf(model) === store.assistantDefaultModel;
                return (
                  <Item key={idOf(model)} variant="outline" size="sm">
                    <ItemMedia>
                      <ProviderMark provider={model.provider} />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle>
                        {model.name}
                        {isDefault && <Badge>Padrão</Badge>}
                      </ItemTitle>
                      <ItemDescription className="truncate font-mono text-xs">
                        {model.model}
                        {model.contextWindow ? ` · ${compact(model.contextWindow)} tokens de contexto` : ""}
                      </ItemDescription>
                      <ItemDescription className="truncate text-xs">
                        {priceLine(priceOf(model)?.pricing)}
                        {priceOf(model)?.custom && " (seu preço)"}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Opções de ${model.name}`} disabled={isLoading} />}>
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={isDefault}
                            onClick={() => void setModels(models, idOf(model), `${model.name} é o padrão`)}
                          >
                            <Star /> Usar como padrão
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPricing(model)}>
                            <CircleDollarSign /> Ajustar o preço
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() =>
                              void setModels(
                                models.filter((item) => idOf(item) !== idOf(model)),
                                isDefault ? null : store.assistantDefaultModel,
                                `${model.name} removido`
                              )
                            }
                          >
                            <Trash2 /> Tirar do chat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ItemActions>
                  </Item>
                );
              })}
            </ItemGroup>
          )}
        </section>

        {status.data && (
          <>
            <Separator />
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Uso de hoje</h3>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span>Mensagens</span>
                  <span className="text-muted-foreground tabular-nums">
                    {status.data.usage.used} / {status.data.usage.limit}
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (status.data.usage.used / Math.max(status.data.usage.limit, 1)) * 100)}
                  aria-label="Mensagens usadas hoje"
                />
              </div>
              {status.data.usage.tokens && (
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Entrada", status.data.usage.tokens.input],
                    ["Do cache", status.data.usage.tokens.cachedInput],
                    ["Saída", status.data.usage.tokens.output],
                    ["Raciocínio", status.data.usage.tokens.reasoning],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col rounded-lg bg-muted/50 px-3 py-2">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-base font-semibold tabular-nums">{compact(Number(value))}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="text-xs text-muted-foreground">Tokens de todos os modelos. O limite de mensagens volta a zero amanhã.</p>
            </section>
          </>
        )}
        {costs.data && (costs.data.month.models.length > 0 || models.length > 0) && (
          <>
            <Separator />
            <CostSection today={costs.data.today} month={costs.data.month} names={new Map(models.map((model) => [idOf(model), model]))} />
          </>
        )}
      </CardContent>

      <PriceDialog
        model={pricing}
        current={pricing ? (priceOf(pricing) ?? null) : null}
        busy={isLoading}
        onClose={() => setPricing(null)}
        onSave={async (next) => {
          if (!pricing) return;
          const ok = await setModels(
            models.map((model) => (idOf(model) === idOf(pricing) ? { ...model, pricing: next } : model)),
            store.assistantDefaultModel,
            next ? `Preço de ${pricing.name} salvo` : `${pricing.name} volta ao preço de tabela`
          );
          if (ok) setPricing(null);
        }}
      />

      <ConnectDialog
        storeId={store.id}
        provider={connecting}
        connected={connecting ? connected.includes(connecting) : false}
        onClose={() => setConnecting(null)}
        onConnect={async (provider, key, firstModel) => {
          const next = firstModel && !models.length ? [firstModel] : models;
          return await update(
            { keys: { [provider]: key }, models: next, defaultModel: store.assistantDefaultModel ?? (firstModel ? idOf(firstModel) : null) },
            `${providerLabel(provider)} conectado`
          );
        }}
      />
      <AlertDialogDestructive
        open={disconnecting !== null}
        onOpenChange={(open) => !open && setDisconnecting(null)}
        title={shownDisconnecting ? `Desconectar ${providerLabel(shownDisconnecting)}?` : ""}
        description="A chave é apagada e os modelos dele saem do chat."
        confirmLabel="Desconectar"
        icon={<Unplug />}
        loading={isLoading}
        onConfirm={async () => {
          if (!disconnecting) return;
          if (await update({ keys: { [disconnecting]: null } }, `${providerLabel(disconnecting)} desconectado`)) {
            setDisconnecting(null);
          }
        }}
      />
    </Card>
  );
}

/**
 * Estimated cost in US$ (the providers bill in dollars): today and this month
 * per model, from the tokens used and each model's price.
 */
function CostSection({
  today,
  month,
  names,
}: {
  today: AssistantCostPeriod;
  month: AssistantCostPeriod;
  names: Map<string, Model>;
}) {
  const nameOf = (id: string) => names.get(id)?.name ?? id.split(":").slice(1).join(":");
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium">Custo estimado (US$)</h3>
        <p className="text-xs text-muted-foreground">
          Pelos tokens usados e o preço de cada modelo por milhão de tokens. A fatura do provedor é a referência.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          ["Hoje", today],
          ["Este mês", month],
        ].map(([label, period]) => {
          const value = period as AssistantCostPeriod;
          return (
            <div key={label as string} className="flex flex-col rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-xs text-muted-foreground">{label as string}</span>
              <span className="text-lg font-semibold tabular-nums">{usd(value.total)}</span>
              {value.partial && <span className="text-xs text-warning">Falta o preço de algum modelo</span>}
            </div>
          );
        })}
      </div>
      {month.models.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Modelo (este mês)</TableHead>
                <TableHead className="text-right">Mensagens</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {month.models.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-40 truncate">{nameOf(row.id)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.requests}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {compact(row.tokens.input)} / {compact(row.tokens.output)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.cost === null ? "—" : usd(row.cost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right tabular-nums">{usd(month.total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Tokens: entrada / saída (a saída inclui o raciocínio).</p>
    </section>
  );
}

/** The model's price for the estimate: the list price, or the store's own (its contract, a new price). */
function PriceDialog({
  model: opened,
  current: openedPrice,
  busy,
  onClose,
  onSave,
}: {
  model: Model | null;
  current: { pricing: AssistantModelPricing | null; custom: boolean } | null;
  busy: boolean;
  onClose: () => void;
  onSave: (pricing: AssistantModelPricing | null) => Promise<void>;
}) {
  // What it shows while it animates closed.
  const model = useLastValue(opened);
  const current = useLastValue(openedPrice);
  const [values, setValues] = useState<Record<keyof AssistantModelPricing, string> | null>(null);
  const shown =
    values ??
    ({
      input: String(current?.pricing?.input ?? ""),
      cachedInput: String(current?.pricing?.cachedInput ?? ""),
      output: String(current?.pricing?.output ?? ""),
    } as Record<keyof AssistantModelPricing, string>);
  const parsed = Object.fromEntries(
    Object.entries(shown).map(([key, value]) => [key, Number(String(value).replace(",", "."))])
  ) as unknown as AssistantModelPricing;
  const valid = Object.values(parsed).every((value) => Number.isFinite(value) && value >= 0) && shown.input !== "" && shown.output !== "";
  const fields: [keyof AssistantModelPricing, string][] = [
    ["input", "Entrada"],
    ["cachedInput", "Entrada do cache"],
    ["output", "Saída"],
  ];
  return (
    <Dialog open={opened !== null} onOpenChange={(open) => !open && !busy && onClose()} onOpenChangeComplete={(open) => !open && setValues(null)}>
      <DialogContent className="sm:max-w-md">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) void onSave({ ...parsed, cachedInput: shown.cachedInput === "" ? parsed.input : parsed.cachedInput });
          }}
        >
          <DialogHeader>
            <DialogTitle>Preço de {model?.name}</DialogTitle>
            <DialogDescription>
              Em US$ por milhão de tokens, como na página de preços do provedor. Só muda a estimativa do painel.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid grid-cols-3 gap-3">
            {fields.map(([key, label]) => (
              <Field key={key}>
                <FieldLabel htmlFor={`price-${key}`}>{label}</FieldLabel>
                <Input
                  id={`price-${key}`}
                  inputMode="decimal"
                  value={shown[key]}
                  disabled={busy}
                  onChange={(event) => setValues({ ...shown, [key]: event.target.value })}
                />
              </Field>
            ))}
          </DialogBody>
          <DialogFooter className="sm:justify-between">
            {current?.custom ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void onSave(null)}>
                Voltar ao preço de tabela
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <Button type="submit" loading={busy} disabled={!valid}>
              Salvar preço
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Adding a model (Model Selector pattern, searchable): per connected
 * provider, the recommended ones and every model its key can use.
 */
function AddModel({
  storeId,
  connected,
  chosen,
  disabled,
  onAdd,
}: {
  storeId: string;
  connected: AssistantProvider[];
  chosen: Model[];
  disabled?: boolean;
  onAdd: (model: Model) => void;
}) {
  const [open, setOpen] = useState(false);
  const [list] = useListAssistantModelsMutation();
  const [listed, setListed] = useState<Partial<Record<AssistantProvider, AssistantModelOption[] | { error: string }>>>({});
  const [loading, setLoading] = useState<AssistantProvider[]>([]);
  const taken = new Set(chosen.map(idOf));

  const ask = async (provider: AssistantProvider) => {
    setLoading((value) => [...value, provider]);
    try {
      const models = await list({ storeId, data: { provider } }).unwrap();
      setListed((value) => ({ ...value, [provider]: models }));
    } catch (error) {
      setListed((value) => ({ ...value, [provider]: { error: apiErrorText(error) } }));
    } finally {
      setLoading((value) => value.filter((item) => item !== provider));
    }
  };

  const pick = (model: Model) => {
    onAdd(model);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) for (const provider of connected) if (!listed[provider]) void ask(provider);
      }}
    >
      <PopoverTrigger render={<Button size="sm" variant="outline" disabled={disabled} />}>
        <Plus data-icon="inline-start" />
        Adicionar modelo
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Buscar modelo…" />
          <CommandList className="max-h-80">
            <CommandEmpty>Nenhum modelo com esse nome.</CommandEmpty>
            {connected.map((provider) => {
              const account = listed[provider];
              const recommended = MODEL_SUGGESTIONS[provider].filter((item) => !taken.has(`${provider}:${item.id}`));
              const fromAccount =
                account && !("error" in account)
                  ? account.filter(
                      (item) => !taken.has(`${provider}:${item.id}`) && !recommended.some((r) => r.id === item.id)
                    )
                  : [];
              const windowOf = (id: string) =>
                account && !("error" in account) ? (account.find((item) => item.id === id)?.contextWindow ?? null) : null;
              return (
                <CommandGroup key={provider} heading={providerLabel(provider)}>
                  {recommended.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${provider} ${item.id} ${item.note}`}
                      onSelect={() =>
                        pick({ provider, model: item.id, name: item.name ?? item.id, contextWindow: windowOf(item.id) })
                      }
                    >
                      <ProviderMark provider={provider} className="size-7" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{item.name ?? item.id}</span>
                        <span className="text-xs text-muted-foreground">Recomendado · {item.note}</span>
                      </span>
                    </CommandItem>
                  ))}
                  {loading.includes(provider) ? (
                    <p className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                      <Spinner /> Perguntando ao provedor…
                    </p>
                  ) : account && "error" in account ? (
                    <div className="flex flex-col items-start gap-1 px-2 py-2 text-xs text-destructive">
                      {account.error}
                      <Button type="button" variant="ghost" size="xs" onClick={() => void ask(provider)}>
                        <RotateCw data-icon="inline-start" /> Tentar de novo
                      </Button>
                    </div>
                  ) : (
                    fromAccount.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={`${provider} ${item.id} ${item.name}`}
                        onSelect={() => pick({ provider, model: item.id, name: item.name, contextWindow: item.contextWindow })}
                      >
                        <ProviderMark provider={provider} className="size-7" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{item.name}</span>
                          <span className="truncate font-mono text-xs text-muted-foreground">
                            {item.id}
                            {item.contextWindow ? ` · ${compact(item.contextWindow)}` : ""}
                          </span>
                        </span>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Connecting a provider: the key is tested by listing its models before it
 * is saved; the first time, the provider's recommended model joins the chat.
 */
function ConnectDialog({
  storeId,
  provider,
  connected,
  onClose,
  onConnect,
}: {
  storeId: string;
  provider: AssistantProvider | null;
  connected: boolean;
  onClose: () => void;
  onConnect: (provider: AssistantProvider, key: string, firstModel: Model | null) => Promise<boolean>;
}) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [list] = useListAssistantModelsMutation();
  const info = PROVIDERS.find((item) => item.value === provider) ?? PROVIDERS[0];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!provider) return;
    if (key.trim().length < 10) {
      setError("Cole a chave da API.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const models = await list({ storeId, data: { provider, apiKey: key.trim() } }).unwrap();
      const suggestion = MODEL_SUGGESTIONS[provider][0];
      const listedFirst = models.find((model) => model.id === suggestion?.id) ?? models[0];
      const first: Model | null = listedFirst
        ? {
            provider,
            model: listedFirst.id,
            name: suggestion?.id === listedFirst.id ? (suggestion.name ?? listedFirst.name) : listedFirst.name,
            contextWindow: listedFirst.contextWindow,
          }
        : null;
      if (await onConnect(provider, key.trim(), connected ? null : first)) onClose();
    } catch (failure) {
      setError(apiErrorText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={provider !== null}
      onOpenChange={(open) => !open && !busy && onClose()}
      onOpenChangeComplete={(open) => {
        if (!open) {
          setKey("");
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{connected ? `Trocar a chave do ${info.label}` : `Conectar ${info.label}`}</DialogTitle>
            <DialogDescription>A chave é testada antes de salvar e fica criptografada; ninguém a vê de novo.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="assistant-key">Chave da API</FieldLabel>
              <Input
                id="assistant-key"
                type="password"
                autoComplete="off"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                disabled={busy}
                aria-invalid={Boolean(error)}
                placeholder={info.keyHint}
              />
              {error ? (
                <FieldError>{error}</FieldError>
              ) : (
                <FieldDescription>
                  <a href={info.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-2">
                    Criar uma chave no {info.label} <ExternalLink className="size-3" />
                  </a>
                </FieldDescription>
              )}
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="submit" loading={busy}>
              {connected ? "Testar e trocar" : "Testar e conectar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
