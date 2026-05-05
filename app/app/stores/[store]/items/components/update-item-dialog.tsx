"use client";

import * as React from "react";
import { Row } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useGetCategoriesByStoreIdQuery } from "@/redux/features/category/categoryApi";
import { useGetAddonsByStoreIdQuery } from "@/redux/features/addon/addonApi";
import { storeListPrefetchArg } from "@/redux/api/listQueryParams";
import { useGetAddonsByItemIdQuery } from "@/redux/features/addon/addonApi";
import { useUpdateItemMutation } from "@/redux/features/item/itemApi";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MoneyInput from "@/components/ui/money-input";

import MultiCombobox from "../../../../../../components/app/multi-combobox";
import { getErrorMessage } from "@/utils/get-error-message";
import { toast } from "sonner";
import { z } from "zod";

const FORM_ID = "form-update-item";
const NAME_MAX = 120;
const DESC_MAX = 500;

const UpdateItemSchema = z.object({
  name: z
    .string()
    .min(1, "O nome é obrigatório.")
    .max(NAME_MAX, `No máximo ${NAME_MAX} caracteres.`),
  description: z
    .string()
    .max(DESC_MAX, `No máximo ${DESC_MAX} caracteres.`)
    .nullish(),
  price: z
    .number()
    .min(0.01, "O preço é obrigatório e deve ser maior que zero."),
  categoryId: z.string().min(1, "A categoria é obrigatória"),
  addonIds: z.array(z.string()).optional(),
});

interface UpdateItemDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  row: Row<Item>;
}

export function UpdateItemDialog({
  open,
  onOpenChange,
  row,
}: UpdateItemDialogProps) {
  const { store } = useParams();
  const storeId = store as string;

  const { data: categoriesRes } = useGetCategoriesByStoreIdQuery(
    storeListPrefetchArg(storeId)
  );
  const { data: addonsRes } = useGetAddonsByStoreIdQuery(
    storeListPrefetchArg(storeId)
  );
  const categories = categoriesRes?.data ?? [];
  const addons = addonsRes?.data ?? [];
  const { data: itemAddons = [], isFetching: itemAddonsLoading } =
    useGetAddonsByItemIdQuery(
      { storeId, itemId: row.original.id },
      { skip: !open }
    );

  const [updateItem, { isLoading: isSaving }] = useUpdateItemMutation();

  const form = useForm<z.infer<typeof UpdateItemSchema>>({
    resolver: zodResolver(UpdateItemSchema),
    values: {
      name: row.getValue("name") as string,
      description: (row.getValue("description") as string | null) ?? "",
      price: row.getValue("price") as number,
      categoryId: (row.original.category?.id || "").toString(),
      addonIds: itemAddons.map((addon) => addon.id),
    },
  });
  const { isSubmitting } = form.formState;
  const busy = isSubmitting || isSaving;

  const snapshotValues = React.useCallback(() => {
    return {
      name: row.getValue("name") as string,
      description: (row.getValue("description") as string | null) ?? "",
      price: row.getValue("price") as number,
      categoryId: (row.original.category?.id || "").toString(),
      addonIds: itemAddons.map((addon) => addon.id),
    };
  }, [row, itemAddons]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (busy && open && !nextOpen) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      form.reset(snapshotValues());
    }
  };

  const handleUpdateItem = async (data: z.infer<typeof UpdateItemSchema>) => {
    try {
      await updateItem({
        storeId,
        itemId: row.original.id,
        data: {
          ...data,
          categoryId: Number(data.categoryId),
        },
      }).unwrap();
      handleDialogOpenChange(false);
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err as { data?: { error?: string }; message?: string },
          `Ocorreu um erro ao editar o item ${row.getValue(
            "name"
          )}. Por favor, tente novamente.`
        ),
        {
          richColors: true,
          closeButton: true,
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar item</DialogTitle>
          <DialogDescription>
            Atualize as informações do item no cardápio.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit(handleUpdateItem)}
            className="space-y-4"
          >
            {itemAddonsLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando adicionais do item…
              </div>
            )}
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      disabled={busy}
                      autoComplete="off"
                      maxLength={NAME_MAX}
                      aria-invalid={fieldState.invalid}
                      placeholder="Ex: Pastel de Queijo"
                    />

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Descrição</FieldLabel>
                    <InputGroup>
                      <InputGroupTextarea
                        id={field.name}
                        disabled={busy}
                        rows={5}
                        className="min-h-24"
                        maxLength={DESC_MAX}
                        aria-invalid={fieldState.invalid}
                        placeholder="Ingredientes, tamanho, observações…"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                      <InputGroupAddon align="block-end">
                        <InputGroupText className="tabular-nums">
                          {(field.value ?? "").length}/{DESC_MAX}
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>
                      Opcional. Deixe em branco para remover a descrição.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="categoryId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Categoria</FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={busy}
                    >
                      <SelectTrigger
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectGroup>
                          {categories.map((category) => (
                            <SelectItem
                              key={category.id}
                              value={category.id.toString()}
                            >
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      O item ficará agrupado nesta categoria no menu.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="addonIds"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Adicionais</FieldLabel>
                    <MultiCombobox
                      id={field.name}
                      items={addons}
                      value={field.value ?? []}
                      onChange={field.onChange}
                      getValue={(addon) => addon.id}
                      getLabel={(addon) => addon.name}
                      disabled={busy}
                      invalid={fieldState.invalid}
                      placeholder="Selecione os adicionais"
                      emptyMessage="Nenhum adicional encontrado"
                    />
                    <FieldDescription>
                      Complementos vendidos junto com este item (busca e
                      múltipla seleção).
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="price"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Adicionais</FieldLabel>
                    <MoneyInput
                      {...field}
                      id={field.name}
                      disabled={busy}
                      placeholder="R$ 10,00"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>
                      Preço unitário exibido no cardápio (em reais).
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy || itemAddonsLoading}
                onClick={() => form.reset(snapshotValues())}
              >
                Desfazer alterações
              </Button>
              <Button
                type="submit"
                form={FORM_ID}
                loading={busy}
                disabled={itemAddonsLoading}
              >
                {busy ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
