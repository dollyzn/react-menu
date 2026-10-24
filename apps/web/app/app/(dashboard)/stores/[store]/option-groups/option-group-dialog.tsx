"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { OptionGroup } from "@react-menu/contracts";
import MultiCombobox from "@/components/app/multi-combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useGetAddonsByStoreIdQuery } from "@/redux/features/addon/addonApi";
import { storeListPrefetchArg } from "@/redux/api/listQueryParams";
import {
  useCreateOptionGroupMutation,
  useUpdateOptionGroupMutation,
} from "@/redux/features/option-group/optionGroupApi";
import { formatCurrencyBRL } from "@/utils/string";
import { getErrorMessage } from "@/utils/get-error-message";

const Schema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao grupo, ex.: Escolha o queijo.").max(120),
    minChoices: z.number({ message: "Informe um número." }).int().min(0, "No mínimo 0.").max(20),
    maxChoices: z.number({ message: "Informe um número." }).int().min(1, "Pelo menos 1.").max(20),
    addonIds: z.array(z.string()).min(1, "Escolha as opções do grupo."),
  })
  .superRefine((values, ctx) => {
    if (values.minChoices > values.maxChoices) {
      ctx.addIssue({ code: "custom", path: ["minChoices"], message: "O mínimo não pode passar do máximo." });
    }
    if (values.addonIds.length > 0 && values.maxChoices > values.addonIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["maxChoices"],
        message: `O grupo tem ${values.addonIds.length} ${values.addonIds.length === 1 ? "opção" : "opções"}.`,
      });
    }
  });

type Values = z.infer<typeof Schema>;

/** Rule of a group in words: "Obrigatório · escolha 1", "Opcional · até 2". */
export function groupRule(group: Pick<OptionGroup, "minChoices" | "maxChoices">) {
  if (group.minChoices === 0) return `Opcional · até ${group.maxChoices}`;
  if (group.minChoices === group.maxChoices) return `Obrigatório · escolha ${group.minChoices}`;
  return `Obrigatório · de ${group.minChoices} a ${group.maxChoices}`;
}

/** Create or edit a choice group; its options are the store's add-ons. */
export function OptionGroupDialog({
  storeId,
  group,
  open,
  onOpenChange,
}: {
  storeId: string;
  /** Null to create. */
  group: OptionGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: addonsRes } = useGetAddonsByStoreIdQuery(storeListPrefetchArg(storeId), { skip: !open });
  const addons = addonsRes?.data ?? [];
  const [create, creating] = useCreateOptionGroupMutation();
  const [update, updating] = useUpdateOptionGroupMutation();
  const busy = creating.isLoading || updating.isLoading;

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    values: {
      name: group?.name ?? "",
      minChoices: group?.minChoices ?? 1,
      maxChoices: group?.maxChoices ?? 1,
      addonIds: group?.options?.map((option) => option.id) ?? [],
    },
  });
  const values = useWatch({ control: form.control }) as Values;

  const close = (next: boolean) => {
    if (busy) return;
    onOpenChange(next);
    if (!next) form.reset();
  };

  const submit = async (data: Values) => {
    try {
      if (group) await update({ storeId, id: group.id, data }).unwrap();
      else await create({ storeId, data }).unwrap();
      toast.success(group ? "Grupo de escolha atualizado" : "Grupo de escolha criado");
      close(false);
    } catch (error) {
      form.setError("root", { message: getErrorMessage(error, "Não foi possível salvar o grupo.") });
    }
  };

  const number = (value: string) => (value === "" ? Number.NaN : Number(value));

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <form noValidate onSubmit={form.handleSubmit(submit)}>
          <DialogHeader>
            <DialogTitle>{group ? "Editar grupo de escolha" : "Novo grupo de escolha"}</DialogTitle>
            <DialogDescription>
              O cliente escolhe entre as opções ao pedir, ex.: o queijo do pastel ou até 2 molhos.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="group-name">Nome</FieldLabel>
                    <Input
                      {...field}
                      id="group-name"
                      placeholder="Ex.: Escolha o queijo"
                      aria-invalid={fieldState.invalid}
                      disabled={busy}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="addonIds"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="group-options">Opções</FieldLabel>
                    <MultiCombobox
                      id="group-options"
                      items={addons}
                      value={field.value}
                      onChange={field.onChange}
                      getValue={(addon) => addon.id}
                      getLabel={(addon) => `${addon.name} (${addon.price ? `+ ${formatCurrencyBRL(addon.price)}` : "incluso"})`}
                      disabled={busy}
                      invalid={fieldState.invalid}
                      placeholder="Selecione os adicionais que viram opções"
                      emptyMessage="Nenhum adicional encontrado"
                    />
                    <FieldDescription>
                      As opções são adicionais da loja (com preço, receita e estoque). Para algo incluso no preço,
                      crie o adicional com R$ 0,00.
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name="minChoices"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="group-min">Mínimo</FieldLabel>
                      <Input
                        id="group-min"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(event) => field.onChange(number(event.target.value))}
                        aria-invalid={fieldState.invalid}
                        disabled={busy}
                      />
                      <FieldDescription>0 = opcional</FieldDescription>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="maxChoices"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="group-max">Máximo</FieldLabel>
                      <Input
                        id="group-max"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(event) => field.onChange(number(event.target.value))}
                        aria-invalid={fieldState.invalid}
                        disabled={busy}
                      />
                      <FieldDescription>1 = uma escolha só</FieldDescription>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>
              {Number.isFinite(values.minChoices) && Number.isFinite(values.maxChoices) && values.maxChoices >= 1 && (
                <p className="text-sm text-muted-foreground">
                  O cliente vê: <strong className="text-foreground">{groupRule(values)}</strong>
                </p>
              )}
              {form.formState.errors.root?.message && (
                <Alert variant="destructive">
                  <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              {group ? "Salvar" : "Criar grupo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
