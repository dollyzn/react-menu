"use client";

import { Row } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUpdateCategoryMutation } from "@/redux/features/category/categoryApi";
import { toast } from "sonner";

import {
  Dialog,
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

import { getErrorMessage } from "@/utils/get-error-message";
import { z } from "zod";

const UpdateCategorySchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  description: z.string().nullish(),
});

interface UpdateCategoryDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  row: Row<Category>;
}

export function UpdateCategoryDialog({
  open,
  onOpenChange,
  row,
}: UpdateCategoryDialogProps) {
  const [updateCategory, { isLoading: isSaving }] = useUpdateCategoryMutation();

  const form = useForm<z.infer<typeof UpdateCategorySchema>>({
    resolver: zodResolver(UpdateCategorySchema),
    values: {
      name: row.getValue("name"),
      description: row.getValue("description"),
    },
  });
  const { isSubmitting } = form.formState;
  const busy = isSubmitting || isSaving;

  const handleOpenChange = () => {
    if (busy && open) return;
    onOpenChange(!open);
    form.reset();
  };

  const handleUpdateCategory = async (
    data: z.infer<typeof UpdateCategorySchema>
  ) => {
    try {
      await updateCategory({
        id: row.original.id,
        data,
      }).unwrap();
      handleOpenChange();
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err as { data?: { error?: string }; message?: string },
          `Ocorreu um erro ao editar a categoria ${row.getValue(
            "name"
          )}. Por favor, tente novamente.`
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar categoria</DialogTitle>
          <DialogDescription>
            Atualize as informações da categoria.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleUpdateCategory)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="name">Nome da Categoria</FormLabel>
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
                      value={field.value as string | undefined}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" loading={busy}>
                {busy ? "Salvando..." : "Editar Categoria"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
