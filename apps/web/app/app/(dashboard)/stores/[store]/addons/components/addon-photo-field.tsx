"use client";

import { useWatch, type Control } from "react-hook-form";
import { Field, FieldDescription, FieldTitle } from "@/components/ui/field";
import { PhotoField, type PhotoChange } from "@/components/app/photo-field";

/** The add-on dialogs' "Foto": the option's square, previewed with the name and price being typed. */
export function AddonPhotoField({
  control,
  currentUrl,
  value,
  onChange,
  disabled,
}: {
  control: Control<{ name: string; price: number; description?: string }>;
  currentUrl: string | null;
  value: PhotoChange;
  onChange: (value: PhotoChange) => void;
  disabled?: boolean;
}) {
  const [name, price] = useWatch({ control, name: ["name", "price"] });
  return (
    <Field>
      <FieldTitle>Foto</FieldTitle>
      <PhotoField
        currentUrl={currentUrl}
        value={value}
        onChange={onChange}
        disabled={disabled}
        name={name}
        price={price}
        kind="option"
      />
      <FieldDescription>Opcional. Aparece ao lado da opção no cardápio e no PDV.</FieldDescription>
    </Field>
  );
}
