"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useUpdateStoreMutation } from "@/redux/features/store/storeApi";
import { setUser } from "@/redux/slices/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
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
});

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
          stores: user.stores.map((s: Store) =>
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
          <DialogTitle>Editar Informações da Loja</DialogTitle>
          <DialogDescription>
            Atualize as informações básicas da sua loja
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Loja</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Nome da Loja"
                        disabled={busy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Endereço"
                        disabled={busy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instagramUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Instagram</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://www.instagram.com/sualoja"
                        disabled={busy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ifoodUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do iFood</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://www.ifood.com.br/sualoja"
                        disabled={busy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="slug-da-loja"
                        disabled={busy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" loading={busy}>
                {busy ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
