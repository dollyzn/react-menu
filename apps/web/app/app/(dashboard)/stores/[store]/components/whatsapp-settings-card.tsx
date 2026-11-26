"use client";

import { Icons } from "@/components/app/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BellRing,
  CircleAlert,
  CreditCard,
  History,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import type { WhatsAppConnection } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { embeddedSignupEvent, loadFacebookSdk } from "@/lib/facebook-sdk";
import {
  useConnectWhatsAppMutation,
  useDisconnectWhatsAppMutation,
  useGetWhatsAppQuery,
  useRefreshWhatsAppMutation,
  useUpdateWhatsAppSettingsMutation,
} from "@/redux/features/whatsapp/whatsappApi";
import { getErrorMessage } from "@/utils/get-error-message";
import { LoginStepList, NoticeList } from "./whatsapp-notices";
import { WhatsAppMessageLog } from "./whatsapp-message-log";

/** WhatsApp Manager, where the store adds a payment method (Meta charges the store). */
const WHATSAPP_MANAGER = "https://business.facebook.com/wa/manage/home/";




/**
 * The store's own WhatsApp number (ADR 0025), connected through Meta's
 * Embedded Signup: order notices to customers who ask for them at checkout,
 * and the customers' history sign-in. Meta charges the store per message.
 */
