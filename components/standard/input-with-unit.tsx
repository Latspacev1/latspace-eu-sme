import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface InputWithUnitProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  inputClassName?: string;
  id?: string;
  error?: string;
}

export function InputWithUnit({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step,
  className,
  inputClassName,
  id,
  error,
}: InputWithUnitProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="flex items-center gap-1">
        <Input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={cn(
            "text-right font-mono",
            error && "border-destructive",
            inputClassName,
          )}
          min={min}
          max={max}
          step={step}
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {unit}
        </span>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
