"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import type { StoreRole } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useAddMemberMutation } from "@/redux/features/store/membersApi";
import { ROLES } from "./roles";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Adds someone by e-mail: existing accounts are linked, new ones invited. */
export function AddMemberDialog({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StoreRole>("attendant");
  const [invalid, setInvalid] = useState(false);
  const [add, { isLoading }] = useAddMemberMutation();

  const reset = () => {
    setEmail("");
    setName("");
    setRole("attendant");
    setInvalid(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setInvalid(true);
      return;
    }
    try {
      const member = await add({
        storeId,
        data: { email: email.trim(), name: name.trim() || undefined, role },
      }).unwrap();
      toast.success(
        member.invited
          ? `Convite enviado para ${member.email}`
          : `${member.name ?? member.email} entrou na equipe`
      );
      reset();
      setOpen(false);
    } catch {
      // baseApi shows the reason (e.g. already in the team).
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button />}>
        <UserPlus /> Adicionar pessoa
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Adicionar à equipe</DialogTitle>
            <DialogDescription>
              Quem já tem conta entra na hora. Para quem é novo, enviamos um convite por e-mail para criar a senha.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FieldGroup>
              <Field data-invalid={invalid}>
                <FieldLabel htmlFor="member-email">E-mail</FieldLabel>
                <Input
                  id="member-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="pessoa@exemplo.com"
                  aria-invalid={invalid}
                />
                {invalid && <FieldError>Informe um e-mail válido.</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="member-name">Nome (opcional)</FieldLabel>
                <Input
                  id="member-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Como chamamos no painel"
                />
                <FieldDescription>Usado no convite de quem ainda não tem conta.</FieldDescription>
              </Field>
              <FieldSet>
                <FieldLegend variant="label">Função</FieldLegend>
                <RadioGroup name="member-role" value={role} onValueChange={(value) => setRole(value as StoreRole)}>
                  {(Object.keys(ROLES) as StoreRole[]).map((value) => {
                    const { label, description, icon: Icon } = ROLES[value];
                    return (
                      <FieldLabel key={value} htmlFor={`member-role-${value}`}>
                        <Field orientation="horizontal">
                          <Icon className="size-4 shrink-0 self-start text-primary" />
                          <FieldContent>
                            <FieldTitle>{label}</FieldTitle>
                            <FieldDescription>{description}</FieldDescription>
                          </FieldContent>
                          <RadioGroupItem value={value} id={`member-role-${value}`} />
                        </Field>
                      </FieldLabel>
                    );
                  })}
                </RadioGroup>
              </FieldSet>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isLoading}>
              Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
