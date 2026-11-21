"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Handshake } from "lucide-react";
import { PartnerRuleFields, usePartnerForm } from "@/components/app/partner/partner-rule-fields";
import type { PartnerFormValues } from "@/components/app/partner/partner-rules";
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
import { useCreatePartnerMutation } from "@/redux/features/partner/partnersApi";

/** "Novo parceiro": name and rules first; the people are invited from the partner's page or Equipe. */
export function CreatePartnerDialog({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = usePartnerForm();
  const [create, { isLoading }] = useCreatePartnerMutation();

  const submit = async (values: PartnerFormValues) => {
    try {
      const partner = await create({ storeId, input: { ...values, name: values.name.trim() } }).unwrap();
      toast.success(`${partner.name} cadastrado`);
      setOpen(false);
      router.push(`/app/stores/${storeId}/partners/${partner.id}`);
    } catch {
      // baseApi shows the reason (e.g. the name is taken).
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(next) => !next && form.reset()}
    >
      <DialogTrigger render={<Button />}>
        <Handshake /> Novo parceiro
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={form.handleSubmit(submit)} noValidate>
          <DialogHeader>
            <DialogTitle>Novo parceiro</DialogTitle>
            <DialogDescription>
              Quem vende o cardápio da loja para os próprios clientes, na maquininha que a loja emprestar.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <PartnerRuleFields form={form} disabled={isLoading} idPrefix="new-partner" />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isLoading}>
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
