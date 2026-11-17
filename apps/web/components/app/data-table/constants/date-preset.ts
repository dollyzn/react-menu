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

/**
 * The quick periods, worked out from `now`: built when the picker renders,
 * never once at load (a panel left open overnight kept yesterday's "Hoje").
 */
export const datePresets = (now = new Date()): DatePreset[] => [
  {
    label: "Hoje",
    from: startOfDay(now),
    to: endOfDay(now),
    shortcut: "h", // dia
  },
  {
    label: "Ontem",
    from: startOfDay(addDays(now, -1)),
    to: endOfDay(addDays(now, -1)),
    shortcut: "o",
  },
  {
    label: "Últimos 7 dias",
    from: startOfDay(addDays(now, -7)),
    to: endOfDay(now),
    shortcut: "s", // semana
  },
  {
    label: "Últimos 30 dias",
    from: startOfDay(addDays(now, -30)),
    to: endOfDay(now),
    shortcut: "u", // mês (genérico)
  },
  {
    label: "Este mês",
    from: startOfMonth(now),
    to: endOfMonth(now),
    shortcut: "m",
  },
  {
    label: "Mês passado",
    from: startOfMonth(addDays(startOfMonth(now), -1)),
    to: endOfMonth(addDays(startOfMonth(now), -1)),
    shortcut: "p",
  },
  {
    label: "Este ano",
    from: startOfYear(now),
    to: endOfYear(now),
    shortcut: "a",
  },
];
