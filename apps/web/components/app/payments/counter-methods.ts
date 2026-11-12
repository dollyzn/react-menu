import { Banknote, CreditCard, QrCode, SmartphoneNfc, WalletCards, type LucideIcon } from "lucide-react";
import type { CounterPaymentMethod } from "@react-menu/contracts";

/** How the counter was paid, as the cashier picks it (POS and "Receber pagamento"). */
export const COUNTER_METHODS: Record<CounterPaymentMethod, { label: string; hint: string; icon: LucideIcon }> = {
  cash: { label: "Dinheiro", hint: "Com troco", icon: Banknote },
  pix: { label: "Pix", hint: "Pix direto da loja", icon: QrCode },
  credit: { label: "Crédito", hint: "Em outra máquina", icon: CreditCard },
  debit: { label: "Débito", hint: "Em outra máquina", icon: WalletCards },
};

export const COUNTER_METHOD_ORDER: CounterPaymentMethod[] = ["cash", "pix", "credit", "debit"];

/** The integrated card machine (Mercado Pago Point), next to the counter methods. */
export const MACHINE = { label: "Maquininha", hint: "Cobra pelo sistema", icon: SmartphoneNfc };

/** "em dinheiro", "no Pix", "no crédito", "no débito": after "Pago" or "recebido". */
export function paidWith(method: CounterPaymentMethod) {
  return { cash: "em dinheiro", pix: "no Pix", credit: "no crédito", debit: "no débito" }[method];
}
