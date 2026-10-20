"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Eye, Tag, ImageOff, Clock } from "lucide-react";
import { Row } from "@tanstack/react-table";
import { formatCurrencyBRL } from "@/utils/string";
import { format, parseISO } from "date-fns";
import { RowActions } from "./table-row-actions";
import { AddonsColumnDialog } from "./addons-column-dialog";

interface ItemCardProps {
  row: Row<Item>;
}

export function ItemCard({ row }: ItemCardProps) {
  const item = row.original;

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm py-0">
      {/* Imagem */}
      <div className="relative w-full h-40 bg-muted">
        {item.photoUrl ? (
          <Image
            src={item.photoUrl}
            alt={item.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 400px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-8 opacity-40" />
          </div>
        )}
        {/* Badge flutuante */}
        <div className="absolute top-2 left-2">
          <Badge className="text-xs gap-1 shadow-sm">
            <Tag className="size-3" />
            {item.category?.name ?? "Sem categoria"}
          </Badge>
        </div>
        {/* Preço flutuante */}
        <div className="absolute bottom-2 right-2">
          <span className="rounded-md bg-background/90 backdrop-blur-sm px-2 py-1 text-sm font-semibold text-foreground shadow-sm border border-border">
            {formatCurrencyBRL(item.price)}
          </span>
        </div>
      </div>

      {/* Corpo */}
      <div className="p-4 space-y-3">
        {/* Nome + menu */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base leading-tight text-foreground text-balance">
            {item.name}
          </h3>

          <RowActions row={row} size="icon-sm" />
        </div>

        {/* Descrição */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {item.description || "Sem descrição"}
        </p>

        <Separator />

        {/* Metadados */}
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Eye className="size-3.5 shrink-0" />
            <span className="text-xs">Visualizações</span>
          </div>
          <span className="text-right font-medium text-foreground text-xs">
            {item.views}
          </span>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            <span className="text-xs">Atualizado</span>
          </div>
          <span className="text-right font-medium text-foreground text-xs">
            {format(parseISO(item.updatedAt), "dd/MM/yy HH:mm")}
          </span>
        </div>

        {/* Adicionais */}
        <>
          <Separator />

          <AddonsColumnDialog row={row} />
        </>
      </div>
    </Card>
  );
}
