/**
 * Horizontal bar chart showing the top SHAP feature attributions.
 * Positive values (blue) push toward the predicted class; negative values
 * (red) push against it.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type { FeatureAttribution } from "@/lib/types";
import { palette } from "@/lib/theme";

interface ShapDatum {
  name: string;
  value: number;
}

export function ShapChart({
  topFeatures,
  prediction,
}: {
  topFeatures: FeatureAttribution[];
  prediction: string;
}) {
  // Reverse so the most-important feature sits at the top (Recharts Y axis
  // grows downward by default for layout="vertical").
  const data: ShapDatum[] = [...topFeatures]
    .reverse()
    .map((f) => ({ name: f.name, value: f.shap_value }));

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 0.01);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke={palette.grid}
            strokeDasharray="3 3"
          />
          <XAxis
            type="number"
            domain={[-maxAbs, maxAbs]}
            tick={{ fill: palette.faint, fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(2)}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: palette.dim, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<ShapTooltip prediction={prediction} />}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.name}
                fill={d.value >= 0 ? palette.pos : palette.neg}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-1 flex items-center gap-4 text-[10px] text-faint">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: palette.pos }} />
          Towards predicted class
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: palette.neg }} />
          Against predicted class
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom Recharts tooltip — keeps the bar chart clean.               */
/* ------------------------------------------------------------------ */

/** Custom tooltip props — Recharts passes these to any `content` component. */
interface TooltipContentProps {
  active?: boolean;
  payload?: Array<{ payload: ShapDatum }>;
  label?: string;
}

function ShapTooltip({
  active,
  payload,
  prediction,
}: TooltipContentProps & { prediction: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]!.payload;
  const positive = d.value >= 0;
  return (
    <div className="rounded-lg border border-edge bg-raised px-3.5 py-2.5 text-xs shadow-2xl shadow-black/60">
      <div className="font-medium text-ink">{d.name}</div>
      <div
        className="mt-0.5 font-mono tabular-nums"
        style={{ color: positive ? palette.pos : palette.neg }}
      >
        {positive ? "+" : ""}
        {d.value.toFixed(4)}
      </div>
      <div className="mt-0.5 text-faint">
        {positive ? "pushes towards" : "pushes against"} &ldquo;{prediction}&rdquo;
      </div>
    </div>
  );
}
