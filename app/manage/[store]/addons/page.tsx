"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { useParams } from "next/navigation";

import { indexByStore } from "@/redux/slices/addon";

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
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(indexByStore(store as string));
  }, [dispatch, store]);

  const loading = useSelector(
    (state: RootState) => state.addon.indexByStore.loading
  );
  const data = useSelector((state: RootState) => state.addon.indexByStore.data);

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

        <CreateAddonDialog storeId={store as string} />
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
