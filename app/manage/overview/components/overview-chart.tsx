"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

const data = [
  {
    name: "Jan",
    total: 45,
  },
  {
    name: "Fev",
    total: 12,
  },
  {
    name: "Mar",
    total: 38,
  },
  {
    name: "Abr",
    total: 15,
  },
  {
    name: "Mai",
    total: 48,
  },
  {
    name: "Jun",
    total: 32,
  },
  {
    name: "Jul",
    total: 45,
  },
  {
    name: "Ago",
    total: 48,
  },
  {
    name: "Set",
    total: 42,
  },
  {
    name: "Out",
    total: 38,
  },
  {
    name: "Nov",
    total: 12,
  },
  {
    name: "Dez",
    total: 15,
  },
];

export function OverviewChart() {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: string) => `${value}`}
        />
        <Bar
          dataKey="total"
          fill="currentColor"
          radius={[4, 4, 0, 0]}
          className="fill-primary"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
