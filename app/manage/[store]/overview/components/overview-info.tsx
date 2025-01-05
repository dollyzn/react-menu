import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";

import { overview } from "@/redux/slices/store";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface OverviewInfoProps {
  className?: string;
  storeId: string;
}

export function OverviewInfo({ className, storeId }: OverviewInfoProps) {
  const dispatch = useDispatch<AppDispatch>();

  const loading = useSelector(
    (state: RootState) => state.store.dashboard.overview.loading
  );
  const data = useSelector(
    (state: RootState) => state.store.dashboard.overview.data
  );

  const { accesses, categories, items, addons } = data || {};

  useEffect(() => {
    dispatch(overview(storeId));
  }, [dispatch, storeId]);

  return (
    <div className={className}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Acessos</CardTitle>
        </CardHeader>
        <CardContent>
          {(loading && !data) || !accesses ? (
            <>
              <Skeleton className="w-14 h-6" />
              <Skeleton className="w-40 h-4 mt-2" />
            </>
          ) : (
            <>
              <div className="text-2xl font-bold">{accesses.total}</div>
              <p className="text-xs text-muted-foreground">
                {accesses.message}
              </p>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Categorias</CardTitle>
        </CardHeader>
        <CardContent>
          {(loading && !data) || !categories ? (
            <>
              <Skeleton className="w-11 h-6" />
              <Skeleton className="w-40 h-4 mt-2" />
            </>
          ) : (
            <>
              <div className="text-2xl font-bold">{categories.total}</div>
              <p className="text-xs text-muted-foreground">
                {categories.message}
              </p>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Items</CardTitle>
        </CardHeader>
        <CardContent>
          {(loading && !data) || !items ? (
            <>
              <Skeleton className="w-12 h-6" />
              <Skeleton className="w-40 h-4 mt-2" />
            </>
          ) : (
            <>
              <div className="text-2xl font-bold">{items.total}</div>
              <p className="text-xs text-muted-foreground">{items.message}</p>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Adicionais</CardTitle>
        </CardHeader>
        <CardContent>
          {(loading && !data) || !addons ? (
            <>
              <Skeleton className="w-10 h-6" />
              <Skeleton className="w-40 h-4 mt-2" />
            </>
          ) : (
            <>
              <div className="text-2xl font-bold">{addons.total}</div>
              <p className="text-xs text-muted-foreground">{addons.message}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
