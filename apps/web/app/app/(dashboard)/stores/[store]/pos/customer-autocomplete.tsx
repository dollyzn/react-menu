"use client";

import { useEffect, useId, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, UserCheck, X } from "lucide-react";
import type { CustomerSuggestion } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearchCustomersQuery } from "@/redux/features/order/orderApi";
import { formatPhoneBR } from "@/utils/string";
import { cn } from "@/lib/utils";

const nationalPhone = (phone: string) => formatPhoneBR(phone.replace(/^55/, ""));

/** Enough to search: 2+ letters or 3+ digits (part of a phone). */
const searchable = (term: string) => term.trim().length >= 2 || term.replace(/\D/g, "").length >= 3;

/**
 * Customer name with suggestions from the store's customers (by name or part
 * of the phone). Picking one fills the name and the phone; editing the name
 * afterwards unpicks it (the parent clears the phone it filled), and the ✕
 * clears both. Keyboard: ↑/↓ move, Enter picks, Esc closes.
 */
export function CustomerAutocomplete({
  storeId,
  name,
  onPick,
  onUnpick,
  onNameChange,
  onClear,
}: {
  storeId: string;
  name: string;
  onNameChange: (name: string) => void;
  onPick: (customer: { name: string; phone: string }) => void;
  /** The picked customer was edited away: drop what was filled for them. */
  onUnpick: (customer: { name: string; phone: string }) => void;
  /** ✕: empty name and phone. */
  onClear: () => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<{ name: string; phone: string } | null>(null);
  const isPicked = picked !== null && picked.name === name;

  // Debounced search term (no request per keystroke).
  useEffect(() => {
    const timer = setTimeout(() => setTerm(name), 250);
    return () => clearTimeout(timer);
  }, [name]);

  // `data`, not `currentData`: keep the last results while the next term
  // loads, so the list doesn't vanish (and ignore Enter) on every keystroke.
  const { data: suggestions = [], isFetching } = useSearchCustomersQuery(
    { storeId, search: term },
    { skip: !searchable(term) || isPicked }
  );
  const visible = open && searchable(name) && !isPicked && suggestions.length > 0;

  const pick = (customer: CustomerSuggestion) => {
    const chosen = { name: customer.name, phone: nationalPhone(customer.phone) };
    onPick(chosen);
    setPicked(chosen);
    setOpen(false);
  };

  const changeName = (value: string) => {
    onNameChange(value);
    if (picked && value !== picked.name) {
      onUnpick(picked);
      setPicked(null);
    }
    setOpen(true);
    setActive(0);
  };

  const clear = () => {
    setPicked(null);
    onClear();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!visible) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(suggestions[Math.min(active, suggestions.length - 1)]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <>
      <div className="relative">
        {isPicked ? (
          <UserCheck className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <User className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          value={name}
          onChange={(event) => changeName(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder="Cliente (Balcão)"
          aria-label="Nome do cliente"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={visible}
          aria-controls={listId}
          aria-activedescendant={visible ? `${listId}-${active}` : undefined}
          autoComplete="off"
          className={cn("h-9 pl-8", name && "pr-8")}
        />
        {name && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Limpar cliente"
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full text-muted-foreground"
            onClick={clear}
          >
            <X />
          </Button>
        )}
      </div>

      {visible && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Clientes encontrados"
          aria-busy={isFetching}
          className="absolute inset-x-4 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {suggestions.map((customer, index) => (
            <li
              key={customer.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown, not click: keeps the input focused (no blur first).
              onMouseDown={(event) => {
                event.preventDefault();
                pick(customer);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
                index === active && "bg-muted"
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {customer.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{customer.name}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">{nationalPhone(customer.phone)}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground">
                <span className="block tabular-nums">
                  {customer.ordersCount} {customer.ordersCount === 1 ? "pedido" : "pedidos"}
                </span>
                {customer.lastOrderAt && (
                  <span className="block">
                    {formatDistanceToNow(parseISO(customer.lastOrderAt), { addSuffix: true, locale: ptBR })}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
