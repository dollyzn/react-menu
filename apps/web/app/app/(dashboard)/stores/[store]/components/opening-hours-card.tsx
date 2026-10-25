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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DAY_NAMES, WEEK_ORDER, formatWhen } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";
import { useUpdateStoreHoursMutation } from "@/redux/features/store/storeApi";
import { getErrorMessage } from "@/utils/get-error-message";

const DEFAULT_INTERVAL = { opens: "18:00", closes: "23:00" };
/** "O dia todo": midnight to 23:59 (the API refuses equal times). */
const ALL_DAY = { opens: "00:00", closes: "23:59" };
const isAllDay = (interval: { opens: string; closes: string }) =>
  interval.opens === ALL_DAY.opens && interval.closes === ALL_DAY.closes;
const crossesMidnight = (interval: { opens: string; closes: string }) =>
  interval.opens !== interval.closes && !isAllDay(interval) && minutes(interval.closes) <= minutes(interval.opens);

/** Every half hour of the day, 24h ("18:30"). */
const HALF_HOURS = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`
);

function totalMinutes(intervals: { opens: string; closes: string }[]) {
  return intervals.reduce((sum, interval) => {
    if (isAllDay(interval)) return sum + 24 * 60;
    let span = minutes(interval.closes) - minutes(interval.opens);
    if (span <= 0) span += 24 * 60;
    return sum + span;
  }, 0);
}

/** 600 → "10h", 570 → "9h30". */
const formatDuration = (total: number) =>
  `${Math.floor(total / 60)}h${total % 60 ? String(total % 60).padStart(2, "0") : ""}`;

/** A half-hour list (24h); a saved time off the grid (18:15) stays selectable. */
function TimeSelect({
  value,
  label,
  invalid,
  onChange,
}: {
  value: string;
  label: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const times = HALF_HOURS.includes(value) ? HALF_HOURS : [...HALF_HOURS, value].sort();
  const items = times.map((time) => ({ value: time, label: time }));
  return (
    <Select items={items} value={value} onValueChange={(next) => next && onChange(next as string)}>
      <SelectTrigger aria-label={label} aria-invalid={invalid} className="w-24 tabular-nums">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} className="tabular-nums">
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
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
        <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
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

          {/* The week only matters when the schedule runs the store; it stays in the form meanwhile. */}
          {values.scheduleEnabled ? (
            <div role="table" aria-label="Horários da semana" className="overflow-hidden rounded-xl border">
              <div
                role="row"
                className="hidden grid-cols-[9rem_1fr_6rem] gap-3 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid"
              >
                <span role="columnheader">Dia</span>
                <span role="columnheader">Disponibilidade</span>
                <span role="columnheader" className="text-right">
                  Horas
                </span>
              </div>
              {WEEK_ORDER.map((day) => {
                const intervals = values.days[day]?.intervals ?? [];
                const open = intervals.length > 0;
                const allDay = intervals.length === 1 && isAllDay(intervals[0]);
                const dayError = errors.days?.[day]?.intervals;
                const dayName = DAY_NAMES[day].toLowerCase();
                return (
                  <div
                    key={day}
                    role="row"
                    className="grid gap-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[9rem_1fr_6rem] sm:items-start"
                  >
                    <label role="cell" className="flex items-center gap-2.5 pt-1.5 text-sm font-medium">
                      <Checkbox
                        checked={open}
                        aria-label={`Abre ${dayName}`}
                        onCheckedChange={(checked) => setIntervals(day, checked ? [{ ...DEFAULT_INTERVAL }] : [])}
                      />
                      <span className={cn(!open && "text-muted-foreground")}>{DAY_NAMES[day]}</span>
                    </label>

                    <div role="cell" className="flex min-w-0 flex-col gap-2">
                      {!open && <span className="pt-1.5 text-sm text-muted-foreground">Indisponível</span>}
                      {open && (
                        <label className="flex w-fit items-center gap-2 text-sm">
                          <Checkbox
                            checked={allDay}
                            aria-label={`O dia todo (${dayName})`}
                            onCheckedChange={(checked) =>
                              setIntervals(day, checked ? [{ ...ALL_DAY }] : [{ ...DEFAULT_INTERVAL }])
                            }
                          />
                          O dia todo
                        </label>
                      )}
                      {open &&
                        !allDay &&
                        intervals.map((interval, index) => {
                          const label = `${dayName}${intervals.length > 1 ? `, horário ${index + 1}` : ""}`;
                          const invalid = Boolean(dayError?.[index]);
                          const setTime = (key: "opens" | "closes", value: string) =>
                            setIntervals(
                              day,
                              intervals.map((current, i) => (i === index ? { ...current, [key]: value } : current))
                            );
                          return (
                            <div key={index} className="flex flex-wrap items-center gap-2">
                              <TimeSelect
                                value={interval.opens}
                                label={`Abre às (${label})`}
                                invalid={invalid}
                                onChange={(value) => setTime("opens", value)}
                              />
                              <span aria-hidden className="text-muted-foreground">
                                –
                              </span>
                              <TimeSelect
                                value={interval.closes}
                                label={`Fecha às (${label})`}
                                invalid={invalid}
                                onChange={(value) => setTime("closes", value)}
                              />
                              {crossesMidnight(interval) && <Badge variant="secondary">até o dia seguinte</Badge>}
                              {intervals.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Remover horário (${label})`}
                                  onClick={() => setIntervals(day, intervals.filter((_, i) => i !== index))}
                                >
                                  <X />
                                </Button>
                              )}
                              {dayError?.[index]?.message && <FieldError errors={[dayError[index]]} />}
                            </div>
                          );
                        })}
                      {dayError?.message && <FieldError errors={[dayError]} />}
                      {open && !allDay && (
                        <div className="flex gap-1">
                          {intervals.length < MAX_PER_DAY && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              aria-label={`Adicionar horário (${dayName})`}
                              onClick={() => setIntervals(day, [...intervals, { opens: "11:00", closes: "14:00" }])}
                            >
                              <Plus /> horário
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            aria-label={`Copiar o horário de ${dayName} para todos os dias`}
                            onClick={() => copyToAll(day)}
                          >
                            <Copy /> copiar para todos
                          </Button>
                        </div>
                      )}
                    </div>

                    <div role="cell" className="flex sm:justify-end sm:pt-1.5">
                      {open && (
                        <Badge variant="secondary" className="bg-primary/10 font-semibold text-primary tabular-nums">
                          {formatDuration(totalMinutes(intervals))}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              Ligue acima para escolher os dias e horários em que a loja abre sozinha.
            </p>
          )}

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
