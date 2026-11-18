"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/utils/get-error-message";
import { formatPhoneBR, STORE_SLUG } from "@/utils/string";
import { useSaveStore } from "./use-save-store";

const Schema = z.object({
  name: z.string().trim().min(1, "Informe o nome da loja."),
  slug: z
    .string()
    .trim()
    .min(1, "Informe o link do cardápio.")
    .regex(STORE_SLUG, "Use só letras minúsculas, números e hífens."),
  description: z.string().max(500, "No máximo 500 caracteres."),
  phone: z
    .string()
    .refine((value) => !value || [10, 11].includes(value.replace(/\D/g, "").length), "Informe DDD + número."),
  address: z.string(),
  instagramUrl: z
    .string()
    .trim()
    .refine(
      (value) => !value || (value.startsWith("https://www.instagram.com") && URL.canParse(value)),
      "Cole o link do perfil: https://www.instagram.com/…"
    ),
  ifoodUrl: z
    .string()
    .trim()
    .refine(
      (value) => !value || (value.startsWith("https://www.ifood.com.br") && URL.canParse(value)),
      "Cole o link da loja: https://www.ifood.com.br/…"
    ),
});
type Values = z.infer<typeof Schema>;

const toForm = (store: Store): Values => ({
  name: store.name ?? "",
  slug: store.slug ?? "",
  description: store.description ?? "",
  phone: formatPhoneBR(store.phone ?? ""),
  address: store.address ?? "",
  instagramUrl: store.instagramUrl ?? "",
  ifoodUrl: store.ifoodUrl ?? "",
});

/**
 * What customers read about the store (menu header, search results, links):
 * edited right on the page. How the store works lives in "Funcionamento".
 */
export function StoreProfileForm({ store }: { store: Store }) {
  const [save, { isLoading }] = useSaveStore();
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: toForm(store) });
  const busy = form.formState.isSubmitting || isLoading;
  const descriptionLength = useWatch({ control: form.control, name: "description" }).length;

  const submit = async (values: Values) => {
    try {
      const saved = await save(store.id, values);
      form.reset(toForm(saved));
      toast.success("Informações da loja salvas");
    } catch (error) {
      form.setError("root", {
        message: getErrorMessage(error as { data?: { error?: string } }, "Não foi possível salvar. Tente de novo."),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações básicas</CardTitle>
        <CardDescription>Aparecem no topo do cardápio e quando alguém compartilha o link da loja.</CardDescription>
      </CardHeader>
      <form noValidate onSubmit={form.handleSubmit(submit)} className="contents">
        <CardContent>
          <FieldGroup>
            <div className="grid gap-6 sm:grid-cols-2">
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="store-name">Nome da loja</FieldLabel>
                    <Input {...field} id="store-name" disabled={busy} aria-invalid={fieldState.invalid} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="slug"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="store-slug">Link do cardápio</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>/</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        {...field}
                        id="store-slug"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        disabled={busy}
                        aria-invalid={fieldState.invalid}
                        onChange={(event) => field.onChange(event.target.value.toLowerCase())}
                      />
                    </InputGroup>
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : (
                      <FieldDescription>Mudar o link quebra os links já compartilhados.</FieldDescription>
                    )}
                  </Field>
                )}
              />
            </div>

            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="store-description">Descrição</FieldLabel>
                  <Textarea
                    {...field}
                    id="store-description"
                    rows={3}
                    maxLength={500}
                    disabled={busy}
                    placeholder="Ex.: Pastéis feitos na hora desde 1998."
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <FieldDescription className="tabular-nums">{descriptionLength}/500</FieldDescription>
                  )}
                </Field>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <Controller
                name="phone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="store-phone">Telefone</FieldLabel>
                    <Input
                      {...field}
                      id="store-phone"
                      type="tel"
                      inputMode="tel"
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
                name="address"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="store-address">Endereço</FieldLabel>
                    <Input
                      {...field}
                      id="store-address"
                      disabled={busy}
                      placeholder="Rua, número - Bairro, Cidade"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="instagramUrl"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="store-instagram">Instagram</FieldLabel>
                    <Input
                      {...field}
                      id="store-instagram"
                      type="url"
                      inputMode="url"
                      disabled={busy}
                      placeholder="https://www.instagram.com/sualoja"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="ifoodUrl"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="store-ifood">iFood</FieldLabel>
                    <Input
                      {...field}
                      id="store-ifood"
                      type="url"
                      inputMode="url"
                      disabled={busy}
                      placeholder="https://www.ifood.com.br/delivery/…"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>
            {form.formState.errors.root?.message && (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !form.formState.isDirty}
            onClick={() => form.reset(toForm(store))}
          >
            Desfazer alterações
          </Button>
          <Button type="submit" loading={busy} disabled={!form.formState.isDirty}>
            Salvar
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
