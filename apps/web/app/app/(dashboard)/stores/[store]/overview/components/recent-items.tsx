"use client";

import { useGetStoreRecentItemsQuery } from "@/redux/features/store/storeApi";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyBRL } from "@/utils/string";

interface RecentItemsProps {
  storeId: string;
}

export function RecentItems({ storeId }: RecentItemsProps) {
  const { data: items, isLoading, isFetching } =
    useGetStoreRecentItemsQuery(storeId);
  const loading = isLoading || (isFetching && !items);

  const getAvatarFallback = (item: Item) => {
    const categoryName = item.category?.name || "";
    const name = item.name || "";

    const categoryInitial = categoryName[0] || "";
    const nameInitial =
      categoryName.split(" ")[1]?.[0] || categoryName[1] || name[0] || "";

    return `${categoryInitial}${nameInitial}`.toUpperCase();
  };

  return (
    <ScrollArea className="h-[400px] p-6 pt-0 pb-4">
      {loading && !items ? (
        <div className="space-y-8">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="flex items-center">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="ml-4 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {items?.map((item) => (
            <div key={item.id} className="flex items-center">
              <Avatar className="h-9 w-9">
                <AvatarImage src={item.photoUrl || undefined} alt={item.name} />
                <AvatarFallback>{getAvatarFallback(item)}</AvatarFallback>
              </Avatar>
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium leading-none">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.category?.name}
                </p>
              </div>
              <div className="ml-auto font-medium">
                {formatCurrencyBRL(item.price)}
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
