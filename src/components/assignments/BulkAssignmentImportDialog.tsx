import { BulkImportWizard } from "@/components/import/BulkImportWizard";

interface BulkAssignmentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkAssignmentImportDialog({ open, onOpenChange }: BulkAssignmentImportDialogProps) {
  return (
    <BulkImportWizard
      open={open}
      onOpenChange={onOpenChange}
      type="assignments"
    />
  );
}
