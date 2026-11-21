"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import type { PartnerInput, PartnerMemberRole, StoreRole } from "@react-menu/contracts";
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
import { PARTNER_ROLES, ROLES } from "./roles";
import { PartnerRuleFields, usePartnerForm } from "@/components/app/partner/partner-rule-fields";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetPartnersQuery } from "@/redux/features/partner/partnersApi";

/** "Novo parceiro" in the partner select. */
const NEW_PARTNER = "new";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Adds someone by e-mail: existing accounts are linked, new ones invited. */
export function AddMemberDialog({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StoreRole>("attendant");
  const [invalid, setInvalid] = useState(false);
  const [add, { isLoading }] = useAddMemberMutation();
  // Role "partner" (ADR 0024): the partner they sell for, or one created with the invite.
  const { data: partners = [] } = useGetPartnersQuery(storeId, { skip: !open });
  const [partnerId, setPartnerId] = useState<string | null>(null);
  // A partner created with the invite: its own form inside the dialog (checked on "Adicionar").
  const partnerForm = usePartnerForm();
  const [partnerMissing, setPartnerMissing] = useState(false);
  const [partnerRole, setPartnerRole] = useState<PartnerMemberRole>("attendant");
  const chosenPartner = partnerId ?? (partners.length ? null : NEW_PARTNER);
  const partnerItems = [
    ...partners.map((partner) => ({ value: partner.id, label: partner.name })),
    { value: NEW_PARTNER, label: "Novo parceiro…" },
  ];

  const reset = () => {
    setEmail("");
    setName("");
    setRole("attendant");
    setInvalid(false);
    setPartnerId(null);
    partnerForm.reset();
    setPartnerRole("attendant");
    setPartnerMissing(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setInvalid(true);
      return;
    }
    let partner: { partnerId?: string; newPartner?: PartnerInput; partnerRole?: PartnerMemberRole } = {};
    if (role === "partner") {
      if (!chosenPartner) {
        setPartnerMissing(true);
        return;
      }
      if (chosenPartner === NEW_PARTNER) {
        if (!(await partnerForm.trigger())) return;
        const values = partnerForm.getValues();
        partner = { newPartner: { ...values, name: values.name.trim() }, partnerRole };
      } else {
        partner = { partnerId: chosenPartner, partnerRole };
      }
    }
    try {
      const member = await add({
        storeId,
        data: { email: email.trim(), name: name.trim() || undefined, role, ...partner },
      }).unwrap();
      toast.success(
        member.invited
          ? `Convite enviado para ${member.email}`
          : `${member.name ?? member.email} entrou na equipe`
      );
      setOpen(false);
    } catch {
      // baseApi shows the reason (e.g. already in the team).
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      // Cleared once closed: resetting during the exit animation flickers.
      onOpenChangeComplete={(next) => !next && reset()}
    >
      <DialogTrigger render={<Button />}>
        <UserPlus /> Adicionar pessoa
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Adicionar à equipe</DialogTitle>
            <DialogDescription>
              Quem já tem conta entra na hora. Quem é novo recebe um convite por e-mail, válido por 7 dias: o link confirma o endereço e cria a senha.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="member-name">Nome (opcional)</FieldLabel>
                <Input
                  id="member-name"
                  autoFocus
                  autoComplete="off"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Como chamamos no painel"
                />
                <FieldDescription>Usado no convite de quem ainda não tem conta.</FieldDescription>
              </Field>
              <Field data-invalid={invalid}>
                <FieldLabel htmlFor="member-email">E-mail</FieldLabel>
                <Input
                  id="member-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="pessoa@exemplo.com"
                  aria-invalid={invalid}
                />
                {invalid && <FieldError>Informe um e-mail válido.</FieldError>}
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
              {role === "partner" && (
                <FieldSet>
                  <FieldLegend variant="label">Parceiro</FieldLegend>
                  <Field data-invalid={partnerMissing}>
                    <FieldLabel htmlFor="member-partner">Vende para</FieldLabel>
                    <Select
                      items={partnerItems}
                      value={chosenPartner}
                      onValueChange={(value) => {
                        setPartnerId(value as string | null);
                        setPartnerMissing(false);
                      }}
                    >
                      <SelectTrigger id="member-partner" className="w-full" aria-invalid={partnerMissing}>
                        <SelectValue placeholder="Escolha o parceiro" />
                      </SelectTrigger>
                      <SelectContent>
                        {partnerItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>A pessoa vê só as vendas e a comissão desse parceiro.</FieldDescription>
                    {partnerMissing && <FieldError>Escolha o parceiro.</FieldError>}
                  </Field>
                  <RadioGroup
                    name="member-partner-role"
                    aria-label="Função no parceiro"
                    value={partnerRole}
                    onValueChange={(value) => setPartnerRole(value as PartnerMemberRole)}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    {(Object.keys(PARTNER_ROLES) as PartnerMemberRole[]).map((value) => (
                      <FieldLabel key={value} htmlFor={`member-partner-role-${value}`}>
                        <Field orientation="horizontal">
                          <FieldContent>
                            <FieldTitle>{PARTNER_ROLES[value].label}</FieldTitle>
                            <FieldDescription>{PARTNER_ROLES[value].description}</FieldDescription>
                          </FieldContent>
                          <RadioGroupItem value={value} id={`member-partner-role-${value}`} />
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                  {chosenPartner === NEW_PARTNER && (
                    <PartnerRuleFields form={partnerForm} disabled={isLoading} idPrefix="invite-partner" />
                  )}
                </FieldSet>
              )}
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
