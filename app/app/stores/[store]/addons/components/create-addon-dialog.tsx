"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateAddonMutation } from "@/redux/features/addon/addonApi";
import { toast } from "sonner";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import { z } from "zod";
import { getErrorMessage } from "@/utils/get-error-message";
import MoneyInput from "@/components/ui/money-input";

const CreateAddonSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  description: z.string().optional(),
  price: z
    .number()
    .min(0.01, "O preço é obrigatório e deve ser maior que zero."),
});

interface CreateAddonDialogProps {
  storeId: string;
}

export function CreateAddonDialog({ storeId }: CreateAddonDialogProps) {
  const [createAddon, { isLoading: isSaving }] = useCreateAddonMutation();

  const form = useForm<z.infer<typeof CreateAddonSchema>>({
    resolver: zodResolver(CreateAddonSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
    },
  });
  const { isSubmitting } = form.formState;
  const busy = isSubmitting || isSaving;

  const [open, setOpen] = useState(false);

  const handleOpenChange = () => {
    if (busy && open) return;
    setOpen(!open);
    form.reset();
  };

  const handleCreateAddon = async (data: z.infer<typeof CreateAddonSchema>) => {
    try {
      await createAddon({ storeId, data }).unwrap();
      handleOpenChange();
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err as { data?: { error?: string }; message?: string },
          "Ocorreu um erro ao criar o addon. Por favor, tente novamente."
        ),
        {
          richColors: true,
          closeButton: true,
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PlusCircle /> Criar adicional
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar novo adicional</DialogTitle>
          <DialogDescription>
            Preencha os campos para criar um novo adicional.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleCreateAddon)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="name">Nome</FormLabel>
                  <FormControl>
                    <Input id="name" {...field} disabled={busy} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="description">Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      id="description"
                      {...field}
                      disabled={busy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <MoneyInput
              form={form}
              label="Valor"
              name="price"
              placeholder="R$ 10,00"
            />
            <DialogFooter>
              <Button type="submit" loading={busy}>
                {busy ? "Criando..." : "Criar Addon"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
