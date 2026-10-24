"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Clock, Copy, Plus, X } from "lucide-react";
import type { OpeningInterval } from "@react-menu/contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DAY_NAMES, WEEK_ORDER, formatWhen } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";
import { useUpdateStoreHoursMutation } from "@/redux/features/store/storeApi";
import { getErrorMessage } from "@/utils/get-error-message";

const DEFAULT_INTERVAL = { opens: "18:00", closes: "23:00" };
const MAX_PER_DAY = 3;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida.");
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

const Schema = z
  .object({
    scheduleEnabled: z.boolean(),
    days: z.array(z.object({ intervals: z.array(z.object({ opens: time, closes: time })).max(MAX_PER_DAY) })).length(7),
  })
  .superRefine((values, ctx) => {
    values.days.forEach((day, index) => {
      day.intervals.forEach((interval, i) => {
        if (interval.opens === interval.closes) {
          ctx.addIssue({ code: "custom", path: ["days", index, "intervals", i], message: "Abertura e fechamento iguais." });
        }
      });
      const ranges = day.intervals
        .map((interval) => {
          const start = minutes(interval.opens);
          let end = minutes(interval.closes);
          if (end <= start) end += 24 * 60;
          return { start, end };
        })
        .sort((a, b) => a.start - b.start);
      if (ranges.some((range, i) => i > 0 && range.start < ranges[i - 1].end)) {
        ctx.addIssue({ code: "custom", path: ["days", index, "intervals"], message: "Os horários deste dia se sobrepõem." });
      }
    });
    if (values.scheduleEnabled && values.days.every((day) => day.intervals.length === 0)) {
      ctx.addIssue({ code: "custom", path: ["scheduleEnabled"], message: "Abra pelo menos um dia para seguir o horário." });
    }
  });

type Values = z.infer<typeof Schema>;

const toForm = (store: Store): Values => ({
  scheduleEnabled: store.scheduleEnabled,
  days: Array.from({ length: 7 }, (_, day) => ({
    intervals: store.openingHours
      .filter((interval) => interval.day === day)
      .map(({ opens, closes }) => ({ opens, closes }))
      .sort((a, b) => a.opens.localeCompare(b.opens)),
  })),
});

const toHours = (values: Values): OpeningInterval[] =>
  values.days.flatMap((day, index) => day.intervals.map((interval) => ({ day: index, ...interval })));

/**
 * Weekly opening hours. On, the store opens and closes by itself (menu and
 * online orders follow it); "Fechar agora" in the status menu pauses it
 * until the next opening. Off, the status is set by hand as before.
 */
export function OpeningHoursCard({ store }: { store: Store }) {
  const [save, { isLoading }] = useUpdateStoreHoursMutation();
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: toForm(store) });
  const values = useWatch({ control: form.control }) as Values;
  const errors = form.formState.errors;

  const setIntervals = (day: number, intervals: Values["days"][number]["intervals"]) =>
    form.setValue(`days.${day}.intervals`, intervals, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });

  const copyToAll = (day: number) => {
    for (let other = 0; other < 7; other++) {
      if (other !== day) setIntervals(other, values.days[day].intervals.map((interval) => ({ ...interval })));
    }
    toast.success(`Horário de ${DAY_NAMES[day].toLowerCase()} copiado para todos os dias`);
  };

  const submit = async (data: Values) => {
    try {
      const saved = await save({ id: store.id, scheduleEnabled: data.scheduleEnabled, openingHours: toHours(data) }).unwrap();
      form.reset(toForm(saved));
      toast.success("Horário de funcionamento salvo");
    } catch (error) {
      form.setError("root", { message: getErrorMessage(error, "Não foi possível salvar o horário.") });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4 text-primary" /> Horário de funcionamento
        </CardTitle>
        <CardDescription>
          {store.scheduleEnabled
            ? store.isOpen
              ? `Aberta agora pelo horário${store.closesAt ? `, fecha ${formatWhen(store.closesAt)}` : ""}.`
              : `Fechada agora${store.opensAt ? `, abre ${formatWhen(store.opensAt)}` : ""}.`
            : "A loja abre e fecha pelo botão de status. Ligue para seguir o horário sozinha."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <Field orientation="horizontal" data-invalid={Boolean(errors.scheduleEnabled)}>
            <Switch
              id="schedule-enabled"
              checked={values.scheduleEnabled}
              onCheckedChange={(checked) =>
                form.setValue("scheduleEnabled", checked, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
              }
            />
            <FieldLabel htmlFor="schedule-enabled">Abrir e fechar sozinha pelo horário</FieldLabel>
          </Field>
          {errors.scheduleEnabled && <FieldError errors={[errors.scheduleEnabled]} />}

          <ul aria-label="Horários da semana" className="divide-y rounded-xl border">
            {WEEK_ORDER.map((day) => {
              const intervals = values.days[day]?.intervals ?? [];
              const open = intervals.length > 0;
              const dayError = errors.days?.[day]?.intervals;
              return (
                <li key={day} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
                  <div className="flex w-36 shrink-0 items-center gap-2 pt-1.5">
                    <Switch
                      size="sm"
                      checked={open}
                      aria-label={`Abre ${DAY_NAMES[day].toLowerCase()}`}
                      onCheckedChange={(checked) => setIntervals(day, checked ? [{ ...DEFAULT_INTERVAL }] : [])}
                    />
                    <span className={cn("text-sm font-medium", !open && "text-muted-foreground")}>{DAY_NAMES[day]}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {!open && <span className="pt-1.5 text-sm text-muted-foreground">Fechado</span>}
                    {intervals.map((interval, index) => {
                      const label = `${DAY_NAMES[day].toLowerCase()}${intervals.length > 1 ? `, horário ${index + 1}` : ""}`;
                      const invalid = Boolean(dayError?.[index]);
                      return (
                        <div key={index} className="flex flex-wrap items-center gap-2">
                          <Input
                            type="time"
                            aria-label={`Abre às (${label})`}
                            aria-invalid={invalid}
                            className="w-28"
                            {...form.register(`days.${day}.intervals.${index}.opens`)}
                          />
                          <span className="text-sm text-muted-foreground">às</span>
                          <Input
                            type="time"
                            aria-label={`Fecha às (${label})`}
                            aria-invalid={invalid}
                            className="w-28"
                            {...form.register(`days.${day}.intervals.${index}.closes`)}
                          />
                          {minutes(interval.closes) <= minutes(interval.opens) && interval.opens !== interval.closes && (
                            <Badge variant="secondary">até o dia seguinte</Badge>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remover horário (${label})`}
                            onClick={() => setIntervals(day, intervals.filter((_, i) => i !== index))}
                          >
                            <X />
                          </Button>
                          {dayError?.[index]?.message && <FieldError errors={[dayError[index]]} />}
                        </div>
                      );
                    })}
                    {dayError?.message && <FieldError errors={[dayError]} />}
                  </div>
                  {open && (
                    <div className="flex gap-1 sm:pt-0.5">
                      {intervals.length < MAX_PER_DAY && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Adicionar horário (${DAY_NAMES[day].toLowerCase()})`}
                          onClick={() => setIntervals(day, [...intervals, { opens: "11:00", closes: "14:00" }])}
                        >
                          <Plus /> Horário
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Copiar para todos os dias"
                        aria-label={`Copiar o horário de ${DAY_NAMES[day].toLowerCase()} para todos os dias`}
                        onClick={() => copyToAll(day)}
                      >
                        <Copy />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {errors.root?.message && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={isLoading} disabled={!form.formState.isDirty}>
              Salvar horário
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
