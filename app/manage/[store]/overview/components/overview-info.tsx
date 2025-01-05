import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OverviewInfoProps {
  className?: string;
}

export function OverviewInfo({ className }: OverviewInfoProps) {
  return (
    <div className={className}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Acessos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">+248</div>
          <p className="text-xs text-muted-foreground">+8 na última hora</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Categorias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">12</div>
          <p className="text-xs text-muted-foreground">+2 desde o último mês</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">+156</div>
          <p className="text-xs text-muted-foreground">
            +12 desde a última semana
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Adicionais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">+892</div>
          <p className="text-xs text-muted-foreground">+24 desde ontem</p>
        </CardContent>
      </Card>
    </div>
  );
}
