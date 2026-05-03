import {
  addDays,
  endOfDay,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";

export type DatePreset = {
  label: string;
  from: Date;
  to: Date;
  shortcut: string;
};

export const presets = [
  {
    label: "Hoje",
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
    shortcut: "h", // dia
  },
  {
    label: "Ontem",
    from: startOfDay(addDays(new Date(), -1)),
    to: endOfDay(addDays(new Date(), -1)),
    shortcut: "o",
  },
  {
    label: "Últimos 7 dias",
    from: startOfDay(addDays(new Date(), -7)),
    to: endOfDay(new Date()),
    shortcut: "s", // semana
  },
  {
    label: "Últimos 30 dias",
    from: startOfDay(addDays(new Date(), -30)),
    to: endOfDay(new Date()),
    shortcut: "u", // mês (genérico)
  },
  {
    label: "Este mês",
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
    shortcut: "m",
  },
  {
    label: "Mês passado",
    from: startOfMonth(addDays(startOfMonth(new Date()), -1)),
    to: endOfMonth(addDays(startOfMonth(new Date()), -1)),
    shortcut: "p",
  },
  {
    label: "Este ano",
    from: startOfYear(new Date()),
    to: endOfYear(new Date()),
    shortcut: "a",
  },
] satisfies DatePreset[];
