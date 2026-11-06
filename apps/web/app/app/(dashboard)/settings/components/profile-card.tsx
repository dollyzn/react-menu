"use client";

import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Lock, Trash2, UserRound } from "lucide-react";
import type { StoreRole } from "@react-menu/contracts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { avatarInitials, avatarUrl } from "@/lib/avatar";
import { compressImage, ImageCompressError } from "@/lib/image-compress";
import { useRemoveAvatarMutation, useSetAvatarMutation, useUpdateProfileMutation } from "@/redux/features/account/accountApi";
import type { User } from "@/types/session";
import { getErrorMessage } from "@/utils/get-error-message";

const ROLE_LABEL: Record<StoreRole, string> = { manager: "Gerente", attendant: "Atendente", kitchen: "Cozinha" };

const Schema = z.object({
  name: z.string().trim().min(2, "Pelo menos 2 letras.").max(80, "No máximo 80 caracteres."),
});

/** Photo (upload, or the generated avatar), name, and the stores the user works at. */
export function ProfileCard({ user }: { user: User }) {
  const input = useRef<HTMLInputElement>(null);
  const [setAvatar, uploading] = useSetAvatarMutation();
  const [removeAvatar, removing] = useRemoveAvatarMutation();
  const [updateProfile, saving] = useUpdateProfileMutation();
  const [preparing, setPreparing] = useState(false);
  const busyPhoto = preparing || uploading.isLoading || removing.isLoading;

  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    values: { name: user.name ?? "" },
  });

  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    setPreparing(true);
    try {
      // A square of at most 512px: the avatar is a circle a few dozen pixels wide.
      const blob = await compressImage(file, { maxSide: 512, square: true });
      await setAvatar(blob).unwrap();
      toast.success("Foto atualizada");
    } catch (error) {
      toast.error(
        error instanceof ImageCompressError ? error.message : getErrorMessage(error, "Não foi possível trocar a foto.")
      );
    } finally {
      setPreparing(false);
    }
  };

  const remove = async () => {
    try {
      await removeAvatar().unwrap();
      toast.success("Foto removida");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível remover a foto."));
    }
  };

  const submit = form.handleSubmit(async ({ name }) => {
    try {
      await updateProfile({ name }).unwrap();
      toast.success("Perfil atualizado");
    } catch (error) {
      form.setError("name", { message: getErrorMessage(error, "Não foi possível salvar.") });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="text-primary" /> Perfil
        </CardTitle>
        <CardDescription>Como você aparece para a equipe no painel.</CardDescription>
      </CardHeader>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => void pick(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busyPhoto}
              aria-label="Trocar foto de perfil"
              className="group relative shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait"
            >
              <Avatar className="size-20">
                <AvatarImage src={avatarUrl(user)} alt="" />
                <AvatarFallback className="text-lg">{avatarInitials(user)}</AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Camera aria-hidden />
              </span>
              <AnimatePresence>
                {busyPhoto && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70"
                  >
                    <Spinner aria-hidden />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} disabled={busyPhoto}>
                  <Camera data-icon="inline-start" /> {user.avatarUrl ? "Trocar foto" : "Enviar foto"}
                </Button>
                {user.avatarUrl && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void remove()} disabled={busyPhoto}>
                    <Trash2 data-icon="inline-start" /> Remover
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {user.avatarUrl ? "JPG, PNG ou WebP. Ela fica leve sozinha." : "Sem foto, usamos um avatar gerado pelo seu nome."}
              </p>
            </div>
          </div>

          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="profile-name">Nome</FieldLabel>
                  <Input {...field} id="profile-name" autoComplete="name" placeholder="Como você aparece no painel" aria-invalid={fieldState.invalid} disabled={saving.isLoading} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Field>
              <FieldLabel htmlFor="profile-email">E-mail</FieldLabel>
              <InputGroup>
                <InputGroupInput id="profile-email" value={user.email} readOnly />
                <InputGroupAddon align="inline-end">
                  <Lock aria-hidden />
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>É o seu login. Para trocar, fale com um administrador.</FieldDescription>
            </Field>
          </FieldGroup>

          {(user.superUser || user.stores.length > 0) && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Onde você trabalha</p>
              <ul className="divide-y rounded-xl border text-sm">
                {user.superUser && (
                  <li className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>Todas as lojas</span>
                    <Badge variant="secondary">Administrador</Badge>
                  </li>
                )}
                {user.stores.map((store) => (
                  <li key={store.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="truncate">{store.name}</span>
                    <span className="text-muted-foreground">{ROLE_LABEL[store.role]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="ghost" disabled={!form.formState.isDirty || saving.isLoading} onClick={() => form.reset()}>
            Desfazer alterações
          </Button>
          <Button type="submit" loading={saving.isLoading} disabled={!form.formState.isDirty}>
            Salvar
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
