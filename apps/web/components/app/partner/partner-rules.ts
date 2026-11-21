import { z } from "zod";
import type { PartnerCancelPolicy, PartnerCommissionType, PartnerInput } from "@react-menu/contracts";

/** Up to when a partner cancels alone (ADR 0024), as the managers read it. */
export const CANCEL_POLICIES: Record<PartnerCancelPolicy, { label: string; description: string }> = {
  until_kitchen: {
    label: "Até a cozinha começar",
    description: "Depois que a cozinha começa, o parceiro pede o cancelamento a um gerente.",
  },
  until_ready: {
    label: "Até ficar pronto",
    description: "Pronto na loja, o parceiro pede o cancelamento a um gerente.",
  },
  never: {
    label: "Sempre pedir a um gerente",
    description: "Depois de pago, todo cancelamento passa por um gerente.",
  },
};

export const CANCEL_POLICY_ITEMS = (Object.keys(CANCEL_POLICIES) as PartnerCancelPolicy[]).map((value) => ({
  value,
  label: CANCEL_POLICIES[value].label,
}));

export const COMMISSION_TYPES: Record<PartnerCommissionType, string> = {
  percent: "% da venda",
  per_unit: "R$ por unidade",
};

export const EMPTY_PARTNER: PartnerInput = {
  name: "",
  commissionType: "percent",
  commissionValue: 10,
  cancelPolicy: "until_kitchen",
};

/** The API checks it too (PartnerService). */
export const partnerSchema = z
  .object({
    name: z.string().trim().min(2, "Pelo menos 2 letras.").max(80, "No máximo 80 caracteres."),
    commissionType: z.enum(["percent", "per_unit"]),
    commissionValue: z.number().min(0, "Não pode ser negativa."),
    cancelPolicy: z.enum(["never", "until_kitchen", "until_ready"]),
  })
  .refine((value) => value.commissionType !== "percent" || value.commissionValue <= 100, {
    path: ["commissionValue"],
    message: "A porcentagem vai até 100.",
  })
  .refine((value) => value.commissionType !== "per_unit" || value.commissionValue <= 1000, {
    path: ["commissionValue"],
    message: "No máximo R$ 1.000 por unidade.",
  });

export type PartnerFormValues = z.infer<typeof partnerSchema>;
