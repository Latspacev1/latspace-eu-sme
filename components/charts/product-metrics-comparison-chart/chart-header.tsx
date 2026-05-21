import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductInfo, MetricInfo } from "@/lib/api/product-metrics";
import { BASELINE_COLOR, CURRENT_COLOR } from "./constants";

interface ChartHeaderProps {
  isCompact: boolean;
  baselineYear: number;
  currentYear: number;
  products: ProductInfo[];
  metrics: MetricInfo[];
  selectedProducts: string[];
  selectedMetrics: string[];
  toggleProduct: (name: string) => void;
  toggleMetric: (key: string) => void;
  isProductSelectorOpen: boolean;
  setIsProductSelectorOpen: (open: boolean) => void;
  isMetricSelectorOpen: boolean;
  setIsMetricSelectorOpen: (open: boolean) => void;
  setSelectedProducts: (products: string[]) => void;
}

function SelectedChips({
  items,
  allItems,
  onRemove,
  minItems = 1,
}: {
  items: string[];
  allItems: { name?: string; key?: string; display_name: string }[];
  onRemove: (item: string) => void;
  minItems?: number;
}) {
  return items.map((item) => {
    const itemData = allItems.find((i) => (i.name || i.key) === item);
    return (
      <div
        key={item}
        className="flex items-center gap-1 bg-teal-50 text-teal-700 px-2 py-0.5 text-xs"
      >
        <span>{itemData?.display_name || item}</span>
        {items.length > minItems && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item);
            }}
            className="hover:text-teal-900"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  });
}

export function ChartHeader({
  isCompact,
  baselineYear,
  currentYear,
  products,
  metrics,
  selectedProducts,
  selectedMetrics,
  toggleProduct,
  toggleMetric,
  isProductSelectorOpen,
  setIsProductSelectorOpen,
  isMetricSelectorOpen,
  setIsMetricSelectorOpen,
  setSelectedProducts,
}: ChartHeaderProps) {
  return (
    <div className={cn("p-4 border-b", isCompact ? "py-2" : "")}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3
          className={cn("font-semibold", isCompact ? "text-sm" : "text-base")}
        >
          Product Metrics Comparison
        </h3>

        {!isCompact && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <div
                className="h-3 w-3"
                style={{ backgroundColor: BASELINE_COLOR }}
              />
              Baseline (FY {baselineYear}-
              {(baselineYear + 1).toString().slice(2)})
            </span>
            <span className="flex items-center gap-1">
              <div
                className="h-3 w-3"
                style={{ backgroundColor: CURRENT_COLOR }}
              />
              Current (FY {currentYear}-
              {(currentYear + 1).toString().slice(2)})
            </span>
          </div>
        )}
      </div>

      {/* Selectors */}
      <div
        className={cn("flex flex-wrap gap-2 mt-2", isCompact ? "mt-1" : "")}
      >
        {/* Product Selector */}
        {isCompact ? (
          <Popover
            open={isProductSelectorOpen}
            onOpenChange={setIsProductSelectorOpen}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                {selectedProducts[0] || "Select Product"}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2" align="start">
              {products.map((product) => (
                <button
                  key={product.name}
                  onClick={() => {
                    setSelectedProducts([product.name]);
                    setIsProductSelectorOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100",
                    selectedProducts.includes(product.name) &&
                    "bg-teal-50 text-teal-700",
                  )}
                >
                  {product.display_name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Products:</span>
            <div className="flex items-center gap-1 flex-wrap">
              <SelectedChips
                items={selectedProducts}
                allItems={products as { name: string; display_name: string }[]}
                onRemove={toggleProduct}
              />
              <Popover
                open={isProductSelectorOpen}
                onOpenChange={setIsProductSelectorOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    + Add
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-2" align="start">
                  <div className="space-y-1">
                    {products.map((product) => (
                      <label
                        key={product.name}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-100 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedProducts.includes(product.name)}
                          onCheckedChange={() => toggleProduct(product.name)}
                        />
                        {product.display_name}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Metric Selector */}
        {!isCompact && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Metrics:</span>
            <div className="flex items-center gap-1 flex-wrap">
              <SelectedChips
                items={selectedMetrics}
                allItems={metrics as { key: string; display_name: string }[]}
                onRemove={toggleMetric}
              />
              <Popover
                open={isMetricSelectorOpen}
                onOpenChange={setIsMetricSelectorOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    + Add
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-2" align="start">
                  <div className="space-y-1">
                    {metrics.map((metric) => (
                      <label
                        key={metric.key}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-100 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedMetrics.includes(metric.key)}
                          onCheckedChange={() => toggleMetric(metric.key)}
                        />
                        {metric.display_name}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
