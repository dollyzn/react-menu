"use client";

import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Clock, Copy, CreditCard, ExternalLink, ImageIcon, ListOrdered, MapPin, Store as StoreIcon } from "lucide-react";
import Image from "@/components/app/image";
import { Icons } from "@/components/app/icons";
import { PageHeader } from "@/components/app/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryParam } from "@/hooks/use-query-param";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import { copyToClipboard } from "@/utils/copy-to-clipboard";
import { CardFeeCard } from "./components/card-fee-card";
import { MenuOrder } from "./components/menu-order";
import { CommentRatings } from "./components/rating";
import { OpeningHoursCard } from "./components/opening-hours-card";
import { PaymentSettingsCard } from "./components/payment-settings-card";
import { PointSettingsCard } from "./components/point-settings-card";
import { StoreOperationCard } from "./components/store-operation-card";
import { StoreProfileForm } from "./components/store-profile-form";
import { StoreStatusDropdown } from "./components/store-status-dropdown";
import { UpdateBannerDialog } from "./components/update-banner-dialog";
import { UpdatePhotoDialog } from "./components/update-photo-dialog";

const TABS = [
  { value: "perfil", label: "Perfil", icon: StoreIcon },
  { value: "cardapio", label: "Cardápio", icon: ListOrdered },
  { value: "funcionamento", label: "Funcionamento", icon: Clock },
  { value: "pagamentos", label: "Pagamentos", icon: CreditCard },
] as const;
type Tab = (typeof TABS)[number]["value"];
const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.value === value);

/** Banner, logo, name, status and the menu's link: the store at a glance, on every tab. */
function StoreSummary({ store }: { store: Store }) {
  const menuPath = `/${store.slug}`;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="relative h-32 w-full bg-muted sm:h-44">
        {store.bannerUrl ? (
          <Image
            src={store.bannerUrl}
            blurDataURL={store.bannerBlur}
            alt=""
            fill
            sizes="(min-width: 1280px) 1200px, 100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
            Nenhum banner definido
          </div>
        )}
        <UpdateBannerDialog storeId={store.id} />
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-end sm:gap-4 sm:px-6">
        <div className="relative -mt-10 size-20 shrink-0 rounded-xl bg-card p-1 shadow-sm ring-1 ring-border sm:-mt-12 sm:size-24">
          <div className="relative size-full">
            {store.photoUrl ? (
              <Image
                src={store.photoUrl}
                blurDataURL={store.photoBlur}
                alt={`Logo de ${store.name}`}
                fill
                sizes="96px"
                className="rounded-lg"
                style={{ objectFit: "contain" }}
                loading="eager"
              />
            ) : (
              <ImageIcon strokeWidth={0.75} className="size-full text-muted-foreground" />
            )}
          </div>
          <UpdatePhotoDialog storeId={store.id} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate text-xl font-bold">{store.name}</h2>
            <StoreStatusDropdown store={store} />
          </div>
          <p className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" />
            <span className="truncate">{store.address || "Endereço não definido"}</span>
          </p>
          <CommentRatings rating={5} totalStars={5} size={16} variant="yellow" precision={0.1} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Resolved on click: the server render has no window.
              copyToClipboard(new URL(menuPath, window.location.origin).toString());
              toast.success("Link do cardápio copiado");
            }}
          >
            <Copy data-icon="inline-start" /> Copiar link
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={menuPath} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink data-icon="inline-start" /> Ver cardápio
          </Button>
          {store.instagramUrl && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Abrir o Instagram da loja"
              nativeButton={false}
              render={<a href={store.instagramUrl} target="_blank" rel="noreferrer" />}
            >
              <Icons.instagram />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function StorePageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

export default function StorePage() {
  const { store: storeId } = useParams<{ store: string }>();
  const { data, isLoading, isFetching } = useGetStoreByIdQuery(storeId);
  const loading = isLoading || (isFetching && !data);
  const [tabParam, setTabParam] = useQueryParam("aba");
  const tab: Tab = isTab(tabParam) ? tabParam : "perfil";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <PageHeader title="Loja" description="Perfil, cardápio, funcionamento e pagamentos da loja." />

      {loading || !data ? (
        <StorePageSkeleton />
      ) : (
        <>
          <StoreSummary store={data} />

          <Tabs key={data.id} value={tab} onValueChange={(value) => setTabParam(value === "perfil" ? null : String(value))} className="gap-4">
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

            {/* Kept mounted: a half-edited form survives switching tabs. */}
            <TabsContent value="perfil" keepMounted className="text-base animate-in fade-in-0 duration-300 ease-out data-[activation-direction=right]:slide-in-from-right-4 data-[activation-direction=left]:slide-in-from-left-4 motion-reduce:animate-none">
              <StoreProfileForm store={data} />
            </TabsContent>
            <TabsContent value="cardapio" keepMounted className="text-base animate-in fade-in-0 duration-300 ease-out data-[activation-direction=right]:slide-in-from-right-4 data-[activation-direction=left]:slide-in-from-left-4 motion-reduce:animate-none">
              <MenuOrder storeId={data.id} />
            </TabsContent>
            <TabsContent value="funcionamento" keepMounted className="flex flex-col gap-4 text-base animate-in fade-in-0 duration-300 ease-out data-[activation-direction=right]:slide-in-from-right-4 data-[activation-direction=left]:slide-in-from-left-4 motion-reduce:animate-none">
              <StoreOperationCard store={data} />
              <OpeningHoursCard store={data} />
            </TabsContent>
            <TabsContent value="pagamentos" keepMounted className="flex flex-col gap-4 text-base animate-in fade-in-0 duration-300 ease-out data-[activation-direction=right]:slide-in-from-right-4 data-[activation-direction=left]:slide-in-from-left-4 motion-reduce:animate-none">
              <PaymentSettingsCard store={data} />
              <CardFeeCard store={data} />
              <PointSettingsCard store={data} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
