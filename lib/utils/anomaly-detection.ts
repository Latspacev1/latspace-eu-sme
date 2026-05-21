/**
 * Client-side anomaly detection utilities
 * Calculates anomalies dynamically based on historical averages sent from backend
 */

export type AnomalySeverity = "warning" | "critical" | null;

export interface AnomalyResult {
  isAnomaly: boolean;
  severity: AnomalySeverity;
  deviationPercentage: number;
}

// Anomaly detection configuration (matching backend)
const ANOMALY_CONFIG = {
  warning_threshold_pct: 5.0,
  critical_threshold_pct: 10.0,
};

/**
 * Detect if a value is anomalous based on historical data or sanity rules
 * @param currentValue - Current value to check
 * @param movingAverage - Historical moving average (from backend)
 * @param paramName - Parameter name (for sanity rules)
 * @returns AnomalyResult with severity and deviation
 */
export function detectAnomaly(
  currentValue: number,
  movingAverage: number | null,
  paramName: string = "",
): AnomalyResult {
  const lowerName = paramName.toLowerCase();

  // 1. Sanity Check: Negative values (unless historically negative, or loss/reduction/adjustment/export)
  if (currentValue < 0) {
    const historicallyNegative = movingAverage !== null && movingAverage !== undefined && movingAverage < 0;
    const nameAllowsNegative = ["loss", "reduction", "adjustment", "export"].some((k) => lowerName.includes(k));
    if (!historicallyNegative && !nameAllowsNegative) {
      return {
        isAnomaly: true,
        severity: "warning",
        deviationPercentage: 100,
      };
    }
  }

  // 2. Sanity Check: Zero values for production/consumption
  //    Skip if historically zero (or no history) — 0 is the norm for this param
  if (currentValue === 0) {
    const historicallyZero = movingAverage === null || movingAverage === undefined || movingAverage === 0;
    if (!historicallyZero && (lowerName.includes("production") || lowerName.includes("consumption"))) {
      return {
        isAnomaly: true,
        severity: "warning",
        deviationPercentage: 100,
      };
    }
  }

  // 3. Historical Anomaly: No anomaly if no moving average available
  if (movingAverage === null || movingAverage === undefined) {
    return {
      isAnomaly: false,
      severity: null,
      deviationPercentage: 0,
    };
  }

  // Handle zero moving average
  if (movingAverage === 0) {
    // If both are zero, no anomaly
    if (currentValue === 0) {
      return {
        isAnomaly: false,
        severity: null,
        deviationPercentage: 0,
      };
    }
    // If only current is non-zero, this is a significant change
    return {
      isAnomaly: true,
      severity: "critical",
      deviationPercentage: 100,
    };
  }

  // Calculate deviation percentage
  const deviationPct =
    Math.abs((currentValue - movingAverage) / movingAverage) * 100;

  // Classify based on thresholds
  let severity: AnomalySeverity = null;
  if (deviationPct >= ANOMALY_CONFIG.critical_threshold_pct) {
    severity = "critical";
  } else if (deviationPct >= ANOMALY_CONFIG.warning_threshold_pct) {
    severity = "warning";
  }

  return {
    isAnomaly: severity !== null,
    severity,
    deviationPercentage: deviationPct,
  };
}

/**
 * Calculate anomalies for an array of emission data items
 * @param emissionData - Array of emission items with data_value and moving_average
 * @returns Array of anomaly results matching input array order
 */
export function detectAnomaliesForBulkData(
  emissionData: Array<{
    data_value: number;
    moving_average?: number | null;
    lookback_months?: number;
  }>,
): AnomalyResult[] {
  return emissionData.map((item) =>
    detectAnomaly(item.data_value, item.moving_average ?? null),
  );
}

/**
 * Get anomaly counts from bulk data
 * @param emissionData - Array of emission items
 * @returns Object with total anomalies, warnings, and critical counts
 */
export function getAnomalyCounts(
  emissionData: Array<{
    data_value: number;
    moving_average?: number | null;
  }>,
): {
  total: number;
  warnings: number;
  critical: number;
} {
  const results = detectAnomaliesForBulkData(emissionData);

  return {
    total: results.filter((r) => r.isAnomaly).length,
    warnings: results.filter((r) => r.severity === "warning").length,
    critical: results.filter((r) => r.severity === "critical").length,
  };
}

/**
 * Get severity badge color classes
 * @param severity - Anomaly severity
 * @returns Tailwind CSS classes for badge
 */
export function getAnomalySeverityColor(severity: AnomalySeverity): string {
  if (severity === "critical") {
    return "bg-red-100 text-red-700 border-red-300";
  } else if (severity === "warning") {
    return "bg-orange-100 text-orange-700 border-orange-300";
  }
  return "bg-gray-100 text-gray-700 border-gray-300";
}

/**
 * Get severity background color for containers
 * @param severity - Anomaly severity
 * @returns Tailwind CSS classes for background
 */
export function getAnomalyBackgroundColor(severity: AnomalySeverity): string {
  if (severity === "critical") {
    return "bg-red-50 border-red-200";
  } else if (severity === "warning") {
    return "bg-yellow-50 border-yellow-200";
  }
  return "bg-gray-50 border-gray-200";
}
