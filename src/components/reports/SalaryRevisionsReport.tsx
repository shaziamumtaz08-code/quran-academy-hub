import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SalarySheetAuditPanel } from '@/components/finance/SalarySheetAuditPanel';

/**
 * Reports → Salary Revisions.
 * Same reconciliation engine used by the Salary Engine audit, exposed in Reports
 * with month-range, staff and issue-type filters so admins can see exactly how
 * many sheets are revision-due at any time.
 */
export default function SalaryRevisionsReport() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Salary sheets needing revision</CardTitle>
        <p className="text-sm text-muted-foreground">
          Every teacher × month checked against the assignments genuinely active in that month. Filter by period,
          staff member or issue type, then regenerate flagged sheets or open the month to review.
        </p>
      </CardHeader>
      <CardContent>
        <SalarySheetAuditPanel />
      </CardContent>
    </Card>
  );
}
