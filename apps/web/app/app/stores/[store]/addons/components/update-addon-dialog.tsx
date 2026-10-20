"use client";

import { Row } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/get-error-message";
import { useUpdateAddonByStoreIdMutation } from "@/redux/features/addon/addonApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MoneyInput from "@/components/ui/money-input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";

const NAME_MAX = 120;
const DESC_MAX = 500;

const UpdateAddonSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório.").max(NAME_MAX),
  description: z.string().max(DESC_MAX).optional(),
  price: z.number().min(0.01, "O preço deve ser maior que zero."),
});

interface UpdateAddonDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  row: Row<Addon>;
}

export function UpdateAddonDialog({
  open,
  onOpenChange,
  row,
}: UpdateAddonDialogProps) {
  const { store } = useParams();
  const storeId = store as string;
  const [updateAddon, { isLoading: isSaving }] = useUpdateAddonByStoreIdMutation();

  const form = useForm<z.infer<typeof UpdateAddonSchema>>({
    resolver: zodResolver(UpdateAddonSchema),
    values: {
      name: row.original.name,
      description: row.original.description ?? "",
      price: row.original.price,
    },
  });
  const busy = form.formState.isSubmitting || isSaving;

  const handleOpenChange = (nextOpen: boolean) => {
    if (busy && open && !nextOpen) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      form.reset({
        name: row.original.name,
        description: row.original.description ?? "",
        price: row.original.price,
      });
    }
  };

  const onSubmit = async (data: z.infer<typeof UpdateAddonSchema>) => {
    try {
      await updateAddon({
        storeId,
        addonId: row.original.id,
        data,
      }).unwrap();
      handleOpenChange(false);
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err, `Erro ao atualizar adicional ${row.original.name}.`),
        { richColors: true, closeButton: true }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar adicional</DialogTitle>
          <DialogDescription>Atualize os dados do adicional.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                  <Input {...field} id={field.name} maxLength={NAME_MAX} disabled={busy} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
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
                      value={field.value ?? ""}
                      rows={4}
                      maxLength={DESC_MAX}
                      disabled={busy}
                    />
                    <InputGroupAddon align="block-end">
                      <InputGroupText>{(field.value ?? "").length}/{DESC_MAX}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>Opcional.</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="price"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Preço</FieldLabel>
                  <MoneyInput
                    {...field}
                    id={field.name}
                    disabled={busy}
                    placeholder="R$ 10,00"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
