"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useUpdateStoreImagesMutation } from "@/redux/features/store/storeApi";
import { setUser } from "@/redux/slices/auth";

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
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/utils/get-error-message";
import type { User as SessionUser } from "@/types/session";
import { z } from "zod";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const UpdatePhotoSchema = z.object({
  photo: z
    .instanceof(File, { message: "Selecione uma imagem." })
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: "O arquivo deve ter no máximo 2MB.",
    })
    .refine((file) => ACCEPTED_FILE_TYPES.includes(file.type), {
      message: "Apenas arquivos JPG, JPEG, PNG ou WEBP são permitidos.",
    }),
});

interface UpdatePhotoDialogProps {
  storeId: string;
}

export function UpdatePhotoDialog({ storeId }: UpdatePhotoDialogProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [updateImages, { isLoading: isSaving }] = useUpdateStoreImagesMutation();

  const form = useForm<z.infer<typeof UpdatePhotoSchema>>({
    resolver: zodResolver(UpdatePhotoSchema),
    defaultValues: {
      photo: undefined,
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

  const handleUpdatePhoto = async (data: z.infer<typeof UpdatePhotoSchema>) => {
    try {
      const payload = await updateImages({
        id: storeId,
        photo: data.photo,
      }).unwrap();
      handleOpenChange();

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
          "Ocorreu um erro ao atualizar a imagem da logo. Por favor, tente novamente."
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
        <Button
          variant="secondary"
          size="sm"
          className="absolute  -bottom-2 -right-2"
        >
          <Upload className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar Logo</DialogTitle>
          <DialogDescription>
            Escolha uma nova imagem da logo para a loja
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleUpdatePhoto)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="photo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="photo">Imagem da logo</FormLabel>
                  <FormControl>
                    <Input
                      id="photo"
                      type="file"
                      accept=".jpg, .jpeg, .png, .webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        field.onChange(file || null);
                      }}
                      disabled={busy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" loading={busy}>
                {busy ? "Atualizando..." : "Atualizar Logo"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
