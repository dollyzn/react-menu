import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { indexByCategory } from "@/redux/slices/item";
import { updateOrder } from "@/redux/slices/category";
import { updateOrder as updateItemOrder } from "@/redux/slices/item";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import SortableList from "./sortable-list";

import { toast } from "sonner";

export function SortingTabs() {
  const dispatch = useDispatch<AppDispatch>();

  const categoriesLoading = useSelector(
    (state: RootState) => state.category.loading
  );
  const categories = useSelector((state: RootState) => state.category.data);
  const updateCategoryOrderLoading = useSelector(
    (state: RootState) => state.category.updateOrder.loading
  );
  const indexByCategoryLoading = useSelector(
    (state: RootState) => state.item.indexByCategory.loading
  );

  const [activeTab, setActiveTab] = useState<string>("categories");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );

  const handleCategoryClick = async (item: Category) => {
    const result = await dispatch(indexByCategory(item.id));
    if (indexByCategory.fulfilled.match(result)) {
      setSelectedCategory({ ...item, items: result.payload });
      setActiveTab("items");
    }

    if (indexByCategory.rejected.match(result)) {
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
    dispatch(updateOrder(newOrder));
  };

  const handleItemOrderChange = (newOrder: { id: number; order: number }) => {
    dispatch(updateItemOrder(newOrder));
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
      {categoriesLoading ? (
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
