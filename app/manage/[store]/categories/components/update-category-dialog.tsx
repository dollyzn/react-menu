"use client";

import { Row } from "@tanstack/react-table";

import { useDispatch } from "react-redux";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppDispatch } from "@/redux/store";
import { update } from "@/redux/slices/category";
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
  const dispatch = useDispatch<AppDispatch>();

  const form = useForm<z.infer<typeof UpdateCategorySchema>>({
    resolver: zodResolver(UpdateCategorySchema),
    values: {
      name: row.getValue("name"),
      description: row.getValue("description"),
    },
  });
  const { isSubmitting } = form.formState;

  const handleOpenChange = () => {
    if (isSubmitting && open) return;
    onOpenChange(!open);
    form.reset();
  };

  const handleUpdateCategory = async (
    data: z.infer<typeof UpdateCategorySchema>
  ) => {
    const result = await dispatch(
      update({
        id: row.original.id,
        data,
      })
    );

    if (update.fulfilled.match(result)) {
      handleOpenChange();
    }

    if (update.rejected.match(result)) {
      toast.error(
        getErrorMessage(
          result.payload,
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
                    <Input id="name" {...field} disabled={isSubmitting} />
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
                      disabled={isSubmitting}
                      value={field.value as string | undefined}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" loading={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Editar Categoria"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
