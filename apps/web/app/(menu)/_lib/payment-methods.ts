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

/**
 * Friendly reason for a rejected card: Mercado Pago `status_detail` of the
 * Orders API (rejected_by_issuer…) and of older Payments API attempts (cc_rejected_…).
 */
export function cardRejection(detail: string | null) {
  switch (detail) {
    case "insufficient_amount":
    case "card_insufficient_amount":
    case "cc_rejected_insufficient_amount":
      return "Saldo ou limite insuficiente.";
    case "amount_limit_exceeded":
      return "O valor passou do limite do cartão. Tente outro cartão ou o Pix.";
    case "invalid_installments":
      return "Esse número de parcelas não é aceito para este cartão.";
    case "bad_filled_card_data":
    case "invalid_card_token":
    case "cc_rejected_bad_filled_security_code":
      return "Código de segurança incorreto.";
    case "cc_rejected_bad_filled_date":
      return "Data de validade incorreta.";
    case "cc_rejected_bad_filled_card_number":
    case "cc_rejected_bad_filled_other":
      return "Confira os dados do cartão.";
    case "required_call_for_authorize":
    case "cc_rejected_call_for_authorize":
      return "O banco pediu autorização: libere a compra no app do banco e tente de novo.";
    case "card_disabled":
    case "cc_rejected_card_disabled":
      return "Cartão desativado. Ative-o com o banco ou use outro.";
    case "cc_rejected_duplicated_payment":
      return "Pagamento duplicado: confira se ele já não foi aprovado.";
    case "high_risk":
    case "cc_rejected_high_risk":
      return "Pagamento recusado por segurança. Tente o Pix.";
    case "max_attempts_exceeded":
      return "Muitas tentativas com este cartão. Use outro cartão ou o Pix.";
    case "cc_rejected_3ds_challenge":
      return "O banco não confirmou a compra. Tente de novo, use outro cartão ou o Pix.";
    case "3ds_challenge_expired":
      return "A confirmação do banco expirou. Tente de novo.";
    case "processing_error":
      return "O Mercado Pago não conseguiu processar agora. Tente de novo em instantes.";
    default:
      return "Pagamento recusado. Tente outro cartão ou o Pix.";
  }
}
