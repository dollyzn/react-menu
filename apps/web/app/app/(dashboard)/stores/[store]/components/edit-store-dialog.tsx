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
  FieldSeparator,
} from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatPhoneBR } from "@/utils/string";
import {
  Dialog,
  DialogBody,
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
  phone: z
    .string()
    .refine((v) => !v || [10, 11].includes(v.replace(/\D/g, "").length), "Informe DDD + número."),
  description: z.string().max(500, "No máximo 500 caracteres."),
  pickupEtaMinutes: z.number({ message: "Informe os minutos." }).int().min(1).max(240),
  inventoryEnabled: z.boolean(),
  counterPaymentEnabled: z.boolean(),
  kitchenBatchLookahead: z.number().int().min(0).max(5),
});

const LOOKAHEAD_OPTIONS = [
  { value: 0, label: "Desligado: ordem de chegada" },
  { value: 1, label: "Até 1 pedido à frente" },
  { value: 2, label: "Até 2 pedidos à frente" },
  { value: 3, label: "Até 3 pedidos à frente" },
  { value: 4, label: "Até 4 pedidos à frente" },
  { value: 5, label: "Até 5 pedidos à frente" },
];

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
      phone: formatPhoneBR(data.phone ?? ""),
      description: data.description ?? "",
      pickupEtaMinutes: data.pickupEtaMinutes ?? 20,
      inventoryEnabled: data.inventoryEnabled ?? false,
      counterPaymentEnabled: data.counterPaymentEnabled ?? true,
      kitchenBatchLookahead: data.kitchenBatchLookahead ?? 3,
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
          stores: user.stores.map((s) =>
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
          <DialogTitle>Editar informações da loja</DialogTitle>
          <DialogDescription>
            Atualize as informações básicas da sua loja
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogBody>
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

              <FieldSeparator>Operação</FieldSeparator>

              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Descrição no cardápio</FieldLabel>
                    <Textarea {...field} id={field.name} rows={2} maxLength={500} disabled={busy} placeholder="Ex.: Pastéis feitos na hora desde 1998." />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  name="phone"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Telefone</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        type="tel"
                        disabled={busy}
                        placeholder="(11) 91234-5678"
                        aria-invalid={fieldState.invalid}
                        onChange={(event) => field.onChange(formatPhoneBR(event.target.value))}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="pickupEtaMinutes"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Tempo de retirada (min)</FieldLabel>
                      <Input
                        id={field.name}
                        type="number"
                        min={1}
                        max={240}
                        disabled={busy}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="inventoryEnabled"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <Switch id={field.name} checked={field.value} onCheckedChange={field.onChange} disabled={busy} />
                    <div>
                      <FieldLabel htmlFor={field.name}>Controlar estoque</FieldLabel>
                      <FieldDescription>Itens sem ingredientes suficientes ficam indisponíveis no cardápio.</FieldDescription>
                    </div>
                  </Field>
                )}
              />
              <Controller
                name="counterPaymentEnabled"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <Switch id={field.name} checked={field.value} onCheckedChange={field.onChange} disabled={busy} />
                    <div>
                      <FieldLabel htmlFor={field.name}>Aceitar pagamento na retirada</FieldLabel>
                      <FieldDescription>Clientes podem pedir online e pagar no balcão.</FieldDescription>
                    </div>
                  </Field>
                )}
              />
              <Controller
                name="kitchenBatchLookahead"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Agrupar pastéis iguais na cozinha</FieldLabel>
                    <NativeSelect
                      id={field.name}
                      value={String(field.value)}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                      disabled={busy}
                    >
                      {LOOKAHEAD_OPTIONS.map((option) => (
                        <NativeSelectOption key={option.value} value={String(option.value)}>
                          {option.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldDescription>
                      A cozinha faz de uma vez os pastéis iguais de pedidos próximos. Quanto mais pedidos à frente,
                      mais rápido sai o lote, mas um pedido que chegou antes pode ficar esperando.
                    </FieldDescription>
                  </Field>
                )}
              />
            </FieldGroup>
          </DialogBody>
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
