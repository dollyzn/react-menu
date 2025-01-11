"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppDispatch, RootState } from "@/redux/store";
import { store } from "@/redux/slices/item";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { indexByStore } from "@/redux/slices/category";

const CreateItemSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  description: z.string().optional(),
  price: z
    .number()
    .min(0.01, "O preço é obrigatório e deve ser maior que zero."),
  categoryId: z.string().min(1, "A categoria é obrigatória"),
});

interface CreateItemDialogProps {
  storeId: string;
}

export function CreateItemDialog({ storeId }: CreateItemDialogProps) {
  const dispatch = useDispatch<AppDispatch>();
  const categories = useSelector(
    (state: RootState) => state.category.indexByStore.data
  );

  useEffect(() => {
    dispatch(indexByStore(storeId));
  }, [dispatch, storeId]);

  const form = useForm<z.infer<typeof CreateItemSchema>>({
    resolver: zodResolver(CreateItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      categoryId: "",
    },
  });
  const { isSubmitting } = form.formState;

  const [open, setOpen] = useState(false);

  const handleOpenChange = () => {
    if (isSubmitting && open) return;
    setOpen(!open);
    form.reset();
  };

  const handleCreateItem = async (data: z.infer<typeof CreateItemSchema>) => {
    const { categoryId, ...formData } = data;

    const result = await dispatch(store({ id: categoryId, data: formData }));

    if (store.fulfilled.match(result)) {
      handleOpenChange();
    }

    if (store.rejected.match(result)) {
      toast.error(
        getErrorMessage(
          result.payload,
          "Ocorreu um erro ao criar o item. Por favor, tente novamente."
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
          <PlusCircle /> Criar item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar novo item</DialogTitle>
          <DialogDescription>
            Preencha os campos para criar um novo item.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleCreateItem)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="name">Nome do Item</FormLabel>
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="categoryId">Categoria</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        {categories?.map((category) => (
                          <SelectItem
                            key={category.id}
                            value={category.id.toString()}
                          >
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
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
              <Button type="submit" loading={isSubmitting}>
                {isSubmitting ? "Criando..." : "Criar Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
