import type { PartnerCommissionRule } from "@react-menu/contracts";
import { formatCurrencyBRL } from "@/utils/string";

/**
 * A partner's commission on a sale (ADR 0024), mirroring the API's
 * `commissionFor`: percent of the subtotal or a value per unit, half up to
 * the cent. Only a preview: the API keeps the amount on the order.
 */
export function commissionFor(rule: Pick<PartnerCommissionRule, "type" | "value">, sale: { subtotal: number; units: number }) {
  const amount = rule.type === "percent" ? (sale.subtotal * rule.value) / 100 : sale.units * rule.value;
  return Math.round(Math.round(amount * 1000) / 10) / 100;
}

/** "10% de cada venda" / "R$ 1,50 por unidade". */
export function commissionRuleLabel(rule: Pick<PartnerCommissionRule, "type" | "value">) {
  return rule.type === "percent"
    ? `${rule.value.toLocaleString("pt-BR")}% de cada venda`
    : `${formatCurrencyBRL(rule.value)} por unidade vendida`;
}
