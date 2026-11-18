"use client";

import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Clock, Eye, Link2, MapPin, Phone, Star, Store as StoreIcon } from "lucide-react";
import Image from "@/components/app/image";
import { Icons } from "@/components/app/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { formatPhoneBR, STORE_SLUG } from "@/utils/string";
import { UnsavedChangesBar } from "./unsaved-changes-bar";
import { useFollowSaved } from "./use-follow-saved";
import { useSaveStore } from "./use-save-store";

const DESCRIPTION_MAX = 500;

const Schema = z.object({
  name: z.string().trim().min(1, "Informe o nome da loja."),
  slug: z
    .string()
    .trim()
    .min(1, "Informe o link do cardápio.")
    .regex(STORE_SLUG, "Use só letras minúsculas, números e hífens."),
  description: z.string().max(DESCRIPTION_MAX, `No máximo ${DESCRIPTION_MAX} caracteres.`),
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

/** A text field with an icon (or text) inside on the left. */
function IconField({
  control,
  name,
  label,
  icon,
  hint,
  disabled,
  ...input
}: {
  control: Control<Values>;
  name: keyof Values;
  label: string;
  icon: React.ReactNode;
  hint?: React.ReactNode;
  disabled: boolean;
} & Omit<React.ComponentProps<typeof InputGroupInput>, "name" | "disabled">) {
  const id = `store-${name}`;
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <InputGroup>
            <InputGroupAddon>{icon}</InputGroupAddon>
            <InputGroupInput
              {...field}
              {...input}
              id={id}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
              onChange={input.onChange ?? field.onChange}
            />
          </InputGroup>
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : hint && <FieldDescription>{hint}</FieldDescription>}
        </Field>
      )}
    />
  );
}

/**
 * What customers read about the store (menu header, search results, links):
 * edited right on the page, with the menu's header next to it as it will
 * look. How the store works lives in "Funcionamento".
 */
export function StoreProfileForm({ store }: { store: Store }) {
  const [save, { isLoading }] = useSaveStore();
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: toForm(store) });
  useFollowSaved(form, () => toForm(store), store.updatedAt);
  const values = useWatch({ control: form.control }) as Values;
  const busy = form.formState.isSubmitting || isLoading;
  const disabled = busy;

  const submit = async (data: Values) => {
    try {
      const saved = await save(store.id, data);
      form.reset(toForm(saved));
      toast.success("Informações da loja salvas");
    } catch (error) {
      form.setError("root", {
        message: getErrorMessage(error as { data?: { error?: string } }, "Não foi possível salvar. Tente de novo."),
      });
    }
  };

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Informações básicas</CardTitle>
            <CardDescription>Aparecem no topo do cardápio e quando alguém compartilha o link da loja.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label" className="flex items-center gap-2 text-muted-foreground">
                  <StoreIcon className="size-4" /> Identidade
                </FieldLegend>
                <FieldGroup>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <IconField
                      control={form.control}
                      name="name"
                      label="Nome da loja"
                      icon={<StoreIcon />}
                      disabled={disabled}
                    />
                    <IconField
                      control={form.control}
                      name="slug"
                      label="Link do cardápio"
                      icon={<InputGroupText>/</InputGroupText>}
                      hint="Mudar o link quebra os links já compartilhados."
                      disabled={disabled}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(event) => form.setValue("slug", event.target.value.toLowerCase(), { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
                    />
                  </div>
                  <Controller
                    name="description"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <div className="flex items-baseline justify-between gap-2">
                          <FieldLabel htmlFor="store-description">Descrição</FieldLabel>
                          <span
                            className={cn(
                              "text-xs tabular-nums text-muted-foreground transition-colors",
                              field.value.length > DESCRIPTION_MAX * 0.9 && "text-warning"
                            )}
                          >
                            {field.value.length}/{DESCRIPTION_MAX}
                          </span>
                        </div>
                        <Textarea
                          {...field}
                          id="store-description"
                          rows={3}
                          maxLength={DESCRIPTION_MAX}
                          disabled={disabled}
                          placeholder="Ex.: Pastéis feitos na hora desde 1998."
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : (
                          <FieldDescription>Uma ou duas frases sobre a loja. Vai também para o Google.</FieldDescription>
                        )}
                      </Field>
                    )}
                  />
                </FieldGroup>
              </FieldSet>

              <FieldSeparator />

              <FieldSet>
                <FieldLegend variant="label" className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-4" /> Contato
                </FieldLegend>
                <div className="grid gap-6 sm:grid-cols-2">
                  <IconField
                    control={form.control}
                    name="phone"
                    label="Telefone"
                    icon={<Phone />}
                    disabled={disabled}
                    type="tel"
                    inputMode="tel"
                    placeholder="(11) 91234-5678"
                    onChange={(event) =>
                      form.setValue("phone", formatPhoneBR(event.target.value), {
                        shouldDirty: true,
                        shouldValidate: form.formState.isSubmitted,
                      })
                    }
                  />
                  <IconField
                    control={form.control}
                    name="address"
                    label="Endereço"
                    icon={<MapPin />}
                    disabled={disabled}
                    placeholder="Rua, número - Bairro, Cidade"
                  />
                </div>
              </FieldSet>

              <FieldSeparator />

              <FieldSet>
                <FieldLegend variant="label" className="flex items-center gap-2 text-muted-foreground">
                  <Link2 className="size-4" /> Redes e apps
                </FieldLegend>
                <div className="grid gap-6 sm:grid-cols-2">
                  <IconField
                    control={form.control}
                    name="instagramUrl"
                    label="Instagram"
                    icon={<Icons.instagram />}
                    disabled={disabled}
                    type="url"
                    inputMode="url"
                    placeholder="https://www.instagram.com/sualoja"
                  />
                  <IconField
                    control={form.control}
                    name="ifoodUrl"
                    label="iFood"
                    icon={<Icons.ifood />}
                    disabled={disabled}
                    type="url"
                    inputMode="url"
                    placeholder="https://www.ifood.com.br/delivery/…"
                  />
                </div>
              </FieldSet>

              {form.formState.errors.root?.message && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        <MenuHeaderPreview store={store} values={values} />
      </div>

      <UnsavedChangesBar
        dirty={form.formState.isDirty}
        busy={busy}
        onReset={() => form.reset(toForm(store))}
      />
    </form>
  );
}

