"use client";

import { useState } from "react";
import { CreditCard, QrCode, RefreshCw, Smartphone, SmartphoneNfc, TriangleAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { PointPaymentType, PointSettingsInput, PointTerminalListing } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useLastValue } from "@/hooks/use-last-value";
import {
  useDisablePointTerminalMutation,
  useEnablePointTerminalMutation,
  useGetPointConfigQuery,
  useGetPointTerminalsQuery,
  useUpdatePointSettingsMutation,
} from "@/redux/features/point/pointApi";
import { getErrorMessage } from "@/utils/get-error-message";
import { cn } from "@/lib/utils";

const TYPES: { value: PointPaymentType; label: string; hint: string; icon: typeof CreditCard }[] = [
  { value: "credit_card", label: "Crédito", hint: "", icon: CreditCard },
  { value: "debit_card", label: "Débito", hint: "", icon: Wallet },
  { value: "qr", label: "Pix / QR", hint: "Confira se o modelo aceita", icon: QrCode },
];

const INSTALLMENTS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: index === 0 ? "Só à vista" : `Até ${index + 1}x`,
}));

/**
 * Mercado Pago Point (ADR 0020): which card machines of the store's Mercado
 * Pago account the POS charges on, and how. Managers only.
 */
export function PointSettingsCard({ store }: { store: Store }) {
  const { data: config } = useGetPointConfigQuery(store.id);
  const {
    data: terminals,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetPointTerminalsQuery(store.id, { skip: !config?.available });
  const [save] = useUpdatePointSettingsMutation();
  const [disable, { isLoading: disabling }] = useDisablePointTerminalMutation();
  const [naming, setNaming] = useState<PointTerminalListing | null>(null);
  const [removing, setRemoving] = useState<PointTerminalListing | null>(null);
  const shownRemoving = useLastValue(removing);

  const change = (edit: Partial<PointSettingsInput>) => {
    if (!config) return;
    void save({
      storeId: store.id,
      input: {
        paymentTypes: config.paymentTypes,
        maxInstallments: config.maxInstallments,
        printTicket: config.printTicket,
        ...edit,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5 text-primary" /> Maquininhas (Mercado Pago Point)
          {config && config.terminals.length > 0 && <Badge>{config.terminals.length} ativa{config.terminals.length > 1 ? "s" : ""}</Badge>}
        </CardTitle>
        <CardDescription>
          Cobre direto do PDV: o valor aparece na maquininha e o pedido fica pago quando o cliente passa o
          cartão. Pedidos pagos na maquininha e cancelados são estornados automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!config ? (
          <Skeleton className="h-40 w-full" />
        ) : !config.available ? (
          <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            Configure o Mercado Pago em “Pagamentos online” para usar as maquininhas da mesma conta.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
            <section aria-labelledby="point-terminals" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 id="point-terminals" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Maquininhas da conta
                </h3>
                <Button variant="ghost" size="xs" onClick={() => void refetch()} loading={isFetching}>
                  <RefreshCw /> Atualizar
                </Button>
              </div>
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : isError ? (
                <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  Não foi possível listar as maquininhas no Mercado Pago.
                </p>
              ) : !terminals?.length ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Nenhuma maquininha nesta conta do Mercado Pago. Vincule uma pelo app do Mercado Pago.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {terminals.map((terminal) => (
                    <li
                      key={terminal.id}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                        terminal.enabled && "border-primary/30 bg-primary/5"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-xl",
                          terminal.enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <SmartphoneNfc className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{terminal.name ?? terminal.model}</span>
                          {terminal.enabled ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                              <span className="size-1.5 rounded-full bg-success" /> No PDV
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {terminal.operatingMode === "PDV" ? "Modo PDV" : "Modo normal"}
                            </span>
                          )}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-muted-foreground">
                          {terminal.name ? `${terminal.model} · ` : ""}
                          {terminal.serial}
                        </span>
                      </span>
                      {terminal.enabled ? (
                        <Button variant="ghost" size="sm" onClick={() => setRemoving(terminal)}>
                          Desativar
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setNaming(terminal)}>
                          Usar no PDV
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="point-how" className="flex flex-col gap-3">
              <h3 id="point-how" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Como cobrar
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((type) => {
                  const Icon = type.icon;
                  const checked = config.paymentTypes.includes(type.value);
                  // At least one way to pay stays on.
                  const locked = checked && config.paymentTypes.length === 1;
                  return (
                    <label
                      key={type.value}
                      className={cn(
                        "relative flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                        locked && "cursor-not-allowed"
                      )}
                    >
                      <Checkbox
                        className="absolute top-2 right-2"
                        checked={checked}
                        disabled={locked}
                        aria-label={type.label}
                        onCheckedChange={(on) =>
                          change({
                            paymentTypes: on
                              ? [...config.paymentTypes, type.value]
                              : config.paymentTypes.filter((value) => value !== type.value),
                          })
                        }
                      />
                      <span
                        className={cn(
                          "flex size-10 items-center justify-center rounded-xl",
                          checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="text-sm font-semibold">{type.label}</span>
                      {type.hint && <span className="text-[11px] leading-tight text-muted-foreground">{type.hint}</span>}
                    </label>
                  );
                })}
              </div>
              <ul className="divide-y rounded-2xl border">
                <li className="flex items-center justify-between gap-3 p-3">
                  <span>
                    <span className="block text-sm font-medium">Parcelamento no crédito</span>
                    <span className="block text-xs text-muted-foreground">Sem juros para o cliente</span>
                  </span>
                  <Select
                    items={INSTALLMENTS}
                    value={String(config.maxInstallments)}
                    onValueChange={(value) => change({ maxInstallments: Number(value) })}
                  >
                    <SelectTrigger className="w-32" aria-label="Parcelamento no crédito">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTALLMENTS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
                <li>
                  <label className="flex items-center justify-between gap-3 p-3">
                    <span>
                      <span className="block text-sm font-medium">Comprovante impresso</span>
                      <span className="block text-xs text-muted-foreground">A maquininha imprime a via da loja</span>
                    </span>
                    <Switch
                      checked={config.printTicket}
                      onCheckedChange={(checked) => change({ printTicket: checked })}
                      aria-label="Imprimir o comprovante na maquininha"
                    />
                  </label>
                </li>
              </ul>
            </section>
          </div>
        )}
      </CardContent>

      <EnableTerminalDialog storeId={store.id} terminal={naming} onClose={() => setNaming(null)} />

      <AlertDialogDestructive
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        loading={disabling}
        title={`Desativar ${shownRemoving?.name ?? "a maquininha"} no PDV?`}
        description="Ela volta ao modo normal (valor digitado na própria maquininha) e o PDV deixa de cobrar nela. Reinicie a maquininha depois."
        confirmLabel="Desativar"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await disable({ storeId: store.id, terminalId: removing.id }).unwrap();
            toast.success("Maquininha desativada no PDV. Reinicie a maquininha.");
            setRemoving(null);
          } catch {
            // baseApi already showed the error.
          }
        }}
      />
    </Card>
  );
}

function EnableTerminalDialog({
  storeId,
  terminal: current,
  onClose,
}: {
  storeId: string;
  terminal: PointTerminalListing | null;
  onClose: () => void;
}) {
  const terminal = useLastValue(current);
  const [name, setName] = useState("Balcão");
  const [error, setError] = useState<string | null>(null);
  const [enable, { isLoading }] = useEnablePointTerminalMutation();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!terminal || !name.trim()) return;
    setError(null);
    try {
      await enable({ storeId, terminalId: terminal.id, name: name.trim() }).unwrap();
      toast.success("Maquininha ativada. Reinicie a maquininha para ela receber as cobranças.");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err as { data?: { error?: string } }, "Não foi possível ativar a maquininha."));
    }
  };

  return (
    <Dialog
      open={Boolean(current)}
      onOpenChange={(open) => !open && onClose()}
      onOpenChangeComplete={(open) => {
        if (!open) {
          setName("Balcão");
          setError(null);
        }
      }}
    >
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Usar no PDV</DialogTitle>
            <DialogDescription>
              {terminal?.model} · {terminal?.serial}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="point-name">Nome da maquininha</FieldLabel>
              <Input id="point-name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
              <FieldDescription>Aparece no PDV quando há mais de uma.</FieldDescription>
            </Field>
            <div className="flex gap-2 rounded-xl bg-warning/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>
                A maquininha passa para o <strong>modo PDV</strong>: ela recebe as cobranças do sistema em vez do valor
                digitado nela. Depois de ativar, <strong>reinicie a maquininha</strong>. Se a ativação falhar, crie um
                caixa só para ela no Mercado Pago (Seu negócio › Lojas e caixas) e vincule a maquininha a ele.
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={isLoading} disabled={!name.trim()}>
              Ativar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
