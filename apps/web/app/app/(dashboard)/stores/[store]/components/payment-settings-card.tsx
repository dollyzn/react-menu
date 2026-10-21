"use client";

import { useState } from "react";
import { Copy, CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
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

/** Mercado Pago credentials of the in-app checkout (ADR 0015); managers only. */
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
          Pix e cartão pagos dentro do cardápio, sem sair do app. O pedido só vai para a cozinha depois do
          pagamento aprovado, e pedidos pagos cancelados são reembolsados automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {enabled && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Pix ativo</Badge>
            <Badge variant={store.mercadoPagoPublicKey ? "outline" : "secondary"}>
              {store.mercadoPagoPublicKey ? "Cartão ativo" : "Cartão: falta a Public Key"}
            </Badge>
          </div>
        )}
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
  const [publicKey, setPublicKey] = useState(store.mercadoPagoPublicKey ?? "");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await save({
      id: store.id,
      data: {
        mercadoPagoAccessToken: token.trim(),
        mercadoPagoWebhookSecret: secret.trim(),
        mercadoPagoPublicKey: publicKey.trim() || null,
      },
    }).unwrap();
    toast.success("Pagamentos online configurados");
    setToken("");
    setSecret("");
    onOpenChange(false);
  };

  const disable = async () => {
    await save({
      id: store.id,
      data: { mercadoPagoAccessToken: null, mercadoPagoWebhookSecret: null, mercadoPagoPublicKey: null },
    }).unwrap();
    toast.success("Pagamentos online desligados");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Mercado Pago</DialogTitle>
            <DialogDescription>
              No painel do Mercado Pago, abra a sua aplicação em “Suas integrações”.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <ol className="space-y-4 text-sm">
              <Step n={1} title="Cadastre o webhook">
                Em Webhooks, cole esta URL e marque o evento “Pagamentos”.
                <div className="mt-2 flex items-start gap-2">
                  <code className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1.5 text-xs break-all">{webhookUrl}</code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Copiar URL do webhook"
                    onClick={() => copyToClipboard(webhookUrl)}
                  >
                    <Copy />
                  </Button>
                </div>
              </Step>
              <Step n={2} title="Copie as credenciais">
                Em “Credenciais” ficam a Public Key e o Access Token; a assinatura secreta aparece depois de salvar
                o webhook.
              </Step>
            </ol>
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
                <FieldDescription>Credenciais de teste (TEST-) não cobram de verdade.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="mp-public-key">Public Key (para cartão)</FieldLabel>
                <Input
                  id="mp-public-key"
                  autoComplete="off"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="APP_USR-… ou TEST-…"
                />
                <FieldDescription>Opcional. Sem ela, o cardápio oferece só o Pix.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="mp-secret">Assinatura secreta do webhook</FieldLabel>
                <Input
                  id="mp-secret"
                  type="password"
                  autoComplete="off"
                  required
                  minLength={8}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
                <FieldDescription>As credenciais ficam criptografadas e nunca são exibidas de novo.</FieldDescription>
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter className="sm:justify-between">
            {store.mercadoPagoEnabled ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={disable} disabled={isLoading}>
                Desligar pagamentos online
              </Button>
            ) : (
              <span className="hidden sm:block" />
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

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-muted-foreground">
        <p className="font-medium text-foreground">{title}</p>
        {children}
      </div>
    </li>
  );
}
