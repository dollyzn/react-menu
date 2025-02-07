"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { indexByStore } from "@/redux/slices/category";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DataTable } from "@/components/data-table";
import { columns, columnsConfig } from "./components/columns";
import { CreateCategoryDialog } from "./components/create-category-dialog";

export default function Categories() {
  const { store } = useParams();
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(indexByStore(store as string));
  }, [dispatch, store]);

  const loading = useSelector(
    (state: RootState) => state.category.indexByStore.loading
  );
  const data = useSelector(
    (state: RootState) => state.category.indexByStore.data
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={`/manage/${store}`}>Loja</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Categorias</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <CreateCategoryDialog storeId={store as string} />
      </div>

      <DataTable
        loading={loading && !data}
        data={data || []}
        columns={columns}
        columnsConfig={columnsConfig}
        getRowId={(row) => `${row.id}`}
      />
    </div>
  );
}
