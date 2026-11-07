"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { useTheme } from "@wrksz/themes/client";
import type { PublicPaymentRequest } from "@react-menu/contracts";
import { Skeleton } from "@/components/ui/skeleton";
import { mercadoPagoStyle, type BrickStyle } from "@/lib/mercado-pago-style";

type BrickProps = React.ComponentProps<typeof CardPayment>;

let initializedKey: string | null = null;

/** Once per public key, before the Brick mounts (client only). */
function ensureMercadoPago(publicKey: string) {
  if (initializedKey === publicKey) return;
  initMercadoPago(publicKey, { locale: "pt-BR" });
  initializedKey = publicKey;
}

/**
 * Mercado Pago Card Payment Brick: card data stays in Mercado Pago's iframe,
 * we only receive a single-use token. Loaded on demand (next/dynamic), so
 * the SDK script never weighs on the menu.
 */
export default function CardPaymentForm({
  publicKey,
  amount,
  maxInstallments,
  email,
  onPay,
}: {
  publicKey: string;
  amount: number;
  /** The store's limit (1 = à vista). */
  maxInstallments: number;
  email?: string;
  onPay: (input: PublicPaymentRequest) => Promise<void>;
}) {
  const [ready, setReady] = useState(false);
  ensureMercadoPago(publicKey);

  // The SDK's <CardPayment> unmounts and rebuilds the Brick whenever
  // `initialization`, `customization` or a callback changes identity: the
  // form would reload on every re-render of the page (the order refreshes
  // every 30 s and in realtime) and, mid-submit, lose the payment. So the
  // objects change only with their values and the callbacks never do.
  const initialization = useMemo(() => ({ amount, payer: email ? { email } : undefined }), [amount, email]);
  // The app's theme and colors, read once the page shows the current theme.
  const { resolvedTheme } = useTheme();
  const [style, setStyle] = useState<BrickStyle | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setStyle(mercadoPagoStyle(resolvedTheme === "dark")));
    return () => cancelAnimationFrame(frame);
  }, [resolvedTheme]);
  const customization = useMemo(
    () => ({ paymentMethods: { maxInstallments }, visual: { hideFormTitle: true, style: style ?? undefined } }),
    [maxInstallments, style]
  );
  const latest = useRef({ onPay, email });
  useEffect(() => {
    latest.current = { onPay, email };
  });
  const onReady = useCallback(() => setReady(true), []);
  const onSubmit = useCallback<NonNullable<BrickProps["onSubmit"]>>(
    async (data, additional) => {
      const { onPay, email } = latest.current;
      await onPay({
        method: "card",
        payer: { email: data.payer.email ?? email ?? "" },
        card: {
          token: data.token,
          installments: data.installments,
          paymentMethodId: data.payment_method_id,
          // credit_card / debit_card: the Orders API needs the card type.
          paymentTypeId: additional?.paymentTypeId,
          issuerId: data.issuer_id ? String(data.issuer_id) : undefined,
          identification:
            data.payer.identification?.type && data.payer.identification.number
              ? { type: data.payer.identification.type, number: data.payer.identification.number }
              : undefined,
        },
      });
    },
    []
  );

  return (
    // -mx-4: the Brick pads its form by 16px; this lines it up with the panel.
    // The font: the Brick hands the computed font-family to the card fields,
    // which live in Mercado Pago's iframes where our Geist doesn't exist; the
    // list ends in Arial there instead of the browser's serif default.
    <div className="relative -mx-4 min-h-80 [font-family:var(--font-sans),Arial,Helvetica,sans-serif]">
      {!ready && <Skeleton className="absolute inset-0 mx-4 rounded-2xl" />}
      {style && (
      <CardPayment
        initialization={initialization}
        customization={customization}
        locale="pt-BR"
        onReady={onReady}
        onError={onReady}
        onSubmit={onSubmit}
      />
      )}
    </div>
  );
}
