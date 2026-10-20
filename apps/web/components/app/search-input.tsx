"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Classes for the wrapper; `className` styles the input itself. */
  wrapperClassName?: string;
}

/**
 * Search field with one clear button (the browser's native one is hidden)
 * that also clears on Escape and keeps focus after clearing.
 */
export function SearchInput({
  value,
  onValueChange,
  wrapperClassName,
  className,
  onKeyDown,
  ...props
}: SearchInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const clear = () => {
    onValueChange("");
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="search"
        inputMode="search"
        autoComplete="off"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            clear();
          }
          onKeyDown?.(event);
        }}
        className={cn(
          "pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
          className
        )}
        {...props}
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Limpar busca"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full text-muted-foreground"
          onClick={clear}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
