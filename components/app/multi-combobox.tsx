"use client";

import * as React from "react";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";

type BaseItem = {
  value: string;
  label: string;
};

type MultiComboboxProps<T> = {
  id?: string;

  items: T[];
  value: string[];
  onChange: (next: string[]) => void;

  getValue: (item: T) => string;
  getLabel: (item: T) => string;

  placeholder?: string;
  emptyMessage?: string;

  disabled?: boolean;
  invalid?: boolean;
};

export default function MultiCombobox<T>({
  id,
  items,
  value,
  onChange,
  getValue,
  getLabel,
  placeholder = "",
  emptyMessage = "Nenhum item encontrado",
  disabled = false,
  invalid = false,
}: MultiComboboxProps<T>) {
  const anchor = useComboboxAnchor();

  const normalizedItems: BaseItem[] = React.useMemo(
    () =>
      items.map((item) => ({
        value: getValue(item),
        label: getLabel(item),
      })),
    [items, getValue, getLabel]
  );

  return (
    <Combobox<BaseItem, true>
      id={id}
      multiple
      items={normalizedItems}
      value={normalizedItems.filter((item) => value.includes(item.value))}
      onValueChange={(vals) => onChange(vals.map((v) => v.value))}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor} className="w-full" data-disabled={disabled}>
        <ComboboxValue>
          {(values: BaseItem[]) => (
            <>
              {values.map((v) => (
                <ComboboxChip key={v.value}>{v.label}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                placeholder={values.length > 0 ? undefined : placeholder}
                aria-invalid={invalid}
                disabled={disabled}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>

      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>

        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
