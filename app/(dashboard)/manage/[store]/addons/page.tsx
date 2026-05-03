"use client";

import { useParams } from "next/navigation";
import { useGetAddonsByStoreIdQuery } from "@/redux/features/addon/addonApi";

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
import { CreateAddonDialog } from "./components/create-addon-dialog";

export default function Addons() {
  const { store } = useParams();
  const storeId = store as string;

  const { data, isLoading, isFetching } = useGetAddonsByStoreIdQuery(storeId);
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
              <BreadcrumbPage>Adicionais</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <CreateAddonDialog storeId={storeId} />
      </div>

      <DataTable
        tableId={`addons-${storeId}`}
        loading={loading && !data}
        data={data || []}
        columns={columns}
        columnsConfig={columnsConfig}
      />
    </div>
  );
}
