"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  productMetricsApi,
  type ProductMetricDataPoint,
} from "@/lib/api/product-metrics";
import { plantsApi } from "@/lib/api/plants";
import { DEFAULT_METRICS, BASELINE_COLOR, CURRENT_COLOR } from "./constants";
import { CustomTooltip } from "./custom-tooltip";
import { ChartHeader } from "./chart-header";

interface ProductMetricsComparisonChartProps {
  plantId: string;
  plantName?: string;
  isCompact?: boolean;
  viewMode?: "monthly" | "quarterly" | "yearly";
}

export function ProductMetricsComparisonChart({
  plantId,
  plantName,
  isCompact = false,
  viewMode,
}: ProductMetricsComparisonChartProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
  const [isMetricSelectorOpen, setIsMetricSelectorOpen] = useState(false);
  const [hasInitializedMetrics, setHasInitializedMetrics] = useState(false);

  // Fetch plant KPIs to get baseline year
  const { data: plantKPIs } = useQuery({
    queryKey: ["plant-kpis", plantId],
    queryFn: async () => {
      const response = await plantsApi.getKPIs(plantId);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    },
    enabled: !!plantId,
  });

  // Fetch available products for this plant
  const { data: availableProducts } = useQuery({
    queryKey: ["product-metrics-products", plantId],
    queryFn: async () => {
      const response = await productMetricsApi.getProducts(plantId);
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    },
    enabled: !!plantId,
  });

  // Auto-select first products when data loads
  useEffect(() => {
    if (availableProducts && availableProducts.length > 0 && selectedProducts.length === 0) {
      const initialProducts = isCompact
        ? [availableProducts[0].name]
        : availableProducts.slice(0, 2).map(p => p.name);
      setSelectedProducts(initialProducts);
    }
  }, [availableProducts, selectedProducts.length, isCompact]);

  // Fetch available metrics
  const { data: availableMetrics } = useQuery({
    queryKey: ["product-metrics-metrics", plantId],
    queryFn: async () => {
      const response = await productMetricsApi.getMetrics(plantId);
      if (response.success && response.data) {
        return response.data;
      }
      return DEFAULT_METRICS;
    },
    enabled: !!plantId,
  });

  // Auto-select first 2 metrics when metrics list loads
  useEffect(() => {
    if (availableMetrics && availableMetrics.length > 0 && selectedMetrics.length === 0 && !hasInitializedMetrics) {
      const initialMetrics = availableMetrics.slice(0, 2).map(m => m.key);
      setSelectedMetrics(initialMetrics);
      setHasInitializedMetrics(true);
    }
  }, [availableMetrics, selectedMetrics.length, hasInitializedMetrics]);

  const products = availableProducts || [];
  const metrics = availableMetrics || DEFAULT_METRICS;

  // Fetch comparison data
  const { data: comparisonData, isLoading } = useQuery({
    queryKey: [
      "product-metrics-comparison",
      plantId,
      selectedProducts,
      selectedMetrics,
    ],
    queryFn: async () => {
      if (selectedProducts.length === 0 || selectedMetrics.length === 0) {
        return null;
      }
      const response = await productMetricsApi.getComparison(
        plantId,
        selectedProducts,
        selectedMetrics,
      );
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    },
    enabled:
      !!plantId && selectedProducts.length > 0 && selectedMetrics.length > 0,
  });

  // Transform data for the bar chart
  const chartData = useMemo(() => {
    if (!comparisonData?.data) return [];
    return comparisonData.data.map((item: ProductMetricDataPoint) => ({
      name: `${item.product_display_name} - ${item.metric_display_name}`,
      baseline: item.baseline_value,
      current: item.current_value,
      unit: item.unit,
      change: item.change_percentage,
      product: item.product_display_name,
      metric: item.metric_display_name,
    }));
  }, [comparisonData]);

  // Toggle product selection
  const toggleProduct = (productName: string) => {
    setSelectedProducts((prev) => {
      if (prev.includes(productName)) {
        if (prev.length === 1) return prev;
        return prev.filter((p) => p !== productName);
      }
      if (isCompact && prev.length >= 1) {
        return [productName];
      }
      return [...prev, productName];
    });
  };

  // Toggle metric selection
  const toggleMetric = (metricKey: string) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(metricKey)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== metricKey);
      }
      return [...prev, metricKey];
    });
  };

  const baselineYear =
    comparisonData?.baseline_year || plantKPIs?.baseline_year || 2023;
  const currentYear = comparisonData?.current_year || new Date().getFullYear();

  return (
    <Card
      className={cn(
        "flex flex-col rounded-none",
        isCompact ? "h-[320px]" : "h-[550px]",
      )}
    >
      <ChartHeader
        isCompact={isCompact}
        baselineYear={baselineYear}
        currentYear={currentYear}
        products={products}
        metrics={metrics}
        selectedProducts={selectedProducts}
        selectedMetrics={selectedMetrics}
        toggleProduct={toggleProduct}
        toggleMetric={toggleMetric}
        isProductSelectorOpen={isProductSelectorOpen}
        setIsProductSelectorOpen={setIsProductSelectorOpen}
        isMetricSelectorOpen={isMetricSelectorOpen}
        setIsMetricSelectorOpen={setIsMetricSelectorOpen}
        setSelectedProducts={setSelectedProducts}
      />

      {/* Chart */}
      <div className="flex-1 px-2 pb-2 pt-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-8 w-8 border-b-2 border-teal-600" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No data available for selected products and metrics
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 5,
                right: 20,
                left: 5,
                bottom: isCompact ? 5 : 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: isCompact ? 9 : 11 }}
                angle={-45}
                textAnchor="end"
                height={isCompact ? 50 : 70}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: isCompact ? 10 : 11 }}
                tickFormatter={(value) =>
                  value >= 1000
                    ? `${(value / 1000).toFixed(1)}k`
                    : value.toString()
                }
              />
              <Tooltip content={<CustomTooltip />} />
              {!isCompact && (
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ paddingTop: 30 }}
                  iconSize={10}
                  formatter={(value) => (
                    <span className="text-[11px] font-medium text-gray-500">
                      {value === "baseline"
                        ? `Baseline (FY ${baselineYear}-${(baselineYear + 1).toString().slice(2)})`
                        : `Current (FY ${currentYear}-${(currentYear + 1).toString().slice(2)})`}
                    </span>
                  )}
                />
              )}
              <Bar
                dataKey="baseline"
                name="baseline"
                fill={BASELINE_COLOR}
                radius={0}
              />
              <Bar
                dataKey="current"
                name="current"
                fill={CURRENT_COLOR}
                radius={0}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
