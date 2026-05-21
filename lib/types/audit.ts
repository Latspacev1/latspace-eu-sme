import type { UserRole } from "./common";

// Audit Trail Types
export type DocumentCategory =
    | "CalibrationCertificate"
    | "Invoice"
    | "LabTestReport"
    | "MonitoringPlan"
    | "ProductionReport"
    | "MeterReading"
    | "EmissionCalculation"
    | "VerificationReport"
    | "SupportingDocument"
    | "BEECorrespondence"
    | "InternalReview"
    | "Other";

export type DocumentStatus =
    | "Active"
    | "Expiring"
    | "Expired"
    | "Archived"
    | "Superseded"
    | "Draft"
    | "UnderReview";

export interface Document {
    id: string;
    name: string;
    category: DocumentCategory;
    status: DocumentStatus;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
    checksum?: string;
    uploadedAt: string;
    uploadedBy: string;
    validFrom?: string;
    validTo?: string;
    version: number;
    previousVersionId?: string;
    siteId: string;
    complianceItemId?: string;
    isVerified: boolean;
    verifiedBy?: string;
    verifiedAt?: string;
    tags?: string[];
    notes?: string;
}

export type AuditAction =
    | "Create"
    | "Update"
    | "Delete"
    | "Approve"
    | "Reject"
    | "Submit"
    | "Verify"
    | "Calculate"
    | "Export"
    | "Import"
    | "Review";

export interface AuditLog {
    id: string;
    timestamp: string;
    userId: string;
    userName: string;
    userRole: UserRole;
    action: AuditAction;
    entityType: string;
    entityId: string;
    entityName?: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    changesSummary: string;
    ipAddress: string;
    sessionId: string;
    requestId: string;
    siteId?: string;
    complianceItemId?: string;
    documentId?: string;
    notes?: string;
    metadata?: Record<string, any>;
}

export type DataLineageSourceType =
    | "Invoice"
    | "LabReport"
    | "Manual"
    | "System"
    | "Meter"
    | "Calculation";
export type ValidationStatus = "Pending" | "Validated" | "Rejected" | "Failed";

export interface DataLineage {
    id: string;
    dataType: string;
    dataValue: number;
    dataUnit: string;
    dataDate: string;
    sourceDocumentIds: string[];
    sourceType: DataLineageSourceType;
    calculationMethod?: string;
    calculationFormula?: string;
    calculationInputs?: Array<{ name: string; value: number; unit: string }>;
    dataQualityScore: number;
    uncertaintyPercent: number;
    validationStatus: ValidationStatus;
    validationNotes?: string;
    siteId: string;
    createdAt: string;
    createdBy: string;
    lastModifiedBy?: string;
    lastModifiedAt?: string;
    version: number;
}

export type DocumentAlertType = "Expiring" | "Missing" | "DataGap";
export type AlertSeverity = "Info" | "Warning" | "Critical";

export interface DocumentAlert {
    id: string;
    type: DocumentAlertType;
    severity: AlertSeverity;
    message: string;
    description: string;
    siteId: string;
    documentId?: string;
    dataType?: string;
    createdAt: string;
    expiresAt?: string;
    actionRequired: string;
    responsibleRole: UserRole;
    isAcknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
}

export interface VerificationPackage {
    id: string;
    name: string;
    siteId: string;
    siteName: string;
    cycleYear: number;
    documentIds: string[];
    dataLineageIds: string[];
    auditLogIds: string[];
    exportFormat: "PDF" | "ZIP" | "JSON";
    generatedAt: string;
    generatedBy: string;
    downloadUrl: string;
    fileSize: number;
    checksum: string;
    sharedWithACVA: boolean;
    acvaId?: string;
    acvaEmail?: string;
    acvaAccessToken?: string;
    accessExpiresAt?: string;
    accessValidUntil?: string;
    notes?: string;
}
