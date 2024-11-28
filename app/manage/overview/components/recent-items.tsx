import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

export function RecentItems() {
  return (
    <ScrollArea className="h-[400px] p-6 py-0">
      <div className="space-y-8">
        <div className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/placeholder.svg" alt="Avatar" />
            <AvatarFallback>PB</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Pizza Margherita</p>
            <p className="text-sm text-muted-foreground">
              Pizzaria Bella Napoli
            </p>
          </div>
          <div className="ml-auto font-medium">R$ 35,90</div>
        </div>
        <div className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/placeholder.svg" alt="Avatar" />
            <AvatarFallback>BH</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">
              Hambúrguer Artesanal
            </p>
            <p className="text-sm text-muted-foreground">Burger House</p>
          </div>
          <div className="ml-auto font-medium">R$ 28,90</div>
        </div>
        <div className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/placeholder.svg" alt="Avatar" />
            <AvatarFallback>SE</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Combo Sushi</p>
            <p className="text-sm text-muted-foreground">Sushi Express</p>
          </div>
          <div className="ml-auto font-medium">R$ 89,90</div>
        </div>
        <div className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/placeholder.svg" alt="Avatar" />
            <AvatarFallback>PS</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Pastel de Frango</p>
            <p className="text-sm text-muted-foreground">Pastelaria do Sul</p>
          </div>
          <div className="ml-auto font-medium">R$ 8,90</div>
        </div>
        <div className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/placeholder.svg" alt="Avatar" />
            <AvatarFallback>DC</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Açaí 500ml</p>
            <p className="text-sm text-muted-foreground">Delícias Congeladas</p>
          </div>
          <div className="ml-auto font-medium">R$ 18,90</div>
        </div>
        <div className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/placeholder.svg" alt="Avatar" />
            <AvatarFallback>DC</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Açaí 500ml</p>
            <p className="text-sm text-muted-foreground">Delícias Congeladas</p>
          </div>
          <div className="ml-auto font-medium">R$ 18,90</div>
        </div>
        <div className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/placeholder.svg" alt="Avatar" />
            <AvatarFallback>DC</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Açaí 500ml</p>
            <p className="text-sm text-muted-foreground">Delícias Congeladas</p>
          </div>
          <div className="ml-auto font-medium">R$ 18,90</div>
        </div>
        <div className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/placeholder.svg" alt="Avatar" />
            <AvatarFallback>DC</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Açaí 500ml</p>
            <p className="text-sm text-muted-foreground">Delícias Congeladas</p>
          </div>
          <div className="ml-auto font-medium">R$ 18,90</div>
        </div>
        <div className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/placeholder.svg" alt="Avatar" />
            <AvatarFallback>DC</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Açaí 500ml</p>
            <p className="text-sm text-muted-foreground">Delícias Congeladas</p>
          </div>
          <div className="ml-auto font-medium">R$ 18,90</div>
        </div>
      </div>
    </ScrollArea>
  );
}
