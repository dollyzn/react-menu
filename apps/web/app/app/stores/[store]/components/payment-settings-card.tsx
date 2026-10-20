"use client";

import { useState } from "react";
import { Copy, CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useUpdatePaymentSettingsMutation } from "@/redux/features/store/storeApi";
import { getApiOrigin } from "@/lib/api-base-url";
import { copyToClipboard } from "@/utils/copy-to-clipboard";

/** Mercado Pago (Checkout Pro) credentials of the store; managers only. */
export function PaymentSettingsCard({ store }: { store: Store }) {
  const [open, setOpen] = useState(false);
  const webhookUrl = `${getApiOrigin()}/api/v1/webhooks/mercado-pago/${store.id}`;
  const enabled = store.mercadoPagoEnabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" /> Pagamentos online
          <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Ativo" : "Desligado"}</Badge>
        </CardTitle>
        <CardDescription>
          Pix e cartão pelo Mercado Pago. O pedido só vai para a cozinha depois do pagamento aprovado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">URL de notificação (webhook)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">{webhookUrl}</code>
            <Button variant="outline" size="icon-sm" aria-label="Copiar URL do webhook" onClick={() => copyToClipboard(webhookUrl)}>
              <Copy />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOpen(true)}>{enabled ? "Trocar credenciais" : "Configurar"}</Button>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer" />}
          >
            Painel do Mercado Pago <ExternalLink />
          </Button>
        </div>
      </CardContent>
      <PaymentSettingsDialog store={store} webhookUrl={webhookUrl} open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function PaymentSettingsDialog({
  store,
  webhookUrl,
  open,
  onOpenChange,
}: {
  store: Store;
  webhookUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [save, { isLoading }] = useUpdatePaymentSettingsMutation();
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await save({
      id: store.id,
      data: { mercadoPagoAccessToken: token.trim(), mercadoPagoWebhookSecret: secret.trim() },
    }).unwrap();
    toast.success("Pagamentos online configurados");
    setToken("");
    setSecret("");
    onOpenChange(false);
  };

  const disable = async () => {
    await save({ id: store.id, data: { mercadoPagoAccessToken: null, mercadoPagoWebhookSecret: null } }).unwrap();
    toast.success("Pagamentos online desligados");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Mercado Pago</DialogTitle>
            <DialogDescription>
              Em “Suas integrações” no painel do Mercado Pago: copie o Access Token e, em Webhooks, cadastre a URL abaixo
              (evento “Pagamentos”) e copie a assinatura secreta.
            </DialogDescription>
          </DialogHeader>
          <code className="block truncate rounded-md bg-muted px-2 py-1.5 text-xs">{webhookUrl}</code>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="mp-token">Access Token</FieldLabel>
              <Input
                id="mp-token"
                type="password"
                autoComplete="off"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="APP_USR-… ou TEST-…"
              />
              <FieldDescription>Tokens TEST- usam o checkout de testes (sandbox).</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="mp-secret">Assinatura secreta do webhook</FieldLabel>
              <Input id="mp-secret" type="password" autoComplete="off" required minLength={8} value={secret} onChange={(e) => setSecret(e.target.value)} />
            </Field>
          </FieldGroup>
          <p className="text-xs text-muted-foreground">As credenciais ficam criptografadas e nunca são exibidas de novo.</p>
          <DialogFooter className="sm:justify-between">
            {store.mercadoPagoEnabled ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={disable} disabled={isLoading}>
                Desligar pagamentos online
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" loading={isLoading}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
