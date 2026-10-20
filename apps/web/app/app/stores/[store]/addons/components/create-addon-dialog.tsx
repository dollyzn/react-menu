"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateAddonMutation } from "@/redux/features/addon/addonApi";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CopyPlus } from "lucide-react";
import { z } from "zod";
import { getErrorMessage } from "@/utils/get-error-message";
import MoneyInput from "@/components/ui/money-input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";

const NAME_MAX = 120;
const DESC_MAX = 500;

const CreateAddonSchema = z.object({
  name: z
    .string()
    .min(1, "O nome é obrigatório.")
    .max(NAME_MAX, `No máximo ${NAME_MAX} caracteres.`),
  description: z
    .string()
    .max(DESC_MAX, `No máximo ${DESC_MAX} caracteres.`)
    .optional(),
  price: z
    .number()
    .min(0.01, "O preço é obrigatório e deve ser maior que zero."),
});

interface CreateAddonDialogProps {
  storeId: string;
}

export function CreateAddonDialog({ storeId }: CreateAddonDialogProps) {
  const [createAddon, { isLoading: isSaving }] = useCreateAddonMutation();

  const form = useForm<z.infer<typeof CreateAddonSchema>>({
    resolver: zodResolver(CreateAddonSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
    },
  });
  const { isSubmitting } = form.formState;
  const busy = isSubmitting || isSaving;

  const [open, setOpen] = useState(false);

  const handleOpenChange = () => {
    if (busy && open) return;
    setOpen(!open);
  };

  const handleCreateAddon = async (data: z.infer<typeof CreateAddonSchema>) => {
    try {
      await createAddon({ storeId, data }).unwrap();
      handleOpenChange();
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err as { data?: { error?: string }; message?: string },
          "Ocorreu um erro ao criar o addon. Por favor, tente novamente."
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
            <CopyPlus /> Criar adicional
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar novo adicional</DialogTitle>
          <DialogDescription>
            Preencha os campos para criar um novo adicional.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleCreateAddon)}>
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
                    placeholder="Ex: Extra Bacon"
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
              {busy ? "Criando..." : "Criar Addon"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
