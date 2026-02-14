import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calculator, Pencil, Check, X } from 'lucide-react';

interface FeePackage {
  id: string;
  name: string;
  amount: number;
  currency: string;
  days_per_week: number;
}

interface DiscountRule {
  id: string;
  name: string;
  type: string;
  value: number;
}

interface BillingCalculatorProps {
  feePackage: FeePackage | null;
  durationMinutes: number;
  discount: DiscountRule | null;
  startDate: string;
  overriddenProrated: number | null;
  onOverrideChange: (val: number | null) => void;
}

export function BillingCalculator({
  feePackage,
  durationMinutes,
  discount,
  startDate,
  overriddenProrated,
  onOverrideChange,
}: BillingCalculatorProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState('');

  const calculation = useMemo(() => {
    if (!feePackage) return null;

    // Step A: Duration multiplier
    const durationMultiplier = durationMinutes / 30;
    const adjustedMonthly = feePackage.amount * durationMultiplier;

    // Step B: Discount
    let finalMonthly = adjustedMonthly;
    let discountAmount = 0;
    if (discount) {
      if (discount.type === 'percentage') {
        discountAmount = adjustedMonthly * (discount.value / 100);
      } else {
        discountAmount = discount.value;
      }
      finalMonthly = Math.max(0, adjustedMonthly - discountAmount);
    }

    // Step C: Proration
    let proratedFirst = finalMonthly;
    if (startDate) {
      const start = new Date(startDate);
      const year = start.getFullYear();
      const month = start.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dayOfMonth = start.getDate();
      const remainingDays = daysInMonth - dayOfMonth + 1;
      proratedFirst = (finalMonthly / daysInMonth) * remainingDays;
    }

    return {
      baseAmount: feePackage.amount,
      durationMultiplier,
      adjustedMonthly,
      discountAmount,
      finalMonthly,
      proratedFirst: Math.round(proratedFirst * 100) / 100,
      currency: feePackage.currency,
    };
  }, [feePackage, durationMinutes, discount, startDate]);

  if (!calculation) return null;

  const displayProrated = overriddenProrated ?? calculation.proratedFirst;

  const handleStartEdit = () => {
    setEditValue(displayProrated.toFixed(2));
    setIsEditing(true);
  };

  const handleConfirmEdit = () => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) {
      onOverrideChange(val);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    onOverrideChange(null);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Calculator className="h-4 w-4" />
          Fee Calculation Preview
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Base ({feePackage!.days_per_week} days/wk, 30 min)</span>
            <span>{calculation.currency} {calculation.baseAmount.toLocaleString()}</span>
          </div>
          {calculation.durationMultiplier !== 1 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration ({durationMinutes} min) ×{calculation.durationMultiplier}</span>
              <span>{calculation.currency} {calculation.adjustedMonthly.toLocaleString()}</span>
            </div>
          )}
          {calculation.discountAmount > 0 && (
            <div className="flex justify-between text-primary">
              <span>Discount ({discount!.name})</span>
              <span>− {calculation.currency} {calculation.discountAmount.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="border-t border-border pt-2 space-y-2">
          <div className="flex justify-between font-semibold">
            <span>Recurring Monthly</span>
            <Badge variant="secondary" className="text-base font-mono">
              {calculation.currency} {calculation.finalMonthly.toLocaleString()}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">
              First Month (Prorated)
              {overriddenProrated !== null && (
                <Badge variant="outline" className="ml-2 text-xs">Override</Badge>
              )}
            </span>
            <div className="flex items-center gap-1">
              {isEditing ? (
                <>
                  <Input
                    type="number"
                    className="w-24 h-7 text-sm text-right"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleConfirmEdit}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEdit}>
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="text-base font-mono">
                    {calculation.currency} {displayProrated.toLocaleString()}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleStartEdit} title="Override amount">
                    <Pencil className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
