"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, LayoutGrid, ListChecks, MousePointerClick, SearchX, UtensilsCrossed } from "lucide-react";
import type { PartnerCatalogMode, PublicMenuCategory, StorePartner } from "@react-menu/contracts";
import Image from "@/components/app/image";
import { SearchInput } from "@/components/app/search-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSetPartnerCatalogMutation } from "@/redux/features/partner/partnersApi";
import { useGetPublicMenuQuery } from "@/redux/features/public/publicApi";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import { formatCurrencyBRL, normalizeSearch } from "@/utils/string";

const MODES: { value: PartnerCatalogMode; title: string; description: string; icon: typeof LayoutGrid }[] = [
  { value: "all", title: "O cardápio todo", description: "Tudo o que a loja vende, inclusive o que entrar depois.", icon: LayoutGrid },
  {
    value: "selected",
    title: "Só algumas categorias",
    description: "Escolha as categorias; dentro delas, tire os itens que não quiser.",
    icon: ListChecks,
  },
];

const sameSet = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((value) => b.includes(value));

/**
 * What the partner may sell (ADR 0024), laid out like the store's menu
 * order: categories on the left (on or off, how many items go), the chosen
 * category's items on the right (one column at a time on phones). New items
 * of a category that is on go in by themselves; the API checks every order.
 */
