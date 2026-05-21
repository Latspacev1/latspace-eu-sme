export interface GeiOption {
  label: string;
  value: number;
}

export interface ProductionOption {
  label: string;
  value: number;
}

export interface FinancialImpactCalculatorProps {
  plantId?: string;
  currentGeiOptions?: GeiOption[];
  targetGeiOptions?: GeiOption[];
  productionOptions?: ProductionOption[];
  defaultCurrentGei?: number;
  defaultTargetGei?: number;
  defaultProduction?: number;
  defaultCccRate?: number;
  showPredictedOption?: boolean;
  predictedGeiValue?: number;
  predictedGeiLabel?: string;
  className?: string;
}
