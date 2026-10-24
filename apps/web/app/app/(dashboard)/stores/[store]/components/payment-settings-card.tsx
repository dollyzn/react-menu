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
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useUpdatePaymentSettingsMutation } from "@/redux/features/store/storeApi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { getApiOrigin } from "@/lib/api-base-url";
import { copyToClipboard } from "@/utils/copy-to-clipboard";

const INSTALLMENT_ITEMS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: index === 0 ? "Só à vista" : `Até ${index + 1}x`,
}));

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
      <CardContent className="flex flex-col gap-3">
        {enabled && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Pix ativo</Badge>
            <Badge variant={store.mercadoPagoPublicKey ? "outline" : "secondary"}>
              {store.mercadoPagoPublicKey ? "Cartão ativo" : "Cartão: falta a Public Key"}
            </Badge>
          </div>
        )}
        <div className="flex flex-col gap-1">
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

const TOKEN = /^(APP_USR|TEST)-[\w-]+$/;
const PUBLIC_KEY = /^(APP_USR|TEST)-[0-9a-f-]{36}$/i;

/**
 * With credentials already saved, the token and the secret may stay blank
 * (they are never shown again): only what was typed is sent.
 */
const settingsSchema = (configured: boolean) =>
  z.object({
    accessToken: z
      .string()
      .trim()
      .refine((value) => (configured && !value) || TOKEN.test(value), {
        message: configured
          ? "Deixe em branco para manter, ou cole um token que comece com APP_USR- ou TEST-."
          : "Cole o Access Token: começa com APP_USR- ou TEST-.",
      }),
    publicKey: z
      .string()
      .trim()
      .refine((value) => !value || PUBLIC_KEY.test(value), {
        message: "A Public Key começa com APP_USR- ou TEST- seguido de um código de 36 caracteres.",
      }),
    maxInstallments: z.string(),
    webhookSecret: z
      .string()
      .trim()
      .refine((value) => (configured && !value) || value.length >= 8, {
        message: configured
          ? "Deixe em branco para manter, ou cole a assinatura (pelo menos 8 caracteres)."
          : "Cole a assinatura secreta do webhook (pelo menos 8 caracteres).",
      }),
  });
type SettingsValues = z.infer<ReturnType<typeof settingsSchema>>;

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
  const configured = store.mercadoPagoEnabled;
  const defaults: SettingsValues = {
    accessToken: "",
    publicKey: store.mercadoPagoPublicKey ?? "",
    maxInstallments: String(store.maxInstallments ?? 1),
    webhookSecret: "",
  };
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema(configured)),
    defaultValues: defaults,
  });
  const busy = form.formState.isSubmitting || isLoading;

  const close = (next: boolean) => {
    if (busy) return;
    if (!next) form.reset(defaults);
    onOpenChange(next);
  };

  const submit = async (values: SettingsValues) => {
    try {
      await save({
        id: store.id,
        data: {
          ...(values.accessToken && { mercadoPagoAccessToken: values.accessToken }),
          ...(values.webhookSecret && { mercadoPagoWebhookSecret: values.webhookSecret }),
          mercadoPagoPublicKey: values.publicKey || null,
          maxInstallments: Number(values.maxInstallments),
        },
      }).unwrap();
      toast.success(configured ? "Pagamentos online atualizados" : "Pagamentos online configurados");
      form.reset({ ...values, accessToken: "", webhookSecret: "" });
      onOpenChange(false);
    } catch {
      // baseApi shows the API's answer (e.g. a credential it refused).
    }
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
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={form.handleSubmit(submit)} noValidate>
          <DialogHeader>
            <DialogTitle>Mercado Pago</DialogTitle>
            <DialogDescription>
              No painel do Mercado Pago, abra a sua aplicação em “Suas integrações”.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-5">
            <ol className="flex flex-col gap-4 text-sm">
              <Step n={1} title="Cadastre o webhook">
                Em Webhooks, cole esta URL e marque os eventos “Order (Mercado Pago)” e “Pagamentos”.
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
              <Controller
                name="accessToken"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="mp-token">Access Token</FieldLabel>
                    <Input
                      {...field}
                      id="mp-token"
                      type="password"
                      autoComplete="off"
                      disabled={busy}
                      aria-invalid={fieldState.invalid}
                      placeholder={configured ? "Salvo · deixe em branco para manter" : "APP_USR-… ou TEST-…"}
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : (
                      <FieldDescription>Credenciais de teste (TEST-) não cobram de verdade.</FieldDescription>
                    )}
                  </Field>
                )}
              />
              <Controller
                name="publicKey"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="mp-public-key">Public Key (para cartão)</FieldLabel>
                    <Input
                      {...field}
                      id="mp-public-key"
                      autoComplete="off"
                      disabled={busy}
                      aria-invalid={fieldState.invalid}
                      placeholder="APP_USR-… ou TEST-…"
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : (
                      <FieldDescription>Opcional. Sem ela, o cardápio oferece só o Pix.</FieldDescription>
                    )}
                  </Field>
                )}
              />
              <Controller
                name="maxInstallments"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="mp-installments">Parcelamento no cartão</FieldLabel>
                    <Select
                      items={INSTALLMENT_ITEMS}
                      value={field.value}
                      onValueChange={(value) => field.onChange(String(value))}
                      disabled={busy}
                    >
                      <SelectTrigger id="mp-installments" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INSTALLMENT_ITEMS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>Os juros seguem a configuração da sua conta do Mercado Pago.</FieldDescription>
                  </Field>
                )}
              />
              <Controller
                name="webhookSecret"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="mp-secret">Assinatura secreta do webhook</FieldLabel>
                    <Input
                      {...field}
                      id="mp-secret"
                      type="password"
                      autoComplete="off"
                      disabled={busy}
                      aria-invalid={fieldState.invalid}
                      placeholder={configured ? "Salva · deixe em branco para manter" : undefined}
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : (
                      <FieldDescription>As credenciais ficam criptografadas e nunca são exibidas de novo.</FieldDescription>
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </DialogBody>
          <DialogFooter className="sm:justify-between">
            {configured ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={disable} disabled={busy}>
                Desligar pagamentos online
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <Button type="submit" loading={busy}>
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
