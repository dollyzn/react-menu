"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useGetCategoriesByStoreIdQuery } from "@/redux/features/category/categoryApi";
import { useGetAddonsByStoreIdQuery } from "@/redux/features/addon/addonApi";
import { storeListPrefetchArg } from "@/redux/api/listQueryParams";
import { useCreateItemMutation } from "@/redux/features/item/itemApi";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MoneyInput from "@/components/ui/money-input";
import MultiCombobox from "@/components/app/multi-combobox";
import { getErrorMessage } from "@/utils/get-error-message";
import { toast } from "sonner";
import { z } from "zod";

const FORM_ID = "form-create-item";
const NAME_MAX = 120;
const DESC_MAX = 500;

const CreateItemSchema = z.object({
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
  categoryId: z.string().min(1, "A categoria é obrigatória"),
  addonIds: z.array(z.string()).optional(),
});

export function CreateItemDialog() {
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
  const [createItem, { isLoading: isSaving }] = useCreateItemMutation();

  const form = useForm<z.infer<typeof CreateItemSchema>>({
    resolver: zodResolver(CreateItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      categoryId: "",
      addonIds: [],
    },
  });
  const { isSubmitting } = form.formState;
  const busy = isSubmitting || isSaving;

  const [open, setOpen] = useState(false);

  const handleOpenChange = () => {
    if (busy && open) return;
    setOpen(!open);
  };

  const handleCreateItem = async (data: z.infer<typeof CreateItemSchema>) => {
    const { categoryId, ...formData } = data;

    try {
      await createItem({
        storeId,
        categoryId: Number(categoryId),
        data: formData,
      }).unwrap();
      handleOpenChange();
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err as { data?: { error?: string }; message?: string },
          "Ocorreu um erro ao criar o item. Por favor, tente novamente."
        ),
        {
          richColors: true,
          closeButton: true,
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal>
      <DialogTrigger
        render={
          <Button variant="outline">
            <PackagePlus /> Criar item
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar novo item</DialogTitle>
          <DialogDescription>
            Preencha os campos para criar um novo item no cardápio.
          </DialogDescription>
        </DialogHeader>
        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit(handleCreateItem)}
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
                    Opcional. Complementos vendidos junto com este item (busca e
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

          <DialogFooter>
            <Button
              type="reset"
              variant="outline"
              disabled={busy}
              onClick={() => form.reset()}
            >
              Limpar
            </Button>
            <Button type="submit" form={FORM_ID} loading={busy}>
              {busy ? "Criando..." : "Criar item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
