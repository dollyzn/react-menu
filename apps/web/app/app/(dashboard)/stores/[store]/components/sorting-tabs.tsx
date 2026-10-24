"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, ArrowLeft, ChevronRight, ImageOff } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/utils/string";
import SortableList from "./sortable-list";

const notifyReorderError = () =>
  toast.error("Não foi possível salvar a nova ordem. Ela foi restaurada.", {
    richColors: true,
  });

export function SortingTabs() {
  const { store } = useParams();
  const storeId = store as string;
  const [selected, setSelected] = useState<Category | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-9 items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {selected ? (
            <>
              Produtos de <span className="font-medium text-foreground">{selected.name}</span>
            </>
          ) : (
            "Arraste para definir a ordem das categorias no cardápio."
          )}
        </p>
        {selected && (
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft /> Categorias
          </Button>
        )}
      </div>

      {/* Radix wraps the content in a display:table div sized by its content: make it a block so long names truncate. */}
      <ScrollArea className="h-72 pr-3 [&_[data-slot=scroll-area-viewport]>div]:block!">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selected ? `items-${selected.id}` : "categories"}
            initial={{ opacity: 0, x: selected ? 16 : -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: selected ? -16 : 16 }}
            transition={{ duration: 0.15 }}
          >
            {selected ? (
              <ItemsOrder storeId={storeId} category={selected} />
            ) : (
              <CategoriesOrder storeId={storeId} onOpen={setSelected} />
            )}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}

function CategoriesOrder({
  storeId,
  onOpen,
}: {
  storeId: string;
  onOpen: (category: Category) => void;
}) {
  const { data, isLoading } = useGetCategoriesByStoreIdQuery(storeListPrefetchArg(storeId));
  const [reorder, { isLoading: saving }] = useReorderCategoriesMutation();
  const categories = data?.data ?? [];

  if (isLoading) return <ListSkeleton />;
  if (!categories.length)
    return <EmptyList title="Nenhuma categoria" hint="Crie uma categoria para ordená-la aqui." />;

  return (
    <SortableList
      items={categories}
      disabled={saving}
      onReorder={(next) =>
        reorder({ storeId, ids: next.map((c) => c.id) })
          .unwrap()
          .catch((error) => {
            notifyReorderError();
            throw error;
          })
      }
      renderRow={(category) => (
        <button
          type="button"
          onClick={() => onOpen(category)}
          className="flex flex-1 items-center justify-between gap-2 rounded-md py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="truncate font-medium">{category.name}</span>
          <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
            <Badge variant="secondary">
              {category.itemsCount ?? 0} {category.itemsCount === 1 ? "produto" : "produtos"}
            </Badge>
            <ChevronRight className="size-4" />
          </span>
        </button>
      )}
    />
  );
}

function ItemsOrder({ storeId, category }: { storeId: string; category: Category }) {
  const { data: items = [], isLoading } = useGetItemsByCategoryIdQuery({
    storeId,
    categoryId: category.id,
  });
  const [reorder, { isLoading: saving }] = useReorderItemsMutation();

  if (isLoading) return <ListSkeleton />;
  if (!items.length)
    return <EmptyList title="Nenhum produto" hint="Adicione produtos a esta categoria." />;

  return (
    <SortableList
      items={items}
      disabled={saving}
      onReorder={(next) =>
        reorder({ storeId, categoryId: category.id, ids: next.map((i) => i.id) })
          .unwrap()
          .catch((error) => {
            notifyReorderError();
            throw error;
          })
      }
      renderRow={(item) => (
        <div className="flex flex-1 items-center gap-3 overflow-hidden">
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote menu photos of any host
            <img
              src={item.photoUrl}
              alt=""
              className="size-9 shrink-0 rounded-md object-cover"
              loading="lazy"
            />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <ImageOff className="size-4" />
            </span>
          )}
          <span className="flex-1 truncate font-medium">{item.name}</span>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {formatCurrencyBRL(item.price)}
          </span>
        </div>
      )}
    />
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-busy>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-13 w-full" />
      ))}
    </div>
  );
}

function EmptyList({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-14 text-center text-muted-foreground">
      <AlertCircle className="mb-1 size-6" />
      <p className="text-sm">{title}</p>
      <p className="text-xs">{hint}</p>
    </div>
  );
}
