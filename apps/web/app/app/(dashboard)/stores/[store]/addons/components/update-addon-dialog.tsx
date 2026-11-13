"use client";

import * as React from "react";
import { Row } from "@/components/app/data-table/features";
import { useParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/get-error-message";
import { useUpdateAddonByStoreIdMutation } from "@/redux/features/addon/addonApi";
import {
  Dialog,
  DialogBody,
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
  FieldTitle,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { KEEP_PHOTO, PhotoField, type PhotoChange } from "@/components/app/photo-field";
import { useSaveAddonPhoto } from "./use-save-addon-photo";
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
  // 0 is allowed, like the API: an option included in the price ("Orégano", mini flavors).
  price: z.number().min(0, "O preço não pode ser negativo."),
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
  const [photo, setPhoto] = React.useState<PhotoChange>(KEEP_PHOTO);
  const photoSaver = useSaveAddonPhoto();

  const form = useForm<z.infer<typeof UpdateAddonSchema>>({
    resolver: zodResolver(UpdateAddonSchema),
    values: {
      name: row.original.name,
      description: row.original.description ?? "",
      price: row.original.price,
    },
  });
  // For the photo's menu preview.
  const [previewName, previewPrice] = useWatch({ control: form.control, name: ["name", "price"] });
  const busy = form.formState.isSubmitting || isSaving || photoSaver.saving;

  const handleOpenChange = (nextOpen: boolean) => {
    if (busy && open && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  // Back to the saved values once closed (not while it fades out).
  const handleOpenChangeComplete = (nextOpen: boolean) => {
    if (nextOpen) return;
    form.reset({
      name: row.original.name,
      description: row.original.description ?? "",
      price: row.original.price,
    });
    setPhoto(KEEP_PHOTO);
  };

  const onSubmit = async (data: z.infer<typeof UpdateAddonSchema>) => {
    try {
      if (form.formState.isDirty) {
        await updateAddon({
          storeId,
          addonId: row.original.id,
          data,
        }).unwrap();
      }
      const photoError = await photoSaver.save(photo, storeId, row.original.id);
      if (photoError) {
        // The rest was saved: stay open so the photo can be tried again.
        toast.error(`Adicional salvo, mas a foto não: ${photoError}`);
        return;
      }
      handleOpenChange(false);
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err, `Erro ao atualizar adicional ${row.original.name}.`),
        { richColors: true, closeButton: true }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} onOpenChangeComplete={handleOpenChangeComplete}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar adicional</DialogTitle>
          <DialogDescription>Atualize os dados do adicional.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldTitle>Foto</FieldTitle>
                <PhotoField
                  currentUrl={row.original.photoUrl ?? null}
                  value={photo}
                  onChange={setPhoto}
                  disabled={busy}
                  name={previewName}
                  price={previewPrice}
                  kind="option"
                />
                <FieldDescription>Opcional. Aparece ao lado da opção no cardápio e no PDV.</FieldDescription>
              </Field>

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
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy} disabled={!form.formState.isDirty && photo.kind === "keep"}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
