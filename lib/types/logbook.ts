import type { UserRole } from "./common";

// Manual Entry / Logbook Types
export type EntryCategory =
    | "Production"
    | "Energy"
    | "Fuel"
    | "RawMaterial"
    | "Emissions"
    | "Other";
export type EntryStatus =
    | "Draft"
    | "Submitted"
    | "UnderReview"
    | "PendingCorpHeadApproval"
    | "Approved"
    | "Rejected"
    | "ChangeRequested";

// Anomaly Detection Types
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

export interface LogbookEntry {
    plant_id: string;
    plantName: string;
    id: string;
    entryDate: string;
    period: string; // e.g., "Jan 2024", "Q1 2024"
    category: EntryCategory;
    submittedBy: string;
    submittedAt: string;
    status: EntryStatus;
    reviewedBy?: string;
    reviewedAt?: string;
    rejectionReason?: string;
    approval_comments?: string;
    rejection_comments?: string;
    data: ManualEntryData;
    notes?: string;
    bulk_upload_data?: any[]; // Raw emission data from bulk upload
    job_id?: string; // Job ID for tracking bulk uploads
    // Change request fields (from Corp Head)
    changeRequestComments?: string;
    changeRequestedByName?: string;
    changeRequestedAt?: string;
    change_requested_by_id?: string;
    // Anomaly detection
    has_anomaly?: boolean; // Quick check for list view
    anomaly_count?: number; // Number of anomalous fields
    anomaly_info?: AnomalyInfo; // Detailed anomaly information
}

export interface ManualEntryData {
    // Production metrics
    clinkerProduction?: number; // tons
    clinkerConsumed?: number; // tons
    clinkerExport?: number; // tons
    clinkerImport?: number; // tons
    rawMealProduction?: number; // tons
    limestoneConsumed?: number; // tons
    cementDispatched?: number; // tons
    opcProduced?: number; // tons
    ppcProduced?: number; // tons
    steelProduction?: number; // tons (for steel plants)
    totalProduction?: number; // tons (generic production field for all plant types)

    // Energy metrics
    onSitePowerGeneration?: number; // MWh
    whrsPowerGeneration?: number; // MWh
    solarPowerGeneration?: number; // MWh
    gridPowerConsumed?: number; // MWh
    powerForClinkerProduction?: number; // MWh
    powerForCementGrinding?: number; // MWh

    // Fuel consumption
    importedCoal?: number; // tons
    indigenousCoal?: number; // tons
    petCoke?: number; // tons
    diesel?: number; // KL

    // Alternate fuels
    spentCarbon?: number; // tons
    shreddedPlastic?: number; // tons
    organicResidue?: number; // tons
    organicLiquidSolvents?: number; // tons

    // Calculated/derived
    totalEmissions?: number; // tCO2e
    emissionIntensity?: number; // tCO2e/ton
}

// Data Approval Types
export type ApprovalStatus =
    | "PendingReview"
    | "Approved"
    | "Rejected"
    | "RequestChanges";
export type ApprovalType =
    | "ManualEntry"
    | "UploadedData"
    | "ComplianceReport"
    | "EmissionCalculation";

export interface DataApproval {
    id: string;
    type: ApprovalType;
    siteId: string;
    siteName: string;
    title: string;
    description: string;
    submittedBy: string;
    submittedAt: string;
    status: ApprovalStatus;
    reviewedBy?: string;
    reviewedAt?: string;
    comments?: string;
    rejectionReason?: string;
    // Reference to the underlying data
    referenceId: string; // ID of logbook entry, upload job, etc.
    referenceType: "LogbookEntry" | "UploadJob" | "ComplianceItem";
    // Preview data
    dataPreview?: any;
    period: string; // e.g., "Jan 2024"
    metricsCount?: number; // number of metrics in the entry
}

// Notification Types
export type NotificationType =
    | "DataRejected"
    | "DataApproved"
    | "DataPendingApproval"
    | "ApprovalRequired"
    | "ChangeRequested"
    | "DeadlineReminder"
    | "ComplianceAlert"
    | "DataGap"
    | "DocumentExpiring";

export type NotificationPriority = "Low" | "Medium" | "High" | "Urgent";

export interface Notification {
    id: string;
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    message: string;
    createdAt: string;
    isRead: boolean;
    readAt?: string;
    // Action details
    requiresAction: boolean;
    actionUrl?: string;
    actionLabel?: string;
    // Reference to related entity
    relatedEntityId?: string;
    relatedEntityType?:
    | "LogbookEntry"
    | "ComplianceItem"
    | "Document"
    | "DataApproval";
    // User targeting
    recipientRole: UserRole;
    recipientUserId?: string;
    // Additional context
    siteId?: string;
    siteName?: string;
    dueDate?: string;
    metadata?: Record<string, any>;
}
