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
import { Camera } from "lucide-react";
import { toast } from "sonner";

import { z } from "zod";
import { getErrorMessage } from "@/utils/get-error-message";
import type { User as SessionUser } from "@/types/session";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const UpdateBannerSchema = z.object({
  banner: z
    .instanceof(File, { message: "Selecione uma imagem." })
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: "O arquivo deve ter no máximo 2MB.",
    })
    .refine((file) => ACCEPTED_FILE_TYPES.includes(file.type), {
      message: "Apenas arquivos JPG, JPEG, PNG ou WEBP são permitidos.",
    }),
});

interface UpdateBannerDialogProps {
  storeId: string;
}

export function UpdateBannerDialog({ storeId }: UpdateBannerDialogProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [updateImages, { isLoading: isSaving }] = useUpdateStoreImagesMutation();

  const form = useForm<z.infer<typeof UpdateBannerSchema>>({
    resolver: zodResolver(UpdateBannerSchema),
    defaultValues: {
      banner: undefined,
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

  const handleUpdateBanner = async (
    data: z.infer<typeof UpdateBannerSchema>
  ) => {
    try {
      const payload = await updateImages({
        id: storeId,
        banner: data.banner,
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
          "Ocorreu um erro ao atualizar a imagem do banner. Por favor, tente novamente."
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
          className="absolute bottom-4 right-4"
        >
          <Camera className="mr-2 h-4 w-4" />
          Alterar Banner
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar Imagem do Banner</DialogTitle>
          <DialogDescription>
            Escolha uma nova imagem do banner para a loja
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleUpdateBanner)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="banner"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="banner">Imagem do Banner</FormLabel>
                  <FormControl>
                    <Input
                      id="banner"
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
                {busy ? "Atualizando..." : "Atualizar Banner"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
