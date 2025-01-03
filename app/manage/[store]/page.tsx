"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { useStoreSocket } from "@/hooks/socket";

import { show } from "@/redux/slices/store";
import { index, updateOrder } from "@/redux/slices/category";
import {
  indexByCategory,
  updateOrder as updateItemOrder,
} from "@/redux/slices/item";

import {
  AlertCircle,
  ArrowLeft,
  FolderTree,
  Globe,
  ImageIcon,
  LayoutDashboard,
  MapPin,
  Package,
  PlusCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StoreStatusDropdown } from "./components/store-status-dropdown";
import { UpdateBannerDialog } from "./components/update-banner-dialog";
import { UpdatePhotoDialog } from "./components/update-photo-dialog";
import { EditStoreDialog } from "./components/edit-store-dialog";
import { CommentRatings } from "./components/rating";
import SortableList from "./components/sortable-list";
import Image from "next/image";

import { copyToClipboard } from "@/utils/copy-to-clipboard";
import { toast } from "sonner";

export default function Store() {
  const { store } = useParams();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  useStoreSocket(store as string);

  useEffect(() => {
    dispatch(show(store as string));
    dispatch(index(store as string));
  }, [dispatch, store]);

  const loading = useSelector((state: RootState) => state.store.show.loading);
  const data = useSelector((state: RootState) => state.store.show.data);
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

  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("categories");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );

  const handleToggleEditModal = () => setEditModalOpen(!editModalOpen);

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
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Loja</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>
              Gerencie as informações principais da loja
            </CardDescription>
          </CardHeader>
          {loading || !data ? (
            <CardContent className="space-y-3">
              <div className="relative h-[190px] md:h-[190px] w-full rounded-lg overflow-hidden">
                <Skeleton className="w-full h-full flex items-center justify-center border rounded-lg text-muted-foreground" />
              </div>

              <div className="flex items-center gap-4">
                <div className="relative w-[90px] h-[90px] ">
                  <Skeleton className="w-full h-full  text-muted-foreground" />
                </div>

                <div className="flex gap-2 flex-col">
                  <Dialog>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-[180px] h-[20px]" />
                      </div>

                      <Skeleton className="w-[220px] h-[14px]" />
                    </div>
                  </Dialog>
                  <Skeleton className="w-[96px] h-[20px] my-0.5" />
                  <Skeleton className="w-[138px] h-[14px]" />
                </div>
              </div>
            </CardContent>
          ) : (
            <CardContent className="space-y-3">
              <div className="relative h-[190px] md:h-[190px] w-full rounded-lg overflow-hidden">
                {data.bannerUrl ? (
                  <Image
                    src={data?.bannerUrl}
                    alt={data.name}
                    fill
                    sizes="685px"
                    className="w-full h-auto object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center border rounded-lg text-muted-foreground">
                    Nenhum banner definido
                  </div>
                )}
                <UpdateBannerDialog storeId={data.id} />
              </div>

              <div className="flex justify-between items-stretch">
                <div className="flex items-center gap-6">
                  <div className="relative w-[90px] h-[90px] ">
                    {data.photoUrl ? (
                      <Image
                        src={data.photoUrl}
                        alt={data.name}
                        width={90}
                        height={90}
                        className="w-full h-full rounded-lg object-contain"
                      />
                    ) : (
                      <ImageIcon
                        strokeWidth={0.5}
                        className="w-full h-full  text-muted-foreground"
                      />
                    )}

                    <UpdatePhotoDialog storeId={data.id} />
                  </div>

                  <div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <div className="h-auto font-bold text-xl">
                          {data.name}
                        </div>
                        <StoreStatusDropdown
                          storeId={data.id}
                          status={data.status}
                        />
                      </div>
                      <div className="text-sm h-auto flex items-center text-muted-foreground gap-1">
                        <MapPin className="h-4 w-4" />
                        {data.address ? data.address : "Endereço não definido"}
                      </div>
                    </div>
                    <div className="mt-2">
                      <CommentRatings
                        rating={5}
                        totalStars={5}
                        size={18}
                        variant="yellow"
                        precision={0.1}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 justify-between">
                  <TooltipProvider>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <Tooltip>
                        <TooltipTrigger
                          asChild
                          onClick={() =>
                            copyToClipboard(
                              `${window.location.origin}/${data.slug}`
                            )
                          }
                        >
                          <div className="flex items-center justify-end gap-2 cursor-pointer">
                            {data.slug}
                            <Globe size={13} />
                          </div>
                        </TooltipTrigger>

                        <TooltipContent side="bottom">
                          Clique para copiar
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger
                          asChild
                          onClick={() =>
                            copyToClipboard(
                              data.instagramUrl || "https://www.instagram.com"
                            )
                          }
                        >
                          <div className="flex items-center justify-end gap-2 cursor-pointer">
                            {data.instagramUrl
                              ? data.instagramUrl.split("/").pop()
                              : "Instagram não definido"}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-instagram"
                            >
                              <rect
                                width="20"
                                height="20"
                                x="2"
                                y="2"
                                rx="5"
                                ry="5"
                              />
                              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                            </svg>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Clique para copiar
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger
                          asChild
                          onClick={() =>
                            copyToClipboard(
                              data.ifoodUrl || "https://www.ifood.com.br"
                            )
                          }
                        >
                          <div className="flex items-center justify-end gap-2 cursor-pointer">
                            {data.ifoodUrl
                              ? "ifood.com.br"
                              : "IFood não definido"}
                            <svg
                              width="13px"
                              height="13px"
                              viewBox="0 0 24 24"
                              role="img"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="currentColor"
                            >
                              <path d="M8.428 1.67c-4.65 0-7.184 4.149-7.184 6.998 0 2.294 2.2 3.299 4.25 3.299l-.006-.006c4.244 0 7.184-3.854 7.184-6.998 0-2.29-2.175-3.293-4.244-3.293zm11.328 0c-4.65 0-7.184 4.149-7.184 6.998 0 2.294 2.2 3.299 4.25 3.299l-.006-.006C21.061 11.96 24 8.107 24 4.963c0-2.29-2.18-3.293-4.244-3.293zM14.172 14.52l2.435 1.834c-2.17 2.07-6.124 3.525-9.353 3.17A8.913 8.913 0 01.23 14.541H0a9.598 9.598 0 008.828 7.758c3.814.24 7.323-.905 9.947-3.13l-.004.007 1.08 2.988 1.555-7.623-7.234-.02Z" />
                            </svg>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Clique para copiar
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleToggleEditModal}
                  >
                    Editar Informações
                  </Button>

                  <EditStoreDialog
                    data={data}
                    open={editModalOpen}
                    toggle={handleToggleEditModal}
                  />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categorias e Produtos</CardTitle>
            <CardDescription>
              Organize e ordene as categorias e produtos
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-0">
            <Tabs value={activeTab} className="w-full">
              <TabsList className="w-full cursor-not-allowed">
                <TabsTrigger
                  value="categories"
                  className="flex-1 cursor-not-allowed"
                >
                  Categorias
                </TabsTrigger>
                <TabsTrigger
                  value="items"
                  className="flex-1 cursor-not-allowed "
                >
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
                          <Button
                            variant="ghost"
                            disabled={indexByCategoryLoading}
                          >
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
                        onItemClick={(item) =>
                          handleCategoryClick(item as Category)
                        }
                      />
                    ) : (
                      <div className="text-muted-foreground text-center mt-16">
                        <div className="flex flex-col items-center">
                          <AlertCircle className="w-6 h-6 mb-2 text-muted-foreground" />
                          <p className="text-sm">
                            Nenhuma categoria encontrada.
                          </p>
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
                          Adicione uma novo item a esta categoria e ele
                          aparecerá aqui.
                        </p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Acessos Rápidos</CardTitle>
          <CardDescription>
            Acesse rapidamente outras seções importantes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              className="h-24 flex flex-col items-center justify-center"
              onClick={() => router.push(`/manage/${store}/overview`)}
            >
              <LayoutDashboard className="w-6 h-6 mb-2" />
              Visão Geral
            </Button>
            <Button
              className="h-24 flex flex-col items-center justify-center"
              onClick={() => router.push(`/manage/${store}/categories`)}
            >
              <FolderTree className="w-6 h-6 mb-2" />
              Categorias
            </Button>
            <Button
              className="h-24 flex flex-col items-center justify-center"
              onClick={() => router.push(`/manage/${store}/items`)}
            >
              <Package className="w-6 h-6 mb-2" />
              Items
            </Button>
            <Button
              className="h-24 flex flex-col items-center justify-center"
              onClick={() => router.push(`/manage/${store}/addons`)}
            >
              <PlusCircle className="w-6 h-6 mb-2" />
              Adicionais
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
