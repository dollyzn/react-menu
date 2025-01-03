"use client";

import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppDispatch, RootState } from "@/redux/store";
import { updateImages } from "@/redux/slices/store";
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

export function UpdateBannerDialog({ storeId }: { storeId: string }) {
  const dispatch = useDispatch<AppDispatch>();

  const user = useSelector((state: RootState) => state.auth.user);

  const form = useForm<z.infer<typeof UpdateBannerSchema>>({
    resolver: zodResolver(UpdateBannerSchema),
    defaultValues: {
      banner: undefined,
    },
  });
  const { isSubmitting } = form.formState;

  const [open, setOpen] = useState(false);

  const handleOpenChange = () => {
    if (isSubmitting && open) return;
    setOpen(!open);
    form.reset();
  };

  const handleUpdateBanner = async (
    data: z.infer<typeof UpdateBannerSchema>
  ) => {
    const { banner } = data;

    const result = await dispatch(
      updateImages({
        id: storeId,
        banner,
      })
    );

    if (updateImages.fulfilled.match(result)) {
      handleOpenChange();

      if (user) {
        const updatedUser: User = {
          ...user,
          stores: user.stores.map((store) =>
            store.id === result.payload.id
              ? { ...store, ...result.payload }
              : store
          ),
        };

        dispatch(setUser(updatedUser));
      }
    }

    if (updateImages.rejected.match(result)) {
      toast.error(
        getErrorMessage(
          result.payload,
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
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" loading={isSubmitting}>
                {isSubmitting ? "Atualizando..." : "Atualizar Banner"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
