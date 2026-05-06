"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

type MoneyInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange"
> & {
  value?: number;
  onChange?: (value: number) => void;
};

export default function MoneyInput({
  value,
  onChange,
  onBlur,
  ...props
}: MoneyInputProps) {
  const format = (value?: number) => {
    if (value === undefined || value === null) return "";
    return moneyFormatter.format(value);
  };

  const parse = (formatted: string) => {
    const digits = formatted.replace(/\D/g, "");
    return Number(digits) / 100;
  };

  const display = format(value);

  return (
    <Input
      {...props}
      inputMode="numeric"
      value={display}
      onChange={(e) => {
        const raw = e.target.value;

        const parsed = parse(raw);
        onChange?.(parsed);

      }}
      onBlur={onBlur}
    />
  );
}