/** The menu's header (`(menu)/_components/store-hero.tsx`) with what is typed, before saving. */
function MenuHeaderPreview({ store, values }: { store: Store; values: Values }) {
  const name = values.name.trim() || "Nome da loja";
  return (
    <Card className="gap-3 overflow-hidden lg:sticky lg:top-20" aria-label="Prévia do topo do cardápio">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Eye className="size-4 text-primary" /> Prévia no cardápio
        </CardTitle>
        <CardDescription>Como o cliente vê o topo do cardápio.</CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="relative h-28">
            {store.bannerUrl ? (
              <Image src={store.bannerUrl} blurDataURL={store.bannerBlur} alt="" fill sizes="352px" className="object-cover" />
            ) : (
              <div className="absolute inset-0 bg-linear-to-br from-primary/40 via-primary/15 to-muted" />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent" />
          </div>
          <div className="relative mx-3 -mt-12 mb-3 rounded-xl border bg-card/95 p-3 shadow-md backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border bg-background">
                {store.photoUrl ? (
                  <Image
                    src={store.photoUrl}
                    blurDataURL={store.photoBlur}
                    alt=""
                    fill
                    sizes="48px"
                    style={{ objectFit: "contain" }}
                    className="p-0.5"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center bg-primary/10 text-sm font-black text-primary">
                    {name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <motion.p
                  key={name}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  className="truncate leading-tight font-bold"
                >
                  {name}
                </motion.p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium",
                      store.isOpen ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", store.isOpen ? "bg-success" : "bg-muted-foreground")} />
                    {store.isOpen ? "Aberto agora" : "Fechado"}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Clock className="size-3" /> ~{store.pickupEtaMinutes} min
                  </span>
                  <span className="inline-flex" aria-hidden>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-3 fill-amber-400 text-amber-400" />
                    ))}
                  </span>
                </div>
                {values.address.trim() && (
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" /> <span className="truncate">{values.address}</span>
                  </p>
                )}
              </div>
              {values.instagramUrl.trim() && <Icons.instagram className="size-4 shrink-0 text-muted-foreground" />}
            </div>
            {values.description.trim() ? (
              <p className="mt-2 line-clamp-3 text-xs text-pretty text-muted-foreground">{values.description}</p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground/60 italic">Sem descrição: escreva uma para apresentar a loja.</p>
            )}
          </div>
        </div>
        <p className="mt-2 truncate px-1 text-xs text-muted-foreground">
          Link: <span className="font-medium text-foreground">/{values.slug || "…"}</span>
        </p>
      </CardContent>
    </Card>
  );
}