export function WhatsAppSettingsCard({ store }: { store: Store }) {
  const { data, isLoading } = useGetWhatsAppQuery(store.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Icons.whatsapp className="size-5 text-whatsapp" /> WhatsApp da loja
          {data?.account && !data.account.broken && <Badge>Conectado</Badge>}
        </CardTitle>
        <CardDescription>
          Avise os clientes do pedido online pelo WhatsApp da loja e deixe que eles vejam todos os seus pedidos
          entrando pelo WhatsApp. As mensagens são cobradas pela Meta, na forma de pagamento da conta da loja.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : !data.available ? (
          <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            O WhatsApp ainda não está configurado neste servidor. Fale com o suporte do React Menu.
          </p>
        ) : !data.account ? (
          <ConnectPanel storeId={store.id} signup={data.signup!} />
        ) : (
          <ConnectedPanel storeId={store.id} account={data.account} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * "Conectar WhatsApp": Meta's flow in a popup. It ends with a code (the
 * callback) and the chosen number (a window message); the API needs both.
 */
function ConnectPanel({ storeId, signup }: { storeId: string; signup: NonNullable<WhatsAppConnection["signup"]> }) {
  const [connect, { isLoading: connecting }] = useConnectWhatsAppMutation();
  const [opening, setOpening] = useState(false);
  const session = useRef<{ wabaId?: string; phoneNumberId?: string; businessId?: string; coexistence?: boolean }>({});
  const code = useRef<string | null>(null);

  const finish = useCallback(async () => {
    const { wabaId, phoneNumberId, businessId, coexistence } = session.current;
    if (!code.current || !wabaId || !phoneNumberId) return;
    const input = { code: code.current, wabaId, phoneNumberId, businessId, coexistence };
    code.current = null;
    session.current = {};
    try {
      await connect({ storeId, input }).unwrap();
      toast.success("WhatsApp conectado. Os modelos de mensagem foram enviados para análise da Meta.");
    } catch {
      // baseApi showed Meta's reason.
    }
  }, [connect, storeId]);

  // Embedded Signup tells the page which WABA and number were chosen.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const signupEvent = embeddedSignupEvent(event);
      if (!signupEvent) return;
      if (signupEvent.event === "CANCEL") {
        toast.info("Conexão com o WhatsApp interrompida antes do fim.");
        return;
      }
      if (signupEvent.event === "ERROR") {
        toast.error(signupEvent.data.error_message || "A Meta não concluiu a conexão. Tente de novo.");
        return;
      }
      if (!signupEvent.data.phone_number_id || !signupEvent.data.waba_id) {
        // Finished without a number (FINISH_ONLY_WABA): nothing to connect yet.
        code.current = null;
        session.current = {};
        setOpening(false);
        toast.info("A conta foi criada, mas nenhum número foi adicionado. Conecte de novo e escolha um número.");
        return;
      }
      session.current = {
        wabaId: signupEvent.data.waba_id,
        phoneNumberId: signupEvent.data.phone_number_id,
        businessId: signupEvent.data.business_id,
        coexistence: signupEvent.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
      };
      void finish();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [finish]);

  const start = async () => {
    if (signup.fake) {
      try {
        await connect({ storeId, input: { fake: true } }).unwrap();
        toast.success("Número de teste conectado (modo de desenvolvimento).");
      } catch {
        // baseApi showed it.
      }
      return;
    }
    if (!signup.appId || !signup.configId) return;
    setOpening(true);
    try {
      const sdk = await loadFacebookSdk(signup.appId, signup.graphVersion);
      // The SDK refuses async callbacks: a plain one that hands off the code.
      sdk.login(
        (response) => {
          setOpening(false);
          const received = response.authResponse?.code;
          if (!received) return;
          code.current = received;
          void finish();
        },
        {
          config_id: signup.configId,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {} },
        }
      );
    } catch (error) {
      setOpening(false);
      toast.error(getErrorMessage(error, "Não foi possível abrir a conexão com o WhatsApp."));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 text-sm sm:grid-cols-2">
        <li className="flex gap-3 rounded-2xl border p-3">
          <BellRing className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            <span className="font-medium">Avisos do pedido</span>
            <span className="block text-muted-foreground">
              Recebido, pronto para retirar e cancelado, para quem pedir no checkout.
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-2xl border p-3">
          <History className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            <span className="font-medium">Histórico do cliente</span>
            <span className="block text-muted-foreground">
              O cliente entra pelo WhatsApp e vê todos os pedidos, de qualquer celular.
            </span>
          </span>
        </li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Use um número que ainda não está no WhatsApp ou o número do WhatsApp Business da loja (ele continua
        funcionando no celular). A Meta pede os dados da empresa e uma forma de pagamento.
      </p>
      <Button
        className="self-start rounded-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp-hover"
        loading={opening || connecting}
        onClick={() => void start()}
      >
        <Icons.whatsapp /> {signup.fake ? "Conectar número de teste" : "Conectar WhatsApp"}
      </Button>
    </div>
  );
}

function ConnectedPanel({
  storeId,
  account,
}: {
  storeId: string;
  account: NonNullable<WhatsAppConnection["account"]>;
}) {
  const [save] = useUpdateWhatsAppSettingsMutation();
  const [refresh, { isLoading: refreshing }] = useRefreshWhatsAppMutation();
  const [disconnect, { isLoading: disconnecting }] = useDisconnectWhatsAppMutation();
  const pending = [...account.notices.map((notice) => notice.template), account.loginTemplate].some(
    (template) => template.status === "PENDING"
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border p-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-whatsapp/15 text-whatsapp">
          <Icons.whatsapp className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold tabular-nums">{account.displayPhoneNumber}</p>
          <p className="truncate text-sm text-muted-foreground">
            {account.verifiedName ?? "Nome em análise"}
            {account.coexistence && " · também no app WhatsApp Business"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refresh(storeId)} loading={refreshing}>
          <RefreshCw /> Atualizar
        </Button>
      </div>

      {account.broken && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>A conexão parou de funcionar</AlertTitle>
          <AlertDescription>
            A Meta não aceita mais o acesso desta loja{account.lastError ? ` (${account.lastError})` : ""}. Desconecte
            e conecte o WhatsApp de novo.
          </AlertDescription>
        </Alert>
      )}
      {account.paymentIssue && (
        <Alert variant="destructive">
          <CreditCard />
          <AlertTitle>A Meta recusou mensagens pela forma de pagamento</AlertTitle>
          <AlertDescription>
            Adicione ou atualize o cartão da conta do WhatsApp no{" "}
            <a href={WHATSAPP_MANAGER} target="_blank" rel="noopener noreferrer" className="underline">
              WhatsApp Manager
            </a>
            . Os avisos voltam assim que uma mensagem for entregue.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="whatsapp-notices" className="flex min-w-0 flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="whatsapp-notices" className="font-semibold">
                  Avisos do pedido
                </h3>
                <p className="text-sm text-muted-foreground">
                  Para quem marcar “Receber avisos pelo WhatsApp” no checkout. Cada mensagem é cobrada pela Meta.
                </p>
              </div>
              <Switch
                checked={account.notifyOrders}
                aria-label="Enviar avisos do pedido"
                onCheckedChange={(checked) => void save({ storeId, input: { notifyOrders: checked } })}
              />
            </div>
            <NoticeList
              notices={account.notices}
              disabled={!account.notifyOrders}
              onToggle={(notice, on) => void save({ storeId, input: { notices: { [notice.kind]: on } } })}
            />
            <p className="text-xs text-muted-foreground">
              A Meta analisa cada mensagem antes do primeiro envio (de minutos a um dia).{" "}
              {pending && "Conferimos de tempos em tempos; “Atualizar” confere agora."}
              {account.templatesCheckedAt &&
                ` Última conferência ${formatDistanceToNow(parseISO(account.templatesCheckedAt), { addSuffix: true, locale: ptBR })}.`}
            </p>
          </section>

          <section aria-labelledby="whatsapp-login" className="flex min-w-0 flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="whatsapp-login" className="font-semibold">
                  Histórico pelo WhatsApp
                </h3>
                <p className="text-sm text-muted-foreground">
                  Em “Meus pedidos”, o cliente prova que o número é dele e vê todos os pedidos, de qualquer celular.
                </p>
              </div>
              <Switch
                checked={account.customerLogin}
                aria-label="Oferecer o histórico pelo WhatsApp"
                onCheckedChange={(checked) => void save({ storeId, input: { customerLogin: checked } })}
              />
            </div>
            <LoginStepList steps={account.loginSteps} active={account.customerLogin} />
          </section>
        </div>

        {/* Beside the lists on wide screens, following the page as it scrolls. */}
        <div className="min-w-0 lg:sticky lg:top-4">
          <WhatsAppMessageLog storeId={storeId} />
        </div>
      </div>

      <AlertDialogDestructive
        title="Desconectar o WhatsApp?"
        description="Os clientes deixam de receber avisos e de entrar pelo WhatsApp. O número continua seu na Meta e pode ser conectado de novo."
        confirmLabel="Desconectar"
        icon={<Unplug />}
        loading={disconnecting}
        onConfirm={async () => {
          await disconnect(storeId).unwrap();
          toast.success("WhatsApp desconectado.");
        }}
      >
        <Button variant="ghost" size="sm" className="self-start text-destructive">
          <Unplug /> Desconectar
        </Button>
      </AlertDialogDestructive>
    </div>
  );
}
