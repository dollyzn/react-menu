"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useGetCategoriesByStoreIdQuery,
  useUpdateCategoryOrderMutation,
} from "@/redux/features/category/categoryApi";
import {
  useLazyGetItemsByCategoryIdQuery,
  useUpdateItemOrderMutation,
} from "@/redux/features/item/itemApi";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import SortableList from "./sortable-list";

import { toast } from "sonner";

export function SortingTabs() {
  const { store } = useParams();
  const storeId = store as string;

  const { data: categories = null, isLoading: categoriesLoading } =
    useGetCategoriesByStoreIdQuery(storeId);
  const [updateCategoryOrder, { isLoading: updateCategoryOrderLoading }] =
    useUpdateCategoryOrderMutation();
  const [fetchItemsByCategory, { isFetching: indexByCategoryLoading }] =
    useLazyGetItemsByCategoryIdQuery();
  const [updateItemOrder] = useUpdateItemOrderMutation();

  const [activeTab, setActiveTab] = useState<string>("categories");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );

  const handleCategoryClick = async (item: Category) => {
    try {
      const result = await fetchItemsByCategory(item.id).unwrap();
      setSelectedCategory({ ...item, items: result });
      setActiveTab("items");
    } catch {
      toast.error(
        `Ocorreu um erro ao recuperar os itens da categoria ${item.name}`,
        {
          richColors: true,
          closeButton: true,
        }
      );
    }
  };

  const handleBack = () => {
    setSelectedCategory(null);
    setActiveTab("categories");
  };

  const handleCategoryOrderChange = (newOrder: {
    id: number;
    order: number;
  }) => {
    updateCategoryOrder({
      storeId,
      id: newOrder.id,
      order: newOrder.order,
    });
  };

  const handleItemOrderChange = (newOrder: {
    id: number;
    order: number;
  }) => {
    if (!selectedCategory) return;
    updateItemOrder({
      categoryId: selectedCategory.id,
      id: newOrder.id,
      order: newOrder.order,
    });
  };

  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList className="w-full cursor-not-allowed">
        <TabsTrigger value="categories" className="flex-1 cursor-not-allowed">
          Categorias
        </TabsTrigger>
        <TabsTrigger value="items" className="flex-1 cursor-not-allowed ">
          Produtos
        </TabsTrigger>
      </TabsList>
      {categoriesLoading && !categories ? (
        <TabsContent value="categories">
          <ScrollArea className="h-[258px] pr-4 pb-0 mb-6 md:mb-0 pt-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="w-full h-[62px] mb-2" />
            ))}
          </ScrollArea>
        </TabsContent>
      ) : (
        <TabsContent value="categories">
          <ScrollArea className="h-[258px] pr-4 pb-0 mb-6 md:mb-0 pt-1">
            {categories && !!categories.length ? (
              <SortableList
                items={categories}
                itemButton={
                  <Button variant="ghost" disabled={indexByCategoryLoading}>
                    Ver produtos
                  </Button>
                }
                disabled={updateCategoryOrderLoading}
                onOrderChange={(newOrder) =>
                  handleCategoryOrderChange({
                    id: newOrder.item.id as number,
                    order: newOrder.newIndex,
                  })
                }
                onItemClick={(item) => handleCategoryClick(item as Category)}
              />
            ) : (
              <div className="text-muted-foreground text-center mt-16">
                <div className="flex flex-col items-center">
                  <AlertCircle className="w-6 h-6 mb-2 text-muted-foreground" />
                  <p className="text-sm">Nenhuma categoria encontrada.</p>
                  <p className="text-xs">
                    Adicione uma nova categoria e ela aparecerá aqui.
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      )}
      <TabsContent value="items">
        <ScrollArea className="h-[258px] pr-4 py-0">
          <div className="flex items-center justify-between pb-2 sticky top-0 bg-background z-20">
            <CardTitle>{selectedCategory?.name}</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>
          </div>

          {selectedCategory &&
          selectedCategory.items &&
          !!selectedCategory.items.length ? (
            <SortableList
              items={selectedCategory.items}
              onOrderChange={(newOrder) =>
                handleItemOrderChange({
                  id: newOrder.item.id as number,
                  order: newOrder.newIndex,
                })
              }
            />
          ) : (
            <div className="text-muted-foreground text-center mt-14">
              <div className="flex flex-col items-center">
                <AlertCircle className="w-6 h-6 mb-2 text-muted-foreground" />
                <p className="text-sm">Nenhum produto encontrado.</p>
                <p className="text-xs">
                  Adicione uma novo item a esta categoria e ele aparecerá aqui.
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
