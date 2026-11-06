"use client";

import { Badge } from "@/components/ui/badge";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

/**
 * Whether the category's items go to the kitchen display. Drinks and
 * ready-made products skip it: their orders don't wait for the kitchen.
 */
export function RequiresPreparationField({
  id = "requiresPreparation",
  checked,
  onCheckedChange,
  disabled,
}: {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Field orientation="horizontal">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      <FieldContent>
        <FieldLabel htmlFor={id}>Precisa de preparo</FieldLabel>
        <FieldDescription>
          Os itens vão para a tela da cozinha. Desligue para bebidas e produtos prontos: eles saem direto no balcão.
        </FieldDescription>
      </FieldContent>
    </Field>
  );
}

/** On categories whose items skip the kitchen. */
export function NoPrepBadge() {
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      Sem preparo
    </Badge>
  );
}
