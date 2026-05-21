// CCTS Compliance Cycle Statuses
export type ComplianceStatus =
    | "TargetNotified" // Target received from BEE
    | "MonitoringPlanDraft" // MP being prepared
    | "MonitoringPlanSubmitted" // MP submitted to BEE
    | "DataCollection" // Active monitoring & data collection
    | "GHGReportDraft" // Report being prepared
    | "GHGReportSubmitted" // Report submitted to BEE
    | "VerificationInProgress" // ACVA verification underway
    | "VerificationApproved" // ACVA verified successfully
    | "CreditIssued" // BEE issued surplus credits
    | "ShortfallDetermined" // BEE determined deficit
    | "CreditSurrendered" // Credits surrendered (compliant)
    | "ComplianceClosed" // Final closure from BEE
    | "NonCompliant" // Penalties applied
    | "Rework" // Document needs revision
    // Legacy statuses for backward compatibility
    | "Pending"
    | "InReview"
    | "Accepted";

// CCTS Document Types
export type ComplianceType =
    | "TargetNotification" // BEE target assignment
    | "MonitoringPlan" // Form A
    | "GHGEmissionReport" // Form D
    | "VerificationReport" // ACVA verification
    | "CreditDetermination" // BEE credit/shortfall statement
    | "CCCSurrender" // Form S - CCC surrender
    | "ComplianceStatusCertificate" // Final BEE certificate
    | "EnvironmentalCompensation" // EC demand notice
    // Legacy types for backward compatibility
    | "ActionPlan"
    | "QuarterlyReturn"
    | "AnnualTrueUp";

// ACVA Verification Status
export type VerificationStatus =
    | "NotRequired"
    | "Pending"
    | "DocumentReview"
    | "SiteVerification"
    | "RecalculationInProgress"
    | "Approved"
    | "Rejected";

// Credit Position Status
export type CreditPositionStatus =
    | "Surplus" // GEI achieved < GEI target
    | "Deficit" // GEI achieved > GEI target
    | "Neutral" // GEI achieved = GEI target
    | "Pending"; // Not yet determined

// Enhanced CCTS Compliance Item
export interface ComplianceItem {
    // Core fields
    id: string;
    siteId: string;
    type: ComplianceType;
    cycleYear: number; // Compliance cycle year

    // Timeline fields
    dueDate: string;
    submittedAt?: string;
    verifiedAt?: string;
    completedAt?: string;

    // Status tracking
    status: ComplianceStatus;
    verificationStatus?: VerificationStatus;
    creditPosition?: CreditPositionStatus;

    // Document management
    documentUrl?: string; // Primary document (Form A/D/S)
    documentVersion?: number; // Version tracking
    verificationReportUrl?: string; // ACVA verification report
    evidenceUrls?: string[]; // Supporting documents
    attachmentIds?: string[]; // References to attachments

    // GEI Performance metrics
    geiTarget?: number; // Target GEI (tCO2e/unit)
    geiAchieved?: number; // Actual GEI achieved
    geiVariance?: number; // (achieved - target) / target
    productionQuantity?: number; // Production in equivalent product terms
    totalEmissions?: number; // Total emissions (tCO2e)

    // Credit management
    creditSurplus?: number; // CCCs to be issued (if surplus)
    creditDeficit?: number; // CCCs required (if deficit)
    creditsSurrendered?: number; // CCCs surrendered
    environmentalCompensation?: number; // EC amount if non-compliant (INR)

    // People & roles
    reviewer?: string; // Internal reviewer
    acvaAssignee?: string; // ACVA verifier contact
    designatedManager?: string; // Designated manager for certification

    // Additional metadata
    submittedToBEE?: boolean; // Whether formally submitted to BEE
    rejectionReasons?: string[]; // Reasons for rework if rejected
    notes?: string; // Additional notes
}

// CCTS Document Management
export interface CCTSDocument {
    id: string;
    type:
    | "FormA"
    | "FormD"
    | "FormS"
    | "VerificationReport"
    | "ComplianceCertificate";
    version: number;
    siteId: string;
    cycleYear: number;
    status: "Draft" | "InternalReview" | "Submitted" | "Approved" | "Rejected";
    createdAt: string;
    updatedAt: string;
    submittedToBEEAt?: string;
    url: string;
    metadata?: Record<string, any>;
}

// CCTS Credit Ledger
export interface CreditLedger {
    id: string;
    siteId: string;
    cycleYear: number;
    openingBalance: number; // Credits carried forward
    creditsIssued: number; // New credits from surplus
    creditsPurchased: number; // Credits bought
    creditsSold: number; // Credits sold
    creditsSurrendered: number; // Credits used for compliance
    closingBalance: number; // Remaining credits
    bankingLimit: number; // Max credits for carry forward
    validityPeriod: number; // Years credits remain valid
    transactions: CreditTransaction[];
}

export interface CreditTransaction {
    id: string;
    date: string;
    type: "Issuance" | "Purchase" | "Sale" | "Surrender" | "Banking";
    quantity: number;
    pricePerCredit?: number; // INR per CCC
    totalValue?: number; // INR
    counterparty?: string;
    reference?: string; // Transaction reference
}

// ACVA Verification Checklist
export interface VerificationChecklist {
    id: string;
    complianceItemId: string;
    siteId: string;
    acvaId: string;
    items: VerificationChecklistItem[];
    overallStatus: VerificationStatus;
    completedAt?: string;
    report?: string;
}

export interface VerificationChecklistItem {
    category: string;
    item: string;
    status: "Pending" | "Verified" | "Failed";
    findings?: string;
    evidence?: string[];
}
