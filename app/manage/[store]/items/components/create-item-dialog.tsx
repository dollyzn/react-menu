"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { indexByStore } from "@/redux/slices/category";
import { indexByStore as indexAddonsByStore } from "@/redux/slices/addon";
import { store } from "@/redux/slices/item";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, PackagePlus, PlusCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import MoneyInput from "@/components/ui/money-input";

import { getErrorMessage } from "@/utils/get-error-message";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { z } from "zod";

const CreateItemSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  description: z.string().optional(),
  price: z
    .number()
    .min(0.01, "O preço é obrigatório e deve ser maior que zero."),
  categoryId: z.string().min(1, "A categoria é obrigatória"),
  addonIds: z.array(z.string()).optional(),
});

interface CreateItemDialogProps {
  storeId: string;
}

export function CreateItemDialog({ storeId }: CreateItemDialogProps) {
  const dispatch = useDispatch<AppDispatch>();
  const categories = useSelector(
    (state: RootState) => state.category.indexByStore.data
  );
  const addons = useSelector(
    (state: RootState) => state.addon.indexByStore.data
  );

  useEffect(() => {
    dispatch(indexByStore(storeId));
    dispatch(indexAddonsByStore(storeId));
  }, [dispatch, storeId]);

  const form = useForm<z.infer<typeof CreateItemSchema>>({
    resolver: zodResolver(CreateItemSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      categoryId: "",
      addonIds: [],
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
            <FormField
              control={form.control}
              name="addonIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adicionais</FormLabel>
                  <Popover modal>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start px-3"
                      >
                        <PackagePlus />
                        Selecione os adicionais
                        {!!field?.value?.length && field.value.length > 0 && (
                          <>
                            <Separator
                              orientation="vertical"
                              className="mx-2 h-4"
                            />
                            <Badge
                              variant="secondary"
                              className="rounded-sm px-1 font-normal lg:hidden"
                            >
                              {field.value.length}
                            </Badge>
                            <div className="hidden space-x-1 lg:flex">
                              {field.value.length > 2 ? (
                                <Badge
                                  variant="secondary"
                                  className="rounded-sm px-1 font-normal"
                                >
                                  {field.value.length} selecionados
                                </Badge>
                              ) : (
                                addons
                                  ?.filter((addon) =>
                                    field.value?.includes(addon.id)
                                  )
                                  .map((option) => (
                                    <Badge
                                      variant="secondary"
                                      key={option.id}
                                      className="rounded-sm px-1 font-normal"
                                    >
                                      {option.name}
                                    </Badge>
                                  ))
                              )}
                            </div>
                          </>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar adicionais..." />
                        <CommandList>
                          <CommandEmpty className="py-6 px-3 text-center text-sm">
                            Nenhum adicional encontrado.
                          </CommandEmpty>
                          <CommandGroup>
                            {addons?.map((addon) => {
                              const isSelected = field.value?.includes(
                                addon.id
                              );
                              return (
                                <CommandItem
                                  key={addon.id}
                                  value={addon.id}
                                  onSelect={() => {
                                    const newValue = isSelected
                                      ? field?.value?.filter(
                                          (id) => id !== addon.id
                                        )
                                      : [...(field.value || []), addon.id];
                                    field.onChange(newValue);
                                  }}
                                >
                                  <div
                                    className={cn(
                                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                      isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : "opacity-50 [&_svg]:invisible"
                                    )}
                                  >
                                    <Check />
                                  </div>
                                  <span>{addon.name}</span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
