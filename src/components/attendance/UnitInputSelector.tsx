import React, { useMemo } from 'react';
import { AlertCircle, Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  type LearningUnit, 
  type MushafType,
  LEARNING_UNITS, 
  convertToLines, 
  formatUnitDisplay 
} from '@/lib/quranData';

interface UnitInputSelectorProps {
  inputUnit: LearningUnit;
  onInputUnitChange: (unit: LearningUnit) => void;
  inputAmount: string;
  onInputAmountChange: (amount: string) => void;
  mushafType: MushafType | string;
  dailyTargetLines: number;
  preferredUnit?: LearningUnit;
  showConversion?: boolean;
}

export function UnitInputSelector({
  inputUnit,
  onInputUnitChange,
  inputAmount,
  onInputAmountChange,
  mushafType,
  dailyTargetLines,
  preferredUnit = 'lines',
  showConversion = true,
}: UnitInputSelectorProps) {
  const amountNum = parseFloat(inputAmount) || 0;
  
  // Calculate line equivalent
  const lineEquivalent = useMemo(() => {
    return convertToLines(amountNum, inputUnit, mushafType);
  }, [amountNum, inputUnit, mushafType]);

  const isBelowTarget = lineEquivalent > 0 && lineEquivalent < dailyTargetLines;
  const percentOfTarget = dailyTargetLines > 0 ? Math.round((lineEquivalent / dailyTargetLines) * 100) : 0;

  // Get the label for the input based on unit
  const getInputLabel = () => {
    switch (inputUnit) {
      case 'pages':
        return 'Pages Completed';
      case 'rukus':
        return 'Rukus Completed';
      case 'quarters':
        return 'Quarters (Hizb) Completed';
      default:
        return 'Lines Completed';
    }
  };

  const getInputPlaceholder = () => {
    switch (inputUnit) {
      case 'pages':
        return 'e.g., 2';
      case 'rukus':
        return 'e.g., 1';
      case 'quarters':
        return 'e.g., 0.5';
      default:
        return 'e.g., 15';
    }
  };

  const getInputStep = () => {
    switch (inputUnit) {
      case 'quarters':
        return '0.25';
      case 'pages':
        return '0.5';
      default:
        return '1';
    }
  };

  return (
    <div className="space-y-4">
      {/* Unit Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Input Unit</Label>
        <Select value={inputUnit} onValueChange={(v) => onInputUnitChange(v as LearningUnit)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEARNING_UNITS.map((unit) => (
              <SelectItem key={unit.value} value={unit.value}>
                {unit.label}
                {unit.value === preferredUnit && (
                  <span className="ml-2 text-xs text-primary">(Preferred)</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <Label htmlFor="inputAmount">{getInputLabel()}</Label>
        <Input
          id="inputAmount"
          type="number"
          min="0"
          step={getInputStep()}
          placeholder={getInputPlaceholder()}
          value={inputAmount}
          onChange={(e) => onInputAmountChange(e.target.value)}
        />
      </div>

      {/* Conversion Display */}
      {showConversion && amountNum > 0 && inputUnit !== 'lines' && (
        <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            <span className="font-medium">{formatUnitDisplay(amountNum, inputUnit)}</span>
            <span className="text-muted-foreground"> = </span>
            <span className="font-medium text-primary">{Math.round(lineEquivalent)} Lines</span>
          </span>
        </div>
      )}

      {/* Target Progress */}
      {amountNum > 0 && (
        <div className={`p-3 rounded-lg ${isBelowTarget ? 'bg-accent/10 border border-accent/20' : 'bg-emerald-light/10 border border-emerald-light/20'}`}>
          <div className="flex items-center gap-2">
            {isBelowTarget ? (
              <AlertCircle className="h-4 w-4 text-accent" />
            ) : (
              <div className="h-4 w-4 rounded-full bg-emerald-light flex items-center justify-center">
                <span className="text-[10px] text-white font-bold">✓</span>
              </div>
            )}
            <span className="text-sm">
              {isBelowTarget ? (
                <>
                  <span className="text-accent font-medium">{percentOfTarget}% of target</span>
                  <span className="text-muted-foreground"> - Below daily goal of {dailyTargetLines} lines</span>
                </>
              ) : (
                <>
                  <span className="text-emerald-light font-medium">{percentOfTarget}% of target</span>
                  <span className="text-muted-foreground"> - Met or exceeded daily goal!</span>
                </>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
