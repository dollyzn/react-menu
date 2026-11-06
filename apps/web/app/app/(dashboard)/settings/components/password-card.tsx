"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { useChangePasswordMutation } from "@/redux/features/account/accountApi";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";

const Schema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    password: z.string().min(8, "Pelo menos 8 caracteres.").max(512),
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "As senhas não conferem.",
  })
  .refine((values) => values.password !== values.currentPassword, {
    path: ["password"],
    message: "Escolha uma senha diferente da atual.",
  });

type Values = z.infer<typeof Schema>;
const EMPTY: Values = { currentPassword: "", password: "", passwordConfirmation: "" };

const FIELDS: { name: keyof Values; label: string; placeholder: string; autoComplete: string }[] = [
  { name: "currentPassword", label: "Senha atual", placeholder: "Digite a sua senha atual", autoComplete: "current-password" },
  { name: "password", label: "Nova senha", placeholder: "Digite uma nova senha", autoComplete: "new-password" },
  { name: "passwordConfirmation", label: "Confirme a nova senha", placeholder: "Digite a nova senha de novo", autoComplete: "new-password" },
];

/** Current password, new one twice. The other sessions end when it changes. */
export function PasswordCard() {
  const [change, changing] = useChangePasswordMutation();
  const [visible, setVisible] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: EMPTY });
  const password = useWatch({ control: form.control, name: "password" }) ?? "";

  const rules = [
    { ok: password.length >= 8, label: "8 ou mais caracteres" },
    { ok: /[a-zA-Z]/.test(password) && /\d/.test(password), label: "Letras e números" },
  ];

  const submit = form.handleSubmit(async (values) => {
    try {
      await change(values).unwrap();
      form.reset(EMPTY);
      toast.success("Senha alterada", { description: "Saímos da sua conta nos outros aparelhos." });
    } catch (error) {
      const message = getErrorMessage(error, "Não foi possível alterar a senha.");
      if ((error as { data?: { code?: string } }).data?.code === "E_WRONG_PASSWORD") {
        form.setError("currentPassword", { message }, { shouldFocus: true });
      } else {
        form.setError("root", { message });
      }
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="text-primary" /> Senha
        </CardTitle>
        <CardDescription>Ao trocar, você continua neste aparelho e sai dos outros.</CardDescription>
      </CardHeader>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <CardContent>
          <FieldGroup>
            {FIELDS.map(({ name, label, placeholder, autoComplete }) => (
              <Controller
                key={name}
                name={name}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`password-${name}`}>{label}</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        {...field}
                        id={`password-${name}`}
                        type={visible ? "text" : "password"}
                        autoComplete={autoComplete}
                        placeholder={placeholder}
                        aria-invalid={fieldState.invalid}
                        disabled={changing.isLoading}
                      />
                      {name === "currentPassword" && (
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            size="icon-xs"
                            aria-label={visible ? "Esconder senhas" : "Mostrar senhas"}
                            onClick={() => setVisible((value) => !value)}
                          >
                            {visible ? <EyeOff /> : <Eye />}
                          </InputGroupButton>
                        </InputGroupAddon>
                      )}
                    </InputGroup>
                    {name === "password" && password.length > 0 && (
                      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Requisitos da senha">
                        {rules.map((rule) => (
                          <li
                            key={rule.label}
                            className={cn("flex items-center gap-1 transition-colors", rule.ok ? "text-success" : "text-muted-foreground")}
                          >
                            <Check aria-hidden className={cn("size-3 transition-opacity", !rule.ok && "opacity-30")} />
                            {rule.label}
                            {rule.label === "Letras e números" && <span className="sr-only">(recomendado)</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            ))}
            {form.formState.errors.root?.message && (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="ghost" disabled={!form.formState.isDirty || changing.isLoading} onClick={() => form.reset(EMPTY)}>
            Limpar
          </Button>
          <Button type="submit" loading={changing.isLoading} disabled={!form.formState.isDirty}>
            Alterar senha
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
