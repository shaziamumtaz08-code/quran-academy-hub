import { BulkImportWizard } from "@/components/import/BulkImportWizard";

interface BulkUserImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkUserImportDialog({ open, onOpenChange }: BulkUserImportDialogProps) {
  return (
    <BulkImportWizard
      open={open}
      onOpenChange={onOpenChange}
      type="users"
    />
  );
}
