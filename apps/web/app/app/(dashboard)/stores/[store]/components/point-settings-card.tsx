"use client";

import { useState } from "react";
import { CreditCard, RefreshCw, Smartphone, TriangleAlert } from "lucide-react";
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

const TYPES: { value: PointPaymentType; label: string; hint: string }[] = [
  { value: "credit_card", label: "Crédito", hint: "" },
  { value: "debit_card", label: "Débito", hint: "" },
  { value: "qr", label: "Pix / QR na maquininha", hint: "Confirme se o seu modelo aceita." },
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
      <CardContent className="flex flex-col gap-6">
        {!config ? (
          <Skeleton className="h-32 w-full" />
        ) : !config.available ? (
          <p className="text-sm text-muted-foreground">
            Configure o Mercado Pago em “Pagamentos online” para usar as maquininhas da mesma conta.
          </p>
        ) : (
          <>
            <section aria-labelledby="point-terminals" className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 id="point-terminals" className="text-sm font-medium">
                  Maquininhas da conta
                </h3>
                <Button variant="ghost" size="sm" onClick={() => void refetch()} loading={isFetching}>
                  <RefreshCw /> Atualizar
                </Button>
              </div>
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : isError ? (
                <p className="text-sm text-destructive">Não foi possível listar as maquininhas no Mercado Pago.</p>
              ) : !terminals?.length ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma maquininha nesta conta do Mercado Pago. Vincule uma pelo app do Mercado Pago.
                </p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {terminals.map((terminal) => (
                    <li key={terminal.id} className="flex flex-wrap items-center gap-3 p-3">
                      <CreditCard className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {terminal.name ?? terminal.model}
                          {terminal.enabled && (
                            <Badge variant="outline" className="ml-2 align-middle">
                              No PDV
                            </Badge>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {terminal.model} · {terminal.serial} ·{" "}
                          {terminal.operatingMode === "PDV" ? "modo PDV" : "modo normal"}
                        </span>
                      </span>
                      {terminal.enabled ? (
                        <Button variant="outline" size="sm" onClick={() => setRemoving(terminal)}>
                          Desativar
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setNaming(terminal)}>
                          Usar no PDV
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="point-how" className="flex flex-col gap-3">
              <h3 id="point-how" className="text-sm font-medium">
                Como cobrar
              </h3>
              <div className="flex flex-col gap-2">
                {TYPES.map((type) => (
                  <label key={type.value} className="flex items-start gap-3 text-sm">
                    <Checkbox
                      checked={config.paymentTypes.includes(type.value)}
                      // At least one way to pay stays on.
                      disabled={config.paymentTypes.length === 1 && config.paymentTypes.includes(type.value)}
                      onCheckedChange={(checked) =>
                        change({
                          paymentTypes: checked
                            ? [...config.paymentTypes, type.value]
                            : config.paymentTypes.filter((value) => value !== type.value),
                        })
                      }
                    />
                    <span>
                      {type.label}
                      {type.hint && <span className="block text-xs text-muted-foreground">{type.hint}</span>}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>Parcelamento no crédito</span>
                <Select
                  items={INSTALLMENTS}
                  value={String(config.maxInstallments)}
                  onValueChange={(value) => change({ maxInstallments: Number(value) })}
                >
                  <SelectTrigger className="w-36" aria-label="Parcelamento no crédito">
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
              </div>
              <label className="flex items-center justify-between gap-3 text-sm">
                Imprimir o comprovante na maquininha
                <Switch
                  checked={config.printTicket}
                  onCheckedChange={(checked) => change({ printTicket: checked })}
                  aria-label="Imprimir o comprovante na maquininha"
                />
              </label>
            </section>
          </>
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
