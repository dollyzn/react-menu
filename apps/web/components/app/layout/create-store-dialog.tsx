"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCreateStoreMutation } from "@/redux/features/store/storeApi";
import { useSession } from "@/contexts/session-provider";
import { getErrorMessage } from "@/utils/get-error-message";
import { slugify } from "@/utils/string";

const NAME_MAX = 120;

const CreateStoreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "O nome é obrigatório.")
    .max(NAME_MAX, `No máximo ${NAME_MAX} caracteres.`),
  slug: z
    .string()
    .min(1, "O endereço é obrigatório.")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens."),
});

type CreateStoreValues = z.infer<typeof CreateStoreSchema>;

interface CreateStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateStoreDialog({ open, onOpenChange }: CreateStoreDialogProps) {
  const router = useRouter();
  const { verify } = useSession();
  const [createStore, { isLoading: isSaving }] = useCreateStoreMutation();

  const form = useForm<CreateStoreValues>({
    resolver: zodResolver(CreateStoreSchema),
    defaultValues: { name: "", slug: "" },
  });
  const { isSubmitting, dirtyFields } = form.formState;
  const busy = isSubmitting || isSaving;

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    if (!next) form.reset();
    onOpenChange(next);
  };

  const handleCreateStore = async (data: CreateStoreValues) => {
    try {
      const store = await createStore(data).unwrap();
      // The new store only shows up in the switcher after the session reloads.
      await verify();
      form.reset();
      onOpenChange(false);
      router.push(`/app/stores/${store.id}`);
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err as { data?: { error?: string }; message?: string },
          "Ocorreu um erro ao criar a loja. Por favor, tente novamente."
        ),
        { richColors: true, closeButton: true }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar loja</DialogTitle>
          <DialogDescription>
            Crie uma nova loja para gerenciar suas categorias e itens.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(handleCreateStore)}
        >
          <DialogBody>
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="store-name">Nome</FieldLabel>
                    <Input
                      {...field}
                      id="store-name"
                      disabled={busy}
                      autoComplete="off"
                      maxLength={NAME_MAX}
                      aria-invalid={fieldState.invalid}
                      placeholder="Ex: JJ Pastéis Centro"
                      onChange={(e) => {
                        field.onChange(e);
                        if (!dirtyFields.slug) {
                          form.setValue("slug", slugify(e.target.value));
                        }
                      }}
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
                    <FieldLabel htmlFor="store-slug">Endereço do cardápio</FieldLabel>
                    <Input
                      {...field}
                      id="store-slug"
                      disabled={busy}
                      autoComplete="off"
                      aria-invalid={fieldState.invalid}
                      placeholder="jj-pasteis-centro"
                    />
                    <FieldDescription>
                      Usado no link público do cardápio.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? "Criando..." : "Criar loja"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
