/**
 * Patient History tab — mock clinical audit trail with a stress-probability
 * trend chart (Recharts) and a session table.
 */

"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { MOCK_SESSIONS, stressProb, type PatientSession } from "@/lib/mockData";
import { classColor, palette } from "@/lib/theme";
import { Card } from "./Card";

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function PatientHistory() {
  const sessions = [...MOCK_SESSIONS].reverse(); // newest first for table
  const stressCount = MOCK_SESSIONS.filter(
    (s) => s.prediction === "Stress",
  ).length;
  const avgConf =
    MOCK_SESSIONS.reduce((sum, s) => sum + s.confidence, 0) /
    MOCK_SESSIONS.length;

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Summary stats ---- */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Sessions" value={String(MOCK_SESSIONS.length)} />
        <StatCard
          label="Stress Episodes"
          value={String(stressCount)}
          accent={palette.stress}
        />
        <StatCard
          label="Avg Confidence"
          value={`${(avgConf * 100).toFixed(1)}%`}
          accent={palette.accent}
        />
      </div>

      {/* ---- Trend chart ---- */}
      <Card title="Stress Probability Trend" subtitle="Last 30 days — derived from assessment sessions">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={[...MOCK_SESSIONS].reverse().map((s) => ({
                date: s.date.slice(5), // MM-DD
                stress: +stressProb(s).toFixed(3),
                prediction: s.prediction,
              }))}
              margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid
                stroke={palette.grid}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: palette.faint, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fill: palette.faint, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip content={<TrendTooltip />} />
              <Line
                type="monotone"
                dataKey="stress"
                stroke={palette.stress}
                strokeWidth={2}
                dot={{ r: 4, fill: palette.stress, strokeWidth: 0 }}
                activeDot={{ r: 6, stroke: palette.surface, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ---- Session table ---- */}
      <Card title="Session History" subtitle="All recorded assessments">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-edge text-faint">
                <th className="pb-2.5 pr-4 font-medium">Session</th>
                <th className="pb-2.5 pr-4 font-medium">Date</th>
                <th className="pb-2.5 pr-4 font-medium">Time</th>
                <th className="pb-2.5 pr-4 font-medium">Class</th>
                <th className="pb-2.5 pr-4 font-medium">Confidence</th>
                <th className="pb-2.5 font-medium">Top Biomarker</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-faint">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-xl font-semibold tabular-nums"
        style={{ color: accent ?? palette.ink }}
      >
        {value}
      </div>
    </div>
  );
}

function SessionRow({ session: s }: { session: PatientSession }) {
  const color = classColor(s.prediction);
  return (
    <tr className="border-b border-edge/40 transition-colors hover:bg-raised/40">
      <td className="py-2.5 pr-4 font-mono text-faint">{s.id}</td>
      <td className="py-2.5 pr-4 text-dim">{s.date}</td>
      <td className="py-2.5 pr-4 text-dim">{s.time}</td>
      <td className="py-2.5 pr-4">
        <span
          className="inline-block rounded px-2 py-0.5 text-[11px] font-medium"
          style={{ background: color + "18", color }}
        >
          {s.prediction}
        </span>
      </td>
      <td className="py-2.5 pr-4 font-mono tabular-nums text-ink">
        {(s.confidence * 100).toFixed(1)}%
      </td>
      <td className="py-2.5">
        <span className="font-mono text-[11px] text-dim">
          {s.topBiomarker}
        </span>{" "}
        <span className="text-faint">
          ({s.shapValue >= 0 ? "+" : ""}
          {s.shapValue.toFixed(3)})
        </span>
      </td>
    </tr>
  );
}

interface TrendDatum {
  date: string;
  stress: number;
  prediction: string;
}

/** Custom tooltip props — Recharts passes these to any `content` component. */
interface TrendTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TrendDatum }>;
  label?: string;
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]!.payload as TrendDatum;
  return (
    <div className="rounded-lg border border-edge bg-raised px-3.5 py-2.5 text-xs shadow-2xl shadow-black/60">
      <div className="text-dim">{d.date}</div>
      <div className="mt-0.5 font-mono tabular-nums" style={{ color: palette.stress }}>
        Stress: {(d.stress * 100).toFixed(1)}%
      </div>
      <div className="text-faint">{d.prediction}</div>
    </div>
  );
}
