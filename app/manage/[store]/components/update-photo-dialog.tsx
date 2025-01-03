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
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/utils/get-error-message";
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

export function UpdatePhotoDialog({ storeId }: { storeId: string }) {
  const dispatch = useDispatch<AppDispatch>();

  const user = useSelector((state: RootState) => state.auth.user);

  const form = useForm<z.infer<typeof UpdatePhotoSchema>>({
    resolver: zodResolver(UpdatePhotoSchema),
    defaultValues: {
      photo: undefined,
    },
  });
  const { isSubmitting } = form.formState;

  const [open, setOpen] = useState(false);

  const handleOpenChange = () => {
    if (isSubmitting && open) return;
    setOpen(!open);
    form.reset();
  };

  const handleUpdatePhoto = async (data: z.infer<typeof UpdatePhotoSchema>) => {
    const { photo } = data;

    const result = await dispatch(
      updateImages({
        id: storeId,
        photo,
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
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" loading={isSubmitting}>
                {isSubmitting ? "Atualizando..." : "Atualizar Logo"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
