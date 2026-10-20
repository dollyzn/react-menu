"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateCategoryMutation } from "@/redux/features/category/categoryApi";
import { toast } from "sonner";

import {
  Dialog,
  DialogTrigger,
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
import { FolderPlus } from "lucide-react";

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

const CreateCategorySchema = z.object({
  name: z
    .string()
    .min(1, "O nome é obrigatório.")
    .max(NAME_MAX, `No máximo ${NAME_MAX} caracteres.`),
  description: z
    .string()
    .max(DESC_MAX, `No máximo ${DESC_MAX} caracteres.`)
    .optional(),
});

interface CreateCategoryDialogProps {
  storeId: string;
}

export function CreateCategoryDialog({ storeId }: CreateCategoryDialogProps) {
  const [createCategory, { isLoading: isSaving }] = useCreateCategoryMutation();

  const form = useForm<z.infer<typeof CreateCategorySchema>>({
    resolver: zodResolver(CreateCategorySchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });
  const { isSubmitting } = form.formState;
  const busy = isSubmitting || isSaving;

  const [open, setOpen] = useState(false);

  const handleOpenChange = () => {
    if (busy && open) return;
    setOpen(!open);
  };

  const handleCreateCategory = async (
    data: z.infer<typeof CreateCategorySchema>
  ) => {
    try {
      await createCategory({ storeId, data }).unwrap();
      handleOpenChange();
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err as { data?: { error?: string }; message?: string },
          "Ocorreu um erro ao criar a categoria. Por favor, tente novamente."
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
      <DialogTrigger
        render={
          <Button variant="outline">
            <FolderPlus /> Criar categoria
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar nova categoria</DialogTitle>
          <DialogDescription>
            Preencha os campos para criar uma nova categoria.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(handleCreateCategory)}
          className="space-y-4"
        >
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
              {busy ? "Criando..." : "Criar Categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
