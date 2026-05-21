import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Values stored per plant
export interface PlantCalculatorValues {
    currentGei: number;
    targetGei: number;
    production: number;
    cccRate: number;
    // Calculated values
    deltaGei: number;
    totalGhgDelta: number;
    financialImpact: number;
    // Selections (for dropdown state)
    currentGeiSelection: string;
    targetGeiSelection: string;
    productionSelection: string;
}

interface FinancialImpactState {
    // Map of plantId -> calculator values
    plantValues: Record<string, PlantCalculatorValues>;

    // Actions
    setPlantCalculatorValues: (plantId: string, values: PlantCalculatorValues) => void;
    getPlantCalculatorValues: (plantId: string) => PlantCalculatorValues | null;
    clearPlantCalculatorValues: (plantId: string) => void;
    clearAll: () => void;
}

export const useFinancialImpactStore = create<FinancialImpactState>()(
    persist(
        (set, get) => ({
            plantValues: {},

            setPlantCalculatorValues: (plantId: string, values: PlantCalculatorValues) => {
                set((state) => ({
                    plantValues: {
                        ...state.plantValues,
                        [plantId]: values,
                    },
                }));
            },

            getPlantCalculatorValues: (plantId: string) => {
                return get().plantValues[plantId] || null;
            },

            clearPlantCalculatorValues: (plantId: string) => {
                set((state) => {
                    const { [plantId]: _, ...rest } = state.plantValues;
                    return { plantValues: rest };
                });
            },

            clearAll: () => {
                set({ plantValues: {} });
            },
        }),
        {
            name: "financial-impact-calculator-store",
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);
