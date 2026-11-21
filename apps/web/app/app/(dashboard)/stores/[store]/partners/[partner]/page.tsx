"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { useParams } from "next/navigation";
import { ChartNoAxesColumn, Handshake, Pause, Receipt, Settings2, SmartphoneNfc, Users } from "lucide-react";
import type { StorePartner } from "@react-menu/contracts";
import { PageHeader } from "@/components/app/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryParam } from "@/hooks/use-query-param";
import { commissionRuleLabel } from "@/lib/partner-commission";
import { useGetPartnerQuery } from "@/redux/features/partner/partnersApi";
import { PartnerActions } from "../components/partner-row-actions";
import { CANCEL_POLICIES } from "@/components/app/partner/partner-rules";
import { CatalogEditor } from "./components/catalog-editor";
import { PartnerOverview } from "./components/partner-overview";
import { PartnerSales } from "./components/partner-sales";
import { RulesCard } from "./components/rules-card";

const TABS = [
  { value: "visao-geral", label: "Visão geral", icon: ChartNoAxesColumn },
  { value: "vendas", label: "Vendas e acertos", icon: Receipt },
  { value: "configuracoes", label: "Configurações", icon: Settings2 },
] as const;
type Tab = (typeof TABS)[number]["value"];
const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.value === value);

/** The same entrance as the store page's tabs. */
const PANEL =
  "text-base animate-in fade-in-0 duration-300 ease-out data-[activation-direction=right]:slide-in-from-right-4 data-[activation-direction=left]:slide-in-from-left-4 motion-reduce:animate-none";

/** One partner (ADR 0024; managers): the period at a glance, sales and settlements, rules and menu. */
export default function PartnerPage() {
  const { store: storeId, partner: partnerId } = useParams<{ store: string; partner: string }>();
  const { data: partner, isLoading } = useGetPartnerQuery({ storeId, partnerId });
  const [tabParam, setTabParam] = useQueryParam("aba");
  const tab: Tab = isTab(tabParam) ? tabParam : "visao-geral";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <PageHeader title="Parceiro" description="Vendas, comissão, regras e o que o parceiro pode vender." />
      {isLoading || !partner ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-10 w-80 rounded-lg" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <PartnerSummary partner={partner} />
          <Tabs value={tab} onValueChange={(value) => setTabParam(value === "visao-geral" ? null : String(value))} className="gap-4">
            {/* Scrolls sideways on narrow phones instead of squeezing the labels. */}
            <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
              <TabsList variant="line" className="relative w-max min-w-full justify-start border-b">
                {TABS.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="flex-none px-3 transition-colors after:hidden data-active:text-primary dark:data-active:text-primary"
                  >
                    <Icon className="max-sm:hidden" />
                    {label}
                  </TabsTrigger>
                ))}
                {/* One bar that slides to the active tab. */}
                <TabsPrimitive.Indicator className="absolute bottom-[-1px] left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-primary transition-[translate,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none" />
              </TabsList>
            </div>
            <TabsContent value="visao-geral" className={PANEL}>
              <PartnerOverview storeId={storeId} partnerId={partner.id} />
            </TabsContent>
            <TabsContent value="vendas" className={PANEL}>
              <PartnerSales storeId={storeId} partnerId={partner.id} />
            </TabsContent>
            {/* Kept mounted: a half-edited form survives switching tabs. */}
            <TabsContent value="configuracoes" keepMounted className={`flex flex-col gap-4 ${PANEL}`}>
              <RulesCard key={partner.updatedAt} storeId={storeId} partner={partner} />
              <CatalogEditor key={`catalog-${partner.updatedAt}`} storeId={storeId} partner={partner} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

/** The partner at a glance, like the store page's summary: who, the rules, the machine, the people. */
function PartnerSummary({ partner }: { partner: StorePartner }) {
  const facts = [
    { icon: Receipt, label: commissionRuleLabel({ type: partner.commissionType, value: partner.commissionValue }) },
    { icon: Settings2, label: `Cancela: ${CANCEL_POLICIES[partner.cancelPolicy].label.toLowerCase()}` },
    {
      icon: SmartphoneNfc,
      label: partner.terminals.length
        ? partner.terminals.map((terminal) => terminal.name).join(", ")
        : "Sem maquininha (empreste em Loja › Pagamentos)",
    },
    { icon: Users, label: `${partner.membersCount} ${partner.membersCount === 1 ? "pessoa" : "pessoas"}` },
  ];
  return (
    <Card className="py-4">
      <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-partner/15 text-partner">
          <Handshake className="size-7" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight">
            {partner.name}
            {partner.pausedAt ? (
              <Badge variant="outline" className="gap-1 text-warning">
                <Pause /> Vendas pausadas
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-success">
                <span className="size-1.5 rounded-full bg-success" /> Vendendo
              </Badge>
            )}
          </h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {facts.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <Icon className="size-3.5" /> {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 gap-2 sm:self-start">
          <PartnerActions partner={partner} size="icon" showOpen={false} />
        </div>
      </CardContent>
    </Card>
  );
}