export function CatalogEditor({ storeId, partner }: { storeId: string; partner: StorePartner }) {
  const { data: store } = useGetStoreByIdQuery(storeId);
  const { data: menu } = useGetPublicMenuQuery({ slug: store?.slug, preview: true }, { skip: !store });
  const [mode, setMode] = useState<PartnerCatalogMode>(partner.catalogMode);
  const [categoryIds, setCategoryIds] = useState<number[]>(partner.categoryIds);
  const [excluded, setExcluded] = useState<string[]>(partner.excludedItemIds);
  const [openId, setOpenId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [save, { isLoading }] = useSetPartnerCatalogMutation();

  const dirty =
    mode !== partner.catalogMode ||
    (mode === "selected" && (!sameSet(categoryIds, partner.categoryIds) || !sameSet(excluded, partner.excludedItemIds)));
  const reset = () => {
    setMode(partner.catalogMode);
    setCategoryIds(partner.categoryIds);
    setExcluded(partner.excludedItemIds);
  };

  const categories = useMemo(() => menu?.categories ?? [], [menu]);
  const open = categories.find((category) => category.id === openId) ?? null;
  const toggleCategory = (category: PublicMenuCategory, on: boolean) => {
    setCategoryIds((ids) => (on ? [...ids, category.id] : ids.filter((id) => id !== category.id)));
    if (on) setOpenId(category.id);
  };
  const sold = (category: PublicMenuCategory) =>
    categoryIds.includes(category.id) ? category.items.filter((item) => !excluded.includes(item.id)).length : 0;
  const selling = categories.reduce((sum, category) => sum + sold(category), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>O que o parceiro pode vender</CardTitle>
        <CardDescription>A loja confere cada venda: um item fora daqui é recusado.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RadioGroup
          name="catalog-mode"
          value={mode}
          onValueChange={(value) => setMode(value as PartnerCatalogMode)}
          className="grid gap-3 sm:grid-cols-2"
        >
          {MODES.map((option) => {
            const Icon = option.icon;
            return (
              <FieldLabel key={option.value} htmlFor={`catalog-${option.value}`}>
                <Field orientation="horizontal">
                  <Icon className="size-4 shrink-0 self-start text-primary" />
                  <FieldContent>
                    <FieldTitle>{option.title}</FieldTitle>
                    <FieldDescription>{option.description}</FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value={option.value} id={`catalog-${option.value}`} />
                </Field>
              </FieldLabel>
            );
          })}
        </RadioGroup>

        {mode === "selected" &&
          (!menu ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-72 rounded-xl" />
              <Skeleton className="h-72 rounded-xl max-lg:hidden" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <section
                aria-labelledby="catalog-categories"
                className={cn("flex flex-col gap-2 rounded-xl border p-3", open && "max-lg:hidden")}
              >
                <h3 id="catalog-categories" className="flex items-center justify-between text-sm font-semibold">
                  Categorias
                  <span className="font-normal text-muted-foreground tabular-nums">
                    {selling} {selling === 1 ? "item liberado" : "itens liberados"}
                  </span>
                </h3>
                <ul className="flex flex-col gap-1">
                  {categories.map((category) => {
                    const on = categoryIds.includes(category.id);
                    return (
                      <li
                        key={category.id}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors",
                          openId === category.id ? "bg-primary/10" : "hover:bg-muted/60"
                        )}
                      >
                        <Switch
                          checked={on}
                          onCheckedChange={(checked) => toggleCategory(category, checked)}
                          aria-label={`Liberar ${category.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => setOpenId(category.id)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <span className={cn("truncate text-sm font-medium", !on && "text-muted-foreground")}>
                            {category.name}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                            {on ? `${sold(category)} de ${category.items.length}` : "Fora"}
                            <ChevronRight className="size-4" />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section
                aria-labelledby="catalog-items"
                className={cn("flex flex-col gap-3 rounded-xl border p-3", !open && "max-lg:hidden")}
              >
                {open ? (
                  <CategoryItems
                    key={open.id}
                    category={open}
                    on={categoryIds.includes(open.id)}
                    excluded={excluded}
                    query={query}
                    onQuery={setQuery}
                    onBack={() => setOpenId(null)}
                    onTurnOn={() => toggleCategory(open, true)}
                    onToggle={(ids, sell) =>
                      setExcluded((list) => (sell ? list.filter((id) => !ids.includes(id)) : [...new Set([...list, ...ids])]))
                    }
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed py-14 text-center text-muted-foreground">
                    <MousePointerClick className="mb-1 size-6" />
                    <p id="catalog-items" className="text-sm">
                      Escolha uma categoria
                    </p>
                    <p className="text-xs">Os itens dela aparecem aqui para tirar o que não quiser.</p>
                  </div>
                )}
              </section>
            </div>
          ))}

      </CardContent>
      {/* Stays in reach while the lists scroll (the page's bottom on phones). */}
      <CardFooter className="sticky bottom-0 z-10 justify-end gap-2 border-t bg-card">
          <span className="mr-auto text-xs text-muted-foreground" aria-live="polite">
            {dirty ? "Alterações não salvas" : ""}
          </span>
          <Button variant="outline" disabled={!dirty || isLoading} onClick={reset}>
            Desfazer alterações
          </Button>
          <Button
            loading={isLoading}
            disabled={!dirty || (mode === "selected" && categoryIds.length === 0)}
            onClick={async () => {
              const selected = mode === "selected";
              await save({
                storeId,
                partnerId: partner.id,
                input: {
                  mode,
                  categoryIds: selected ? categoryIds : [],
                  // Only items of categories on (a category off takes its exclusions with it).
                  excludedItemIds: selected
                    ? excluded.filter((id) =>
                        categories.some((category) => categoryIds.includes(category.id) && category.items.some((item) => item.id === id))
                      )
                    : [],
                },
              }).unwrap();
              toast.success("Cardápio do parceiro salvo");
            }}
          >
            Salvar cardápio
          </Button>
      </CardFooter>
    </Card>
  );
}

function CategoryItems({
  category,
  on,
  excluded,
  query,
  onQuery,
  onBack,
  onTurnOn,
  onToggle,
}: {
  category: PublicMenuCategory;
  on: boolean;
  excluded: string[];
  query: string;
  onQuery: (value: string) => void;
  onBack: () => void;
  onTurnOn: () => void;
  onToggle: (itemIds: string[], sell: boolean) => void;
}) {
  const term = normalizeSearch(query);
  const items = category.items.filter((item) => !term || normalizeSearch(item.name).includes(term));
  const selling = category.items.filter((item) => !excluded.includes(item.id)).length;
  const all = selling === category.items.length;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Voltar às categorias" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <h3 id="catalog-items" className="min-w-0 flex-1 truncate text-sm font-semibold">
          Itens de {category.name}
        </h3>
        {on && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={all}
              indeterminate={!all && selling > 0}
              onCheckedChange={(checked) => onToggle(category.items.map((item) => item.id), Boolean(checked))}
            />
            Marcar todos
          </label>
        )}
      </div>
      {!on ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
          <p className="text-sm text-muted-foreground">Esta categoria está fora do cardápio do parceiro.</p>
          <Button size="sm" variant="outline" onClick={onTurnOn}>
            Liberar {category.name}
          </Button>
        </div>
      ) : (
        <>
          {category.items.length > 6 && (
            <SearchInput value={query} onValueChange={onQuery} placeholder="Buscar item" aria-label="Buscar item" />
          )}
          {items.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <SearchX className="size-4" /> Nenhum item encontrado.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const sells = !excluded.includes(item.id);
                return (
                  <li key={item.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60",
                        !sells && "opacity-60"
                      )}
                    >
                      <Checkbox checked={sells} onCheckedChange={(checked) => onToggle([item.id], Boolean(checked))} />
                      <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                        {item.photoUrl ? (
                          <Image src={item.photoUrl} blurDataURL={item.photoBlur} alt="" fill sizes="36px" className="object-cover" />
                        ) : (
                          <UtensilsCrossed className="absolute inset-0 m-auto size-4 text-muted-foreground/50" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">{formatCurrencyBRL(item.price)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}
