import { ChefHat, Crown, ShoppingCart } from "lucide-react";
import type { StoreRole } from "@react-menu/contracts";

/** What each store role can do, as shown to managers. */
export const ROLES: Record<StoreRole, { label: string; description: string; icon: typeof Crown }> = {
  manager: {
    label: "Gerente",
    description: "Tudo: cardápio, estoque, configurações, equipe e pedidos.",
    icon: Crown,
  },
  attendant: {
    label: "Atendente",
    description: "PDV, quadro de pedidos e entrega no balcão.",
    icon: ShoppingCart,
  },
  kitchen: {
    label: "Cozinha",
    description: "Só a tela da cozinha.",
    icon: ChefHat,
  },
};

export const ROLE_ITEMS = (Object.keys(ROLES) as StoreRole[]).map((value) => ({
  value,
  label: ROLES[value].label,
}));
