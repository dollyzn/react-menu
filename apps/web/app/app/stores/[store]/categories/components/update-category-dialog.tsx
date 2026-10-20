"use client";

import { Row } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUpdateCategoryMutation } from "@/redux/features/category/categoryApi";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { getErrorMessage } from "@/utils/get-error-message";
import { z } from "zod";
import {
  InputGroup,
  InputGroupText,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";

const NAME_MAX = 120;
const DESC_MAX = 500;

const UpdateCategorySchema = z.object({
  name: z
    .string()
    .min(1, "O nome é obrigatório.")
    .max(NAME_MAX, `No máximo ${NAME_MAX} caracteres.`),
  description: z
    .string()
    .max(DESC_MAX, `No máximo ${DESC_MAX} caracteres.`)
    .optional(),
});

interface UpdateCategoryDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  row: Row<Category>;
}

export function UpdateCategoryDialog({
  open,
  onOpenChange,
  row,
}: UpdateCategoryDialogProps) {
  const { store } = useParams();
  const storeId = store as string;
  const [updateCategory, { isLoading: isSaving }] = useUpdateCategoryMutation();

  const form = useForm<z.infer<typeof UpdateCategorySchema>>({
    resolver: zodResolver(UpdateCategorySchema),
    values: {
      name: row.getValue("name"),
      description: row.getValue("description") ?? "",
    },
  });
  const { isSubmitting } = form.formState;
  const busy = isSubmitting || isSaving;

  const handleOpenChange = () => {
    if (busy && open) return;
    onOpenChange(!open);
    form.reset();
  };

  const handleUpdateCategory = async (
    data: z.infer<typeof UpdateCategorySchema>
  ) => {
    try {
      await updateCategory({
        storeId,
        categoryId: row.original.id,
        data,
      }).unwrap();
      handleOpenChange();
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err as { data?: { error?: string }; message?: string },
          `Ocorreu um erro ao editar a categoria ${row.getValue(
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar categoria</DialogTitle>
          <DialogDescription>
            Atualize as informações da categoria.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleUpdateCategory)}>
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
                    placeholder="Ex: Pastéis Selecionados"
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
                      {...field}
                      id={field.name}
                      disabled={busy}
                      rows={5}
                      className="min-h-24"
                      maxLength={DESC_MAX}
                      aria-invalid={fieldState.invalid}
                      placeholder="Ingredientes, tamanho, observações…"
                    />
                    <InputGroupAddon align="block-end">
                      <InputGroupText className="tabular-nums">
                        {field.value?.length ?? 0}/{DESC_MAX} caracteres
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>

                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button
              type="reset"
              variant="outline"
              disabled={busy}
              onClick={() => form.reset()}
            >
              Limpar
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? "Salvando..." : "Editar Categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
