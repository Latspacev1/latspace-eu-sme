"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

export interface WaterfallDataPoint {
  label: string;
  value: number;
  reduction: number;
  color: string;
  isTotal: boolean;
}

interface WaterfallChartProps {
  data: WaterfallDataPoint[];
  targetGei?: number;
  height?: number;
}

interface ChartDataPoint {
  label: string;
  start: number;
  end: number;
  reduction: number;
  color: string;
  isTotal: boolean;
  displayValue: number;
}

export function WaterfallChart({
  data,
  targetGei,
  height = 320,
}: WaterfallChartProps) {
  // Find the lowest GEI value across all data points so the Y-axis can
  // zoom in and small reduction bars are clearly visible.
  const chartFloor = useMemo(() => {
    if (data.length === 0) return 0;
    const geiValues = data.map((d) => d.value);
    if (targetGei != null) geiValues.push(targetGei);
    const minVal = Math.min(...geiValues);
    const maxVal = Math.max(...geiValues);
    const padding = Math.max((maxVal - minVal) * 0.35, 0.005);
    return minVal - padding;
  }, [data, targetGei]);

  // Transform data for waterfall visualization — total bars start from
  // chartFloor (not 0) so the stacked bar layout stays within the zoomed range.
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (data.length === 0) return [];

    const result: ChartDataPoint[] = [];
    let runningValue = data[0]?.value ?? 0;

    data.forEach((point) => {
      if (point.isTotal) {
        result.push({
          label: point.label,
          start: chartFloor,
          end: point.value,
          reduction: 0,
          color: point.color,
          isTotal: true,
          displayValue: point.value,
        });
        runningValue = point.value;
      } else {
        const newValue = runningValue - point.reduction;
        result.push({
          label: point.label,
          start: newValue,
          end: runningValue,
          reduction: point.reduction,
          color: point.color,
          isTotal: false,
          displayValue: newValue,
        });
        runningValue = newValue;
      }
    });

    return result;
  }, [data, chartFloor]);

  // Y-axis domain matches the floor used by the data.
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 1];
    const maxVal = Math.max(...chartData.map((d) => d.end));
    const padding = Math.max((maxVal - chartFloor) * 0.05, 0.001);
    return [chartFloor, maxVal + padding];
  }, [chartData, chartFloor]);

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ChartDataPoint }>;
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0].payload;

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <div className="font-semibold text-gray-900 mb-1">{point.label}</div>
        {point.isTotal ? (
          <div className="text-gray-600">
            GEI:{" "}
            <span className="font-mono font-medium">
              {point.end.toFixed(3)}
            </span>{" "}
            tCO₂e/ton
          </div>
        ) : (
          <>
            <div className="text-gray-600">
              Reduction:{" "}
              <span className="font-mono font-medium text-green-600">
                -{point.reduction.toFixed(3)}
              </span>{" "}
              tCO₂e/ton
            </div>
            <div className="text-gray-600">
              New GEI:{" "}
              <span className="font-mono font-medium">
                {point.start.toFixed(3)}
              </span>{" "}
              tCO₂e/ton
            </div>
          </>
        )}
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[320px] text-gray-400 text-sm">
        No lever changes to display
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#E5E7EB"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#6B7280" }}
          tickLine={false}
          axisLine={{ stroke: "#E5E7EB" }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis
          type="number"
          domain={yDomain}
          allowDataOverflow={true}
          tick={{ fontSize: 11, fill: "#6B7280" }}
          tickLine={false}
          axisLine={false}
          tickCount={6}
          tickFormatter={(value: number) => value.toFixed(4)}
          label={{
            value: "GEI (tCO₂e/ton)",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 11, fill: "#6B7280" },
          }}
        />
        <Tooltip content={<CustomTooltip />} />

        {/* Target reference line */}
        {targetGei && (
          <ReferenceLine
            y={targetGei}
            stroke="#10B981"
            strokeDasharray="6 4"
            strokeWidth={2}
            label={{
              value: `Target: ${targetGei.toFixed(4)}`,
              position: "right",
              fill: "#10B981",
              fontSize: 11,
              fontWeight: 500,
            }}
          />
        )}

        {/* Invisible bar for positioning (from 0 to start) */}
        <Bar dataKey="start" stackId="waterfall" fill="transparent" />

        {/* Visible bar showing the value range */}
        <Bar
          dataKey={(d: ChartDataPoint) => d.end - d.start}
          stackId="waterfall"
          radius={[4, 4, 0, 0]}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color}
              stroke={entry.isTotal ? entry.color : "#fff"}
              strokeWidth={entry.isTotal ? 0 : 1}
            />
          ))}
          <LabelList
            dataKey="displayValue"
            position="top"
            formatter={(value) =>
              typeof value === "number" ? value.toFixed(4) : String(value ?? "")
            }
            style={{ fontSize: 10, fill: "#374151", fontWeight: 500 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
