import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DataTable } from "@/components/data-table";
import items from "./items.json";
import { columns, columnsConfig } from "./components/columns";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Items() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/manage">Loja</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Items</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Dialog>
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
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do Item</Label>
                <Input id="name" defaultValue="Pastéis Simples" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Descrição</Label>
                <Textarea id="address" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Criar Item</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable data={items} columns={columns} columnsConfig={columnsConfig} />
    </div>
  );
}
