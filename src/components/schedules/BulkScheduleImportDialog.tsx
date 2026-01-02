import { BulkImportWizard } from "@/components/import/BulkImportWizard";

interface BulkScheduleImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkScheduleImportDialog({ open, onOpenChange }: BulkScheduleImportDialogProps) {
  return (
    <BulkImportWizard
      open={open}
      onOpenChange={onOpenChange}
      type="schedules"
    />
  );
}
