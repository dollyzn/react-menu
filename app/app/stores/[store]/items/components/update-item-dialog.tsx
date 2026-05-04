"use client";

import { Row } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useGetCategoriesByStoreIdQuery } from "@/redux/features/category/categoryApi";
import { useGetAddonsByStoreIdQuery } from "@/redux/features/addon/addonApi";
import { useGetAddonsByItemIdQuery } from "@/redux/features/addon/addonApi";
import { useUpdateItemMutation } from "@/redux/features/item/itemApi";

import {
  Dialog,
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
import { Check, Loader2, PackagePlus } from "lucide-react";
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

const UpdateItemSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  description: z.string().nullish(),
  price: z
    .number()
    .min(0.01, "O preço é obrigatório e deve ser maior que zero."),
  categoryId: z.string().min(1, "A categoria é obrigatória"),
  addonIds: z.array(z.string()).optional(),
});

interface UpdateItemDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  row: Row<Item>;
}

export function UpdateItemDialog({
  open,
  onOpenChange,
  row,
}: UpdateItemDialogProps) {
  const { store } = useParams();
  const storeId = store as string;

  const { data: categories } = useGetCategoriesByStoreIdQuery(storeId);
  const { data: addons } = useGetAddonsByStoreIdQuery(storeId);
  const { data: itemAddons = [], isFetching: itemAddonsLoading } =
    useGetAddonsByItemIdQuery(
      { storeId, itemId: row.original.id },
      { skip: !open }
    );

  const [updateItem, { isLoading: isSaving }] = useUpdateItemMutation();

  const form = useForm<z.infer<typeof UpdateItemSchema>>({
    resolver: zodResolver(UpdateItemSchema),
    values: {
      name: row.getValue("name"),
      description: row.getValue("description"),
      price: row.getValue("price"),
      categoryId: (row.original.category?.id || "").toString(),
      addonIds: itemAddons.map((addon) => addon.id),
    },
  });
  const { isSubmitting } = form.formState;
  const busy = isSubmitting || isSaving;

  const handleOpenChange = () => {
    if (busy && open) return;
    onOpenChange(!open);
    form.reset();
  };

  const handleUpdateItem = async (data: z.infer<typeof UpdateItemSchema>) => {
    try {
      await updateItem({
        storeId,
        itemId: row.original.id,
        data: { ...data, categoryId: Number(data.categoryId) },
      }).unwrap();
      handleOpenChange();
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(
          err as { data?: { error?: string }; message?: string },
          `Ocorreu um erro ao editar o item ${row.getValue(
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
          <DialogTitle>Editar item</DialogTitle>
          <DialogDescription>
            Atualize as informações do item.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleUpdateItem)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="name">Nome do Item</FormLabel>
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
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="categoryId">Categoria</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={busy}
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
                        disabled={itemAddonsLoading}
                      >
                        <PackagePlus />
                        Selecione os adicionais
                        {itemAddonsLoading ? (
                          <>
                            <Separator
                              orientation="vertical"
                              className="mx-2 h-4"
                            />
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </>
                        ) : (
                          !!field?.value?.length &&
                          field.value.length > 0 && (
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
                          )
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
              <Button
                type="submit"
                loading={busy}
                disabled={itemAddonsLoading}
              >
                {busy ? "Salvando..." : "Editar Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
