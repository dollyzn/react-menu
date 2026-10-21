import { CreditCard, QrCode, Store as StoreIcon } from "lucide-react";
import type { CheckoutPaymentMethod } from "@react-menu/contracts";

/**
 * How each checkout method is presented. The API decides which ones a store
 * offers (`store.paymentMethods`); a new method only needs an entry here and
 * its panel in `payment-panel.tsx`.
 */
export const CHECKOUT_METHODS: Record<
  CheckoutPaymentMethod,
  { label: string; hint: string; icon: typeof CreditCard }
> = {
  pix: { label: "Pix", hint: "QR Code na hora, aprovado em segundos", icon: QrCode },
  card: { label: "Cartão", hint: "Crédito ou débito, aqui mesmo no app", icon: CreditCard },
  counter: { label: "Pagar na retirada", hint: "Dinheiro, cartão ou Pix no balcão", icon: StoreIcon },
};

/** Friendly reason for a rejected card (Mercado Pago `status_detail`). */
export function cardRejection(detail: string | null) {
  switch (detail) {
    case "cc_rejected_insufficient_amount":
      return "Saldo ou limite insuficiente.";
    case "cc_rejected_bad_filled_security_code":
      return "Código de segurança incorreto.";
    case "cc_rejected_bad_filled_date":
      return "Data de validade incorreta.";
    case "cc_rejected_bad_filled_card_number":
    case "cc_rejected_bad_filled_other":
      return "Confira os dados do cartão.";
    case "cc_rejected_call_for_authorize":
      return "O banco pediu autorização: libere a compra no app do banco e tente de novo.";
    case "cc_rejected_card_disabled":
      return "Cartão desativado. Ative-o com o banco ou use outro.";
    case "cc_rejected_duplicated_payment":
      return "Pagamento duplicado: confira se ele já não foi aprovado.";
    case "cc_rejected_high_risk":
      return "Pagamento recusado por segurança. Tente o Pix.";
    default:
      return "Pagamento recusado. Tente outro cartão ou o Pix.";
  }
}
