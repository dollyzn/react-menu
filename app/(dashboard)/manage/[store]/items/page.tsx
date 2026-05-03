"use client";

import { useParams } from "next/navigation";
import { useGetCategoriesByStoreIdQuery } from "@/redux/features/category/categoryApi";
import { useGetAddonsByStoreIdQuery } from "@/redux/features/addon/addonApi";
import { useGetItemsByStoreIdQuery } from "@/redux/features/item/itemApi";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ColumnsConfig, DataTable } from "@/components/data-table";
import { columns } from "./components/columns";
import { CreateItemDialog } from "./components/create-item-dialog";

export default function Items() {
  const { store } = useParams();
  const storeId = store as string;

  const { data, isLoading, isFetching } = useGetItemsByStoreIdQuery(storeId);
  const loading = isLoading || (isFetching && !data);

  useGetCategoriesByStoreIdQuery(storeId);
  useGetAddonsByStoreIdQuery(storeId);

  const categories = new Set(
    data?.map(({ category }) => category?.name).filter(Boolean)
  );

  const columnsConfig: ColumnsConfig[] = [
    {
      key: "name",
      searchable: true,
    },
    {
      key: "category.name",
      filterOptions: Array.from(categories).map((category) => ({
        value: category as string,
        label: category as string,
      })),
    },
  ];

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
              <BreadcrumbPage>Items</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <CreateItemDialog />
      </div>

      <DataTable
        tableId={`items-${storeId}`}
        loading={loading && !data}
        data={data || []}
        columns={columns}
        columnsConfig={columnsConfig}
      />
    </div>
  );
}
