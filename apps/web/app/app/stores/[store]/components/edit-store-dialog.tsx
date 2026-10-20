"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useUpdateStoreMutation } from "@/redux/features/store/storeApi";
import { setUser } from "@/redux/slices/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { getErrorMessage } from "@/utils/get-error-message";
import type { User as SessionUser } from "@/types/session";
import { z } from "zod";

const EditStoreSchema = z.object({
  name: z.string().min(1, "O nome da loja é obrigatório."),
  address: z.string(),
  instagramUrl: z
    .string()
    .startsWith(
      "https://www.instagram.com",
      "Insira uma URL válida para o Instagram."
    )
    .url("Insira uma URL válida para o Instagram.")
    .optional()
    .or(z.literal("")),
  ifoodUrl: z
    .string()
    .startsWith(
      "https://www.ifood.com.br",
      "Insira uma URL válida para o iFood."
    )
    .url("Insira uma URL válida para o iFood.")
    .optional()
    .or(z.literal("")),
  slug: z
    .string()
    .min(1, "O slug é obrigatório.")
    .regex(
      /^[a-z0-9-]+$/,
      "O slug deve conter apenas letras minúsculas, números e hífens."
    ),
});

type EditStoreFormValues = z.infer<typeof EditStoreSchema>;

interface EditStoreDialogProps {
  data: Store;
  open: boolean;
  toggle: () => void;
}

export function EditStoreDialog({ data, open, toggle }: EditStoreDialogProps) {
  const storeId = data.id;
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [updateStore, { isLoading: isSaving }] = useUpdateStoreMutation();

  const form = useForm<EditStoreFormValues>({
    resolver: zodResolver(EditStoreSchema),
    defaultValues: {
      name: data.name || "",
      address: data.address || "",
      instagramUrl: data.instagramUrl || "",
      ifoodUrl: data.ifoodUrl || "",
      slug: data.slug || "",
    },
  });
  const { isSubmitting } = form.formState;
  const busy = isSubmitting || isSaving;

  const handleSubmit = async (values: EditStoreFormValues) => {
    try {
      const payload = await updateStore({
        id: storeId,
        data: values,
      }).unwrap();
      toggle();

      if (user) {
        const updatedUser: SessionUser = {
          ...user,
          stores: user.stores.map((s: Store) =>
            s.id === payload.id ? { ...s, ...payload } : s
          ),
        };
        dispatch(setUser(updatedUser));
      }
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err as { data?: { error?: string }; message?: string },
          "Ocorreu um erro ao atualizar as informações. Por favor, tente novamente."
        ),
        {
          richColors: true,
          closeButton: true,
        }
      );
    }
  };

  const handleOpenChange = () => {
    if (busy && open) return;
    toggle();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Informações da Loja</DialogTitle>
          <DialogDescription>
            Atualize as informações básicas da sua loja
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Nome da Loja</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    disabled={busy}
                    placeholder="Nome da Loja"
                    aria-invalid={fieldState.invalid}
                  />

                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="address"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Endereço</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    disabled={busy}
                    placeholder="Endereço"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Endereço da loja resumido para o cardápio.
                  </FieldDescription>

                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="instagramUrl"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>URL do Instagram</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    disabled={busy}
                    placeholder="https://www.instagram.com/sualoja"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="ifoodUrl"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>URL do iFood</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    disabled={busy}
                    placeholder="https://www.ifood.com.br/sualoja"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="slug"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Slug</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    disabled={busy}
                    placeholder="slug-da-loja"
                    aria-invalid={fieldState.invalid}
                  />

                  <FieldDescription>
                    Slug da loja utilizado para acessar o cardápio.
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
              type="reset"
              variant="outline"
              disabled={busy}
              onClick={() => form.reset()}
            >
              Limpar
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
