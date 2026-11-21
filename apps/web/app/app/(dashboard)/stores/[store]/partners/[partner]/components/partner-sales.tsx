"use client";

import { useMemo, useState } from "react";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarCheck, HandCoins } from "lucide-react";
import type { PartnerSaleRow, PartnerSalesMeta, PartnerSettlement } from "@react-menu/contracts";
import type { RowSelectionState } from "@/components/app/data-table/features";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTableQuery } from "@/hooks/use-table-query";
import { businessToday, formatDay, fromLocalDate, toLocalDate } from "@/lib/report-period";
import type { StoreScopedListArg } from "@/redux/api/listQueryParams";
import {
  useGetPartnerSalesQuery,
  useGetPartnerSettlementsQuery,
  useSettlePartnerMutation,
  useUndoPartnerSettlementMutation,
} from "@/redux/features/partner/partnersApi";
import type { PaginatedList } from "@/types/paginated-list";
import { formatCurrencyBRL } from "@/utils/string";
import { SettlementList } from "@/components/app/partner/commission-state";
import { PartnerSalesContext } from "./sales-context";
import { renderSaleCard, salesColumns, salesColumnsConfig } from "./sales-columns";
import { SettleSelected } from "./settle-selected";

type SalesArg = StoreScopedListArg & { partnerId: string };

const sales = (count: number) => (count === 1 ? "1 venda" : `${count} vendas`);

/**
 * The partner's sales like the order history (period, commission state,
 * search), the picked ones or everything up to a day marked paid, and the
 * settlements recorded (undo puts their sales back to "a pagar").
 */
export function PartnerSales({ storeId, partnerId }: { storeId: string; partnerId: string }) {
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [settling, setSettling] = useState(false);

  const table = useTableQuery<PartnerSaleRow, PaginatedList<PartnerSaleRow>, SalesArg>(
    useGetPartnerSalesQuery,
    ({ filterParam, sortingParam, paginationParam }) => ({
      storeId,
      partnerId,
      filters: filterParam as Record<string, string | string[] | null | undefined>,
      sort: sortingParam,
      pagination: paginationParam,
    })
  );
  const picked = table.data.filter((sale) => selection[sale.id]);

  return (
    <PartnerSalesContext.Provider value={{ storeId, partnerId }}>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Vendas</CardTitle>
            <CardDescription>
              Marque as vendas cuja comissão você já pagou ao parceiro (Pix, dinheiro…), ou tudo até um dia.
            </CardDescription>
            <CardAction>
              <Button onClick={() => setSettling(true)}>
                <HandCoins /> Marcar como pago…
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <SettleSelected sales={picked} onDone={() => setSelection({})} />
            <DataTable<PartnerSaleRow>
              tableId={`partner-sales-${partnerId}`}
              loading={table.loading && table.data.length === 0}
              fetching={table.loading}
              facets={table.facets}
              facetsStale={table.facetsStale}
              data={table.data}
              rowCount={table.rowCount}
              getRowId={(row) => row.id}
              columns={salesColumns}
              columnsConfig={salesColumnsConfig}
              className="bg-card"
              externalPagination={table.pagination}
              onExternalPaginationChange={table.setPagination}
              externalSorting={table.sorting}
              onExternalSortingChange={table.setSorting}
              externalColumnFilters={table.filters}
              onExternalColumnFiltersChange={table.setFilters}
              externalRowSelection={selection}
              onExternalRowSelectionChange={setSelection}
              pinnedColumns={{ start: ["select", "customerName"], end: [] }}
              renderCard={renderSaleCard}
              defaultCardsOnMobile
            />
          </CardContent>
        </Card>

        <Settlements storeId={storeId} partnerId={partnerId} />
      </div>
      <SettleUntilDialog storeId={storeId} partnerId={partnerId} open={settling} onOpenChange={setSettling} />
    </PartnerSalesContext.Provider>
  );
}

/** "Marcar como pago…": every sale to pay up to the day picked, with the amount before confirming. */
function SettleUntilDialog({
  storeId,
  partnerId,
  open,
  onOpenChange,
}: {
  storeId: string;
  partnerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const today = businessToday();
  const [until, setUntil] = useState(today);
  const [note, setNote] = useState("");
  const [settle, { isLoading }] = useSettlePartnerMutation();
  // What would be settled: the sales to pay up to that day (the whole filter's commission).
  const preview = useGetPartnerSalesQuery(
    {
      storeId,
      partnerId,
      filters: { createdAt: `~${until}`, settlement: "to_pay" },
      pagination: { page: 1, pageSize: 1 },
    },
    { skip: !open }
  );
  const count = preview.data?.meta.total ?? 0;
  const amount = (preview.data?.meta as Partial<PartnerSalesMeta> | undefined)?.commissionTotal ?? 0;
  const selected = useMemo(() => toLocalDate(until), [until]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(next) => {
        if (next) return;
        setUntil(today);
        setNote("");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar comissão como paga</DialogTitle>
          <DialogDescription>Todas as vendas já entregues ao parceiro até o dia escolhido viram um acerto.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Vendas até</FieldLabel>
            <Calendar
              mode="single"
              required
              selected={selected}
              defaultMonth={selected}
              onSelect={(date) => date && setUntil(fromLocalDate(date))}
              disabled={{ after: toLocalDate(today) }}
              locale={ptBR}
              className="mx-auto rounded-xl border [--cell-size:--spacing(9)]"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settle-note">Observação (opcional)</FieldLabel>
            <Input id="settle-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: Pix de sexta" maxLength={300} />
          </Field>
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-sm" aria-live="polite">
            <span className="text-muted-foreground">
              {preview.isFetching ? "Calculando…" : count ? `${sales(count)} até ${formatDay(until)}` : `Nada a pagar até ${formatDay(until)}`}
            </span>
            <span className="text-base font-semibold tabular-nums">{formatCurrencyBRL(amount)}</span>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={isLoading}
            disabled={count === 0 || preview.isFetching}
            onClick={async () => {
              const settlement = await settle({ storeId, partnerId, input: { until, note: note.trim() || null } }).unwrap();
              onOpenChange(false);
              toast.success(`Comissão de ${formatCurrencyBRL(settlement.total)} marcada como paga`);
            }}
          >
            <CalendarCheck /> Marcar {formatCurrencyBRL(amount)} como pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The settlements recorded: when, how much, up to which day, who; undo puts their sales back. */
function Settlements({ storeId, partnerId }: { storeId: string; partnerId: string }) {
  const { data: settlements, isLoading } = useGetPartnerSettlementsQuery({ storeId, partnerId });
  const [undoing, setUndoing] = useState<PartnerSettlement | null>(null);
  const [undo, { isLoading: undoingNow }] = useUndoPartnerSettlementMutation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acertos</CardTitle>
        <CardDescription>O parceiro vê cada um na tela de comissão dele.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : (
          <SettlementList settlements={settlements ?? []} onUndo={setUndoing} />
        )}
      </CardContent>
      <AlertDialogDestructive
        open={Boolean(undoing)}
        onOpenChange={(next) => !next && setUndoing(null)}
        loading={undoingNow}
        title="Desfazer este acerto?"
        description={`As ${undoing ? sales(undoing.ordersCount) : ""} voltam para “a pagar”, aqui e na tela do parceiro.`}
        confirmLabel="Desfazer acerto"
        onConfirm={async () => {
          await undo({ storeId, partnerId, settlementId: undoing!.id }).unwrap();
          setUndoing(null);
          toast.success("Acerto desfeito");
        }}
      />
    </Card>
  );
}
