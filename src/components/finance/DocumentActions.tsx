import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Download, Printer } from 'lucide-react';

interface DocumentActionsProps {
  onView?: () => void;
  onDownload?: () => void;
  onPrint?: () => void;
  size?: 'sm' | 'default';
  className?: string;
}

export function DocumentActions({ onView, onDownload, onPrint, size = 'sm', className = '' }: DocumentActionsProps) {
  return (
    <div className={`flex items-center gap-1.5 print:hidden ${className}`}>
      {onView && (
        <Button variant="outline" size={size} className="gap-1.5" onClick={onView}>
          <Eye className="h-3.5 w-3.5" /> View
        </Button>
      )}
      {onDownload && (
        <Button variant="outline" size={size} className="gap-1.5" onClick={onDownload}>
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
      )}
      {onPrint && (
        <Button variant="outline" size={size} className="gap-1.5" onClick={onPrint}>
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
      )}
    </div>
  );
}

/** Wrapper that renders a document template for print + provides download/print actions */
export function PrintableDocument({
  children,
  title = 'Document',
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="print:hidden flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
        <h2 className="text-sm font-semibold">{title}</h2>
        <DocumentActions
          onPrint={handlePrint}
          onDownload={handlePrint}
        />
      </div>
      <div ref={printRef} className="overflow-auto">
        {children}
      </div>
    </div>
  );
}
