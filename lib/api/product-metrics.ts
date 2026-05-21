import { apiClient } from "@/lib/api/client";

export interface ProductMetricDataPoint {
  product_name: string;
  product_display_name: string;
  metric_name: string;
  metric_display_name: string;
  baseline_value: number | null;
  current_value: number | null;
  unit: string;
  change_percentage: number | null;
}

export interface ProductMetricsComparisonResponse {
  plant_id: string;
  plant_name: string;
  baseline_year: number;
  current_year: number;
  data: ProductMetricDataPoint[];
}

export interface ProductInfo {
  id: string | null;
  name: string;
  display_name: string;
}

export interface MetricInfo {
  key: string;
  display_name: string;
  unit: string;
}

export const productMetricsApi = {
  /**
   * Get available products for a plant
   */
  getProducts: async (plantId: string) => {
    return apiClient.get<ProductInfo[]>(
      `/api/product-metrics/products/${plantId}`,
    );
  },

  /**
   * Get available metrics with display names and units
   * @param plantId - Optional plant ID to filter metrics by organization
   */
  getMetrics: async (plantId?: string) => {
    const url = plantId
      ? `/api/product-metrics/metrics?plant_id=${plantId}`
      : "/api/product-metrics/metrics";
    return apiClient.get<MetricInfo[]>(url);
  },

  /**
   * Get product metrics comparison between baseline and current year
   *
   * @param plantId - Plant ID
   * @param products - Array of product display names (e.g., ["VSF", "Na2SO4"])
   * @param metrics - Array of metric keys (e.g., ["production", "sec_total"])
   * @param baselineYear - Optional baseline year
   * @param currentYear - Optional current year
   */
  getComparison: async (
    plantId: string,
    products: string[],
    metrics: string[],
    baselineYear?: number,
    currentYear?: number,
  ) => {
    const params = new URLSearchParams();
    params.append("products", products.join(","));
    params.append("metrics", metrics.join(","));
    if (baselineYear !== undefined) {
      params.append("baseline_year", baselineYear.toString());
    }
    if (currentYear !== undefined) {
      params.append("current_year", currentYear.toString());
    }

    return apiClient.get<ProductMetricsComparisonResponse>(
      `/api/product-metrics/comparison/${plantId}?${params.toString()}`,
    );
  },
};
