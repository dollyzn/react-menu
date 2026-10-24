"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Boxes,
  ChartNoAxesColumn,
  Copy,
  Globe,
  ImageIcon,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Package,
  Pencil,
} from "lucide-react";
import Image from "@/components/app/image";
import { Icons } from "@/components/app/icons";
import { PageHeader } from "@/components/app/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import { copyToClipboard } from "@/utils/copy-to-clipboard";
import { EditStoreDialog } from "./components/edit-store-dialog";
import { OpeningHoursCard } from "./components/opening-hours-card";
import { PaymentSettingsCard } from "./components/payment-settings-card";
import { CommentRatings } from "./components/rating";
import { SortingTabs } from "./components/sorting-tabs";
import { StoreStatusDropdown } from "./components/store-status-dropdown";
import { UpdateBannerDialog } from "./components/update-banner-dialog";
import { UpdatePhotoDialog } from "./components/update-photo-dialog";

/** A store link (menu, Instagram, iFood): copies it; muted text when not set. */
function StoreLink({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Absolute URL, or a path on this site ("/jj-pasteis"); null = not set yet. */
  value: string | null;
}) {
  if (!value) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label} não definido
      </span>
    );
  }
  return (
    <Button
      variant="ghost"
      size="xs"
      className="text-muted-foreground"
      aria-label={`Copiar link do ${label}`}
      onClick={() => {
        // Resolved on click: the server render has no window.
        copyToClipboard(new URL(value, window.location.origin).toString());
        toast.success(`Link do ${label} copiado`);
      }}
    >
      <Icon />
      {label}
      <Copy className="opacity-60" />
    </Button>
  );
}

function StoreInfoSkeleton() {
  return (
    <CardContent className="flex flex-col gap-4">
      <Skeleton className="h-48 w-full rounded-lg" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-20 rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    </CardContent>
  );
}

export default function Store() {
  const { store } = useParams();
  const storeId = store as string;
  const base = `/app/stores/${storeId}`;
  const { data, isLoading, isFetching } = useGetStoreByIdQuery(storeId);
  const loading = isLoading || (isFetching && !data);
  const [editOpen, setEditOpen] = useState(false);

  const shortcuts = [
    { label: "Visão geral", href: `${base}/overview`, icon: LayoutDashboard },
    { label: "Relatórios", href: `${base}/reports`, icon: ChartNoAxesColumn },
    { label: "Itens", href: `${base}/items`, icon: Package },
    { label: "Grupos de escolha", href: `${base}/option-groups`, icon: ListChecks },
    { label: "Estoque", href: `${base}/inventory`, icon: Boxes },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title="Loja" description="Informações, imagens, pagamentos e a ordem das categorias no cardápio." />

      <nav aria-label="Atalhos" className="flex flex-wrap gap-2">
        {shortcuts.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Icon data-icon="inline-start" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informações básicas</CardTitle>
            <CardDescription>Nome, endereço, imagens e links da loja</CardDescription>
            {data && (
              <CardAction>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil data-icon="inline-start" />
                  Editar
                </Button>
              </CardAction>
            )}
          </CardHeader>
          {loading || !data ? (
            <StoreInfoSkeleton />
          ) : (
            <CardContent className="flex flex-col gap-4">
              <div className="relative h-48 w-full overflow-hidden rounded-lg">
                {data.bannerUrl ? (
                  <Image src={data.bannerUrl} alt={data.name} fill sizes="685px" className="object-cover" priority />
                ) : (
                  <div className="flex size-full items-center justify-center rounded-lg border text-sm text-muted-foreground">
                    Nenhum banner definido
                  </div>
                )}
                <UpdateBannerDialog storeId={data.id} />
              </div>

              <div className="flex min-w-0 items-center gap-4">
                <div className="relative size-20 shrink-0">
                  {data.photoUrl ? (
                    <Image src={data.photoUrl} alt={data.name} fill sizes="80px" className="rounded-lg object-contain" />
                  ) : (
                    <ImageIcon strokeWidth={0.5} className="size-full text-muted-foreground" />
                  )}
                  <UpdatePhotoDialog storeId={data.id} />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-bold">{data.name}</h2>
                    <StoreStatusDropdown store={data} />
                  </div>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-4 shrink-0" />
                    <span className="truncate">{data.address || "Endereço não definido"}</span>
                  </p>
                  <CommentRatings rating={5} totalStars={5} size={18} variant="yellow" precision={0.1} />
                </div>
              </div>

              <Separator />
              <div className="flex flex-wrap gap-1">
                <StoreLink icon={Globe} label="cardápio" value={`/${data.slug}`} />
                <StoreLink icon={Icons.instagram} label="Instagram" value={data.instagramUrl} />
                <StoreLink icon={Icons.ifood} label="iFood" value={data.ifoodUrl} />
              </div>
              <EditStoreDialog data={data} open={editOpen} toggle={() => setEditOpen((open) => !open)} />
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categorias e produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <SortingTabs />
          </CardContent>
        </Card>
      </div>

      {data && <OpeningHoursCard key={data.updatedAt} store={data} />}
      {data && <PaymentSettingsCard store={data} />}
    </div>
  );
}
