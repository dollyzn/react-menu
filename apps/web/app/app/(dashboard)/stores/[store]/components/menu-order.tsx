"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ChevronRight, ImageOff, ListOrdered, MousePointerClick } from "lucide-react";
import { toast } from "sonner";

import {
  useGetCategoriesByStoreIdQuery,
  useReorderCategoriesMutation,
} from "@/redux/features/category/categoryApi";
import {
  useGetItemsByCategoryIdQuery,
  useReorderItemsMutation,
} from "@/redux/features/item/itemApi";
import { storeListPrefetchArg } from "@/redux/api/listQueryParams";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL } from "@/utils/string";
import SortableList from "./sortable-list";
import Image from "@/components/app/image";

const notifyReorderError = () =>
  toast.error("Não foi possível salvar a nova ordem. Ela foi restaurada.", {
    richColors: true,
  });

/**
 * The order of categories and of the products inside each one, as the menu
 * and the POS show them. Wide screens show both lists side by side; phones
 * open a category's products in place of the categories.
 */
export function MenuOrder({ storeId }: { storeId: string }) {
  const [selected, setSelected] = useState<Category | null>(null);
  const base = `/app/stores/${storeId}`;

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card
        className={cn(
          selected
            ? "max-lg:hidden"
            : "max-lg:animate-in max-lg:fade-in-0 max-lg:slide-in-from-left-6 max-lg:duration-300 motion-reduce:animate-none"
        )}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="size-4 text-primary" /> Categorias
          </CardTitle>
          <CardDescription>Arraste pela alça para mudar a ordem. Toque numa categoria para ordenar os produtos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CategoriesOrder storeId={storeId} selectedId={selected?.id ?? null} onOpen={setSelected} />
          <Link href={`${base}/categories`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "self-start")}>
            Criar ou editar categorias <ChevronRight data-icon="inline-end" />
          </Link>
        </CardContent>
      </Card>

      <Card
        className={cn(
          !selected
            ? "max-lg:hidden"
            : "max-lg:animate-in max-lg:fade-in-0 max-lg:slide-in-from-right-6 max-lg:duration-300 motion-reduce:animate-none"
        )}
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            {selected && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Voltar às categorias"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft />
              </Button>
            )}
            <CardTitle className="min-w-0 truncate">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={selected?.id ?? "none"}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  className="block truncate"
                >
                  {selected ? `Produtos de ${selected.name}` : "Produtos"}
                </motion.span>
              </AnimatePresence>
            </CardTitle>
          </div>
          <CardDescription>A ordem em que aparecem dentro da categoria.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {selected ? (
            <>
              {/* A new list per category: its rows come in again. */}
              <ItemsOrder key={selected.id} storeId={storeId} category={selected} />
              <Link href={`${base}/items`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "self-start")}>
                Criar ou editar produtos <ChevronRight data-icon="inline-end" />
              </Link>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed py-14 text-center text-muted-foreground animate-in fade-in-0 duration-300">
              <MousePointerClick className="mb-1 size-6" />
              <p className="text-sm">Escolha uma categoria</p>
              <p className="text-xs">Os produtos dela aparecem aqui para ordenar.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoriesOrder({
  storeId,
  selectedId,
  onOpen,
}: {
  storeId: string;
  selectedId: number | null;
  onOpen: (category: Category) => void;
}) {
  const { data, isLoading } = useGetCategoriesByStoreIdQuery(storeListPrefetchArg(storeId));
  const [reorder, { isLoading: saving }] = useReorderCategoriesMutation();
  const reduce = useReducedMotion();
  const categories = data?.data ?? [];

  if (isLoading) return <ListSkeleton />;
  if (!categories.length)
    return <EmptyList title="Nenhuma categoria" hint="Crie uma categoria para ordená-la aqui." />;

  return (
    <SortableList
      items={categories}
      disabled={saving}
      stagger
      onReorder={(next) =>
        reorder({ storeId, ids: next.map((c) => c.id) })
          .unwrap()
          .catch((error) => {
            notifyReorderError();
            throw error;
          })
      }
      renderRow={(category) => {
        const active = category.id === selectedId;
        return (
          <button
            type="button"
            onClick={() => onOpen(category)}
            aria-current={active || undefined}
            className={cn(
              "relative flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "text-primary" : "hover:text-primary"
            )}
          >
            {/* The highlight moves from the last category to this one. */}
            {active && (
              <motion.span
                layoutId={`menu-order-active-${storeId}`}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                className="absolute inset-0 -z-0 rounded-md bg-primary/10"
                aria-hidden
              />
            )}
            <span className="relative truncate font-medium">{category.name}</span>
            <span className="relative flex shrink-0 items-center gap-2 text-muted-foreground">
              <Badge variant={active ? "default" : "secondary"}>
                {category.itemsCount ?? 0} {category.itemsCount === 1 ? "produto" : "produtos"}
              </Badge>
              <ChevronRight className="size-4" />
            </span>
          </button>
        );
      }}
    />
  );
}

function ItemsOrder({ storeId, category }: { storeId: string; category: Category }) {
  const { data: items = [], isLoading } = useGetItemsByCategoryIdQuery({
    storeId,
    categoryId: category.id,
  });
  const [reorder, { isLoading: saving }] = useReorderItemsMutation();

  if (isLoading) return <ListSkeleton thumbnails />;
  if (!items.length)
    return <EmptyList title="Nenhum produto" hint="Adicione produtos a esta categoria." />;

  return (
    <SortableList
      items={items}
      disabled={saving}
      stagger
      onReorder={(next) =>
        reorder({ storeId, categoryId: category.id, ids: next.map((i) => i.id) })
          .unwrap()
          .catch((error) => {
            notifyReorderError();
            throw error;
          })
      }
      renderRow={(item) => (
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          {item.photoUrl ? (
            <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">
              <Image src={item.photoUrl} blurDataURL={item.photoBlur} alt="" fill sizes="36px" className="object-cover" />
            </span>
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <ImageOff className="size-4" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {formatCurrencyBRL(item.price)}
          </span>
        </div>
      )}
    />
  );
}

/** Rows shaped like the list they stand for (handle, photo, name, price), fading down. */
function ListSkeleton({ thumbnails }: { thumbnails?: boolean }) {
  return (
    <div className="flex flex-col gap-2" aria-busy aria-label="Carregando">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex h-13 items-center gap-3 rounded-lg border p-2 pr-3"
          style={{ opacity: 1 - i * 0.16 }}
        >
          <Skeleton className="size-6 rounded-md" />
          {thumbnails && <Skeleton className="size-9 rounded-md" />}
          <Skeleton className="h-4 flex-1" style={{ maxWidth: `${70 - ((i * 13) % 30)}%` }} />
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

function EmptyList({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-14 text-center text-muted-foreground animate-in fade-in-0 duration-300">
      <AlertCircle className="mb-1 size-6" />
      <p className="text-sm">{title}</p>
      <p className="text-xs">{hint}</p>
    </div>
  );
}
