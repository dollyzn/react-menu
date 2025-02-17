"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";

import { indexByStore as indexCategoriesByStore } from "@/redux/slices/category";
import { indexByStore as indexAddonsByStore } from "@/redux/slices/addon";
import { indexByStore } from "@/redux/slices/item";

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

  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(indexByStore(store as string));
    dispatch(indexCategoriesByStore(store as string));
    dispatch(indexAddonsByStore(store as string));
  }, [dispatch, store]);

  const loading = useSelector(
    (state: RootState) => state.item.indexByStore.loading
  );
  const data = useSelector((state: RootState) => state.item.indexByStore.data);

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
        loading={loading && !data}
        data={data || []}
        columns={columns}
        columnsConfig={columnsConfig}
      />
    </div>
  );
}
