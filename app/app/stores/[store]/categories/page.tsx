"use client";

import { useParams } from "next/navigation";
import { useGetCategoriesByStoreIdQuery } from "@/redux/features/category/categoryApi";

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
  const storeId = store as string;

  const { data, isLoading, isFetching } =
    useGetCategoriesByStoreIdQuery(storeId);
  const loading = isLoading || (isFetching && !data);

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

        <CreateCategoryDialog storeId={storeId} />
      </div>

      <DataTable
        tableId={`categories-${storeId}`}
        loading={loading && !data}
        data={data || []}
        columns={columns}
        columnsConfig={columnsConfig}
        getRowId={(row) => `${row.id}`}
      />
    </div>
  );
}
