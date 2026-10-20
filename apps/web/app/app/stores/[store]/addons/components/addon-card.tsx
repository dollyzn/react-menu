"use client";

import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ImageOff, Clock } from "lucide-react";
import { formatCurrencyBRL } from "@/utils/string";
import { format } from "date-fns";
import { Row } from "@tanstack/react-table";
import { RowActions } from "./table-row-actions";

interface AddonCardProps {
  row: Row<Addon>;
}

export function AddonCard({ row }: AddonCardProps) {
  const addon = row.original;

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm py-0">
      <div className="flex gap-0">
        <div className="relative w-24 shrink-0 bg-muted self-stretch">
          {addon.photoUrl ? (
            <Image
              src={addon.photoUrl}
              alt={addon.name}
              fill
              className="object-cover"
              sizes="96px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-6 opacity-40" />
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1 min-w-0 p-3 gap-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base leading-tight text-foreground text-balance">
              {addon.name}
            </h3>

            <RowActions row={row} size="icon-xs" />
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {addon.description || "Sem descrição"}
          </p>

          <Separator className="my-0.5" />

          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-bold text-foreground">
              {formatCurrencyBRL(addon.price)}
            </span>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3 shrink-0" />
              <span className="text-[11px]">
                {format(addon.updatedAt, "dd/MM/yy")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
