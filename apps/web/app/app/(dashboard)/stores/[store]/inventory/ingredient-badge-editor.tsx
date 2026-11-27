"use client";

import { useState } from "react";
import { Radio } from "@base-ui/react/radio";
import { RotateCcw, Sparkles } from "lucide-react";
import type { IngredientBadge as Badge, IngredientIconColor } from "@react-menu/contracts";
import { BADGE_COLORS, IngredientBadge } from "@/components/app/ingredient-badge";
import { SearchInput } from "@/components/app/search-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { ICON_SECTIONS, iconName, searchIcons, type IconOption } from "./ingredient-icon-catalog";

/** The manager's picks; null = automatic from the name. */
export type BadgePicks = {
  icon: string | null;
  iconColor: IngredientIconColor | null;
  /** false = no tag. */
  iconLabel: string | false | null;
};

export const AUTO_PICKS: BadgePicks = { icon: null, iconColor: null, iconLabel: null };

/** The picks over the automatic badge, as the API resolves them. */
export function resolveBadge(auto: Badge, picks: BadgePicks): Badge {
  return {
    emoji: picks.icon ?? auto.emoji,
    color: picks.iconColor ?? auto.color,
    label: picks.iconLabel === null ? auto.label : picks.iconLabel || null,
  };
}

const AUTO = "auto";
const COLORS = Object.keys(BADGE_COLORS) as IngredientIconColor[];

const tile =
  "flex aspect-square items-center justify-center rounded-lg border border-transparent transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/10";

/**
 * Emoji, color and tag of an ingredient, each automatic (from the name) or
 * picked, with the badge as the kitchen will show it on top.
 */
export function IngredientBadgeEditor({
  name,
  auto,
  value,
  onChange,
}: {
  name: string;
  /** The automatic badge for the name being typed (null while unknown). */
  auto: Badge | null;
  value: BadgePicks;
  onChange: (picks: BadgePicks) => void;
}) {
  const [query, setQuery] = useState("");
  const fallback: Badge = auto ?? { emoji: null, color: "gray", label: null };
  const shown = resolveBadge(fallback, value);
  const custom = value.icon !== null || value.iconColor !== null || value.iconLabel !== null;
  const set = (patch: Partial<BadgePicks>) => onChange({ ...value, ...patch });
  const results = query.trim() ? searchIcons(query) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border p-3">
      {/* The reset sits under the text: beside it, it pushed the dialog sideways. */}
      <div className="flex min-w-0 items-center gap-4">
        <IngredientBadge badge={shown} size="xl" />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <p className="w-full truncate font-medium">{name.trim() || "Novo ingrediente"}</p>
          <p className="text-xs text-muted-foreground">
            {custom ? "Personalizado" : "Automático pelo nome: muda junto se você renomear"}
          </p>
          {custom && (
            <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => onChange(AUTO_PICKS)}>
              <RotateCcw data-icon="inline-start" /> Voltar ao automático
            </Button>
          )}
        </div>
      </div>

      <Field>
        <FieldLabel id="badge-icon-label">Ícone</FieldLabel>
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Buscar ícone (ex.: batata, queijo)"
          aria-label="Buscar ícone"
        />
        <RadioGroup
          aria-labelledby="badge-icon-label"
          value={value.icon ?? AUTO}
          onValueChange={(next) => set({ icon: next === AUTO ? null : (next as string) })}
          className="flex max-h-60 flex-col gap-3 overflow-y-auto pr-1"
        >
          <IconGrid>
            <Radio.Root
              value={AUTO}
              aria-label={`Automático${auto?.emoji ? ` (${iconName(auto.emoji)})` : ""}`}
              title="Automático (pelo nome)"
              className={cn(tile, "relative font-emoji text-xl text-muted-foreground data-checked:text-primary")}
            >
              {auto?.emoji ?? <Sparkles className="size-4" />}
              {auto?.emoji && <Sparkles className="absolute top-0.5 right-0.5 size-3" />}
            </Radio.Root>
            {results?.map((icon) => <IconTile key={icon.emoji} icon={icon} />)}
          </IconGrid>
          {results
            ? results.length === 0 && (
                <p className="py-2 text-center text-sm text-muted-foreground">Nenhum ícone para “{query.trim()}”.</p>
              )
            : ICON_SECTIONS.map((section) => (
                <div key={section.title} role="presentation" className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{section.title}</p>
                  <IconGrid>
                    {section.icons.map((icon) => (
                      <IconTile key={icon.emoji} icon={icon} />
                    ))}
                  </IconGrid>
                </div>
              ))}
        </RadioGroup>
      </Field>

      <Field>
        <FieldLabel id="badge-color-label">Cor</FieldLabel>
        <RadioGroup
          aria-labelledby="badge-color-label"
          value={value.iconColor ?? AUTO}
          onValueChange={(next) => set({ iconColor: next === AUTO ? null : (next as IngredientIconColor) })}
          className="flex flex-wrap gap-1.5"
        >
          <Radio.Root
            value={AUTO}
            aria-label={`Automática (${BADGE_COLORS[fallback.color].name})`}
            title="Automática (pelo nome)"
            className={cn(tile, "size-8 text-muted-foreground data-checked:text-primary")}
          >
            <Sparkles className="size-4" />
          </Radio.Root>
          {COLORS.map((color) => (
            <Radio.Root
              key={color}
              value={color}
              aria-label={BADGE_COLORS[color].name}
              title={BADGE_COLORS[color].name}
              className={cn(tile, "size-8 p-1")}
            >
              <span className={cn("size-full rounded-md", BADGE_COLORS[color].swatch)} />
            </Radio.Root>
          ))}
        </RadioGroup>
      </Field>

      <Field>
        <FieldLabel htmlFor="badge-tag">Sigla</FieldLabel>
        <div className="flex items-center gap-3">
          <Input
            id="badge-tag"
            className="w-24 uppercase"
            maxLength={3}
            disabled={value.iconLabel === false}
            value={typeof value.iconLabel === "string" ? value.iconLabel : ""}
            onChange={(event) => {
              const typed = event.target.value.replace(/[^\p{L}\p{N}]/gu, "").toLocaleUpperCase("pt-BR");
              set({ iconLabel: typed || null });
            }}
            placeholder={fallback.label ?? "Ex.: CAT"}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.iconLabel === false}
              onCheckedChange={(checked) => set({ iconLabel: checked ? false : null })}
            />
            Sem sigla
          </label>
        </div>
        <FieldDescription>
          Até 3 letras no cantinho do ícone, para separar ingredientes parecidos (Catupiry “CAT”, Mussarela “MUS”).
          {fallback.label && value.iconLabel === null && ` Vazio = automática (${fallback.label}).`}
        </FieldDescription>
      </Field>
    </div>
  );
}

function IconGrid({ children }: { children: React.ReactNode }) {
  // Columns by the room the dialog has (not the viewport's breakpoints), never wider than it.
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1">{children}</div>;
}

function IconTile({ icon }: { icon: IconOption }) {
  return (
    <Radio.Root value={icon.emoji} aria-label={icon.name} title={icon.name} className={cn(tile, "font-emoji text-xl")}>
      {icon.emoji}
    </Radio.Root>
  );
}
