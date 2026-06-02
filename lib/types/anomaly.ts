// Anomaly detection types. Extracted from the removed logbook types module;
// still used by the uploads / template parsing flow and anomaly-detection util.

export type AnomalySeverity = "warning" | "critical";

export interface AnomalyFieldInfo {
    field_name: string;
    current_value: number;
    moving_average: number | null;
    deviation_percentage: number;
    severity: AnomalySeverity;
    lookback_months: number;
}

export interface AnomalyInfo {
    has_anomaly: boolean;
    detection_date: string;
    anomalous_fields: AnomalyFieldInfo[];
    total_fields_checked: number;
}
