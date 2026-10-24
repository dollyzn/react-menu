"use client";

import { useState } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import type { PublicPaymentRequest } from "@react-menu/contracts";
import { Skeleton } from "@/components/ui/skeleton";

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

  return (
    <div className="relative min-h-80">
      {!ready && <Skeleton className="absolute inset-0 rounded-2xl" />}
      <CardPayment
        initialization={{ amount, payer: email ? { email } : undefined }}
        customization={{ paymentMethods: { maxInstallments }, visual: { hideFormTitle: true } }}
        locale="pt-BR"
        onReady={() => setReady(true)}
        onError={() => setReady(true)}
        onSubmit={async (data, additional) => {
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
        }}
      />
    </div>
  );
}
