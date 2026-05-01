import React, { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

interface ExportUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserIds: string[];
  searchTerm: string;
  filteredUserIds?: string[];
  filteredCount?: number;
  totalUsers: number;
}

interface ExportField {
  id: string;
  label: string;
  default?: boolean;
}

const FIELD_SECTIONS: { title: string; fields: ExportField[] }[] = [
  {
    title: 'Identity',
    fields: [
      { id: 'id', label: 'User ID', default: true },
      { id: 'full_name', label: 'Full Name', default: true },
      { id: 'email', label: 'Email', default: true },
      { id: 'whatsapp_number', label: 'Phone', default: true },
      { id: 'gender', label: 'Gender' },
      { id: 'age', label: 'Age' },
      { id: 'date_of_birth', label: 'Date of Birth' },
      { id: 'nationality', label: 'Nationality' },
      { id: 'urn', label: 'UID / Roll No' },
    ],
  },
  {
    title: 'Contact',
    fields: [
      { id: 'country', label: 'Country' },
      { id: 'city', label: 'City' },
      { id: 'timezone', label: 'Timezone' },
      { id: 'first_language', label: 'First Language' },
      { id: 'arabic_level', label: 'Arabic Level' },
    ],
  },
  {
    title: 'Academic',
    fields: [
      { id: 'role', label: 'Role', default: true },
      { id: 'division', label: 'Division' },
      { id: 'branch', label: 'Branch' },
      { id: 'join_date', label: 'Join Date' },
      { id: 'account_status', label: 'Account Status' },
      { id: 'profile_completion', label: 'Profile Completion %' },
    ],
  },
  {
    title: 'Guardian',
    fields: [
      { id: 'guardian_type', label: 'Guardian Type' },
      { id: 'parent_email', label: 'Parent Email' },
      { id: 'parent_name', label: 'Parent Name' },
    ],
  },
  {
    title: 'System',
    fields: [
      { id: 'created_at', label: 'Created Date' },
    ],
  },
];

const ALL_FIELDS = FIELD_SECTIONS.flatMap(s => s.fields);
const DEFAULT_FIELDS = ALL_FIELDS.filter(f => f.default).map(f => f.id);

type ExportType = 'selected' | 'filtered' | 'all' | 'my_division';

export function ExportUsersDialog({
  open,
  onOpenChange,
  selectedUserIds,
  searchTerm,
  filteredUserIds = [],
  filteredCount,
  totalUsers,
}: ExportUsersDialogProps) {
  const { user, session, activeRole } = useAuth();
  const { toast } = useToast();
  const hasFilter = filteredUserIds.length > 0 && filteredUserIds.length !== totalUsers;

  // Determine which scope options are available based on role
  const scopeOptions = useMemo(() => {
    const role = activeRole || '';
    const opts = {
      selected: true,
      filtered: true,
      all: false,
      myDivision: false,
    };
    if (role === 'super_admin') {
      opts.all = true;
    } else if (role === 'admin' || role === 'admin_division') {
      opts.myDivision = true;
    }
    // admin_admissions, admin_academic: only selected + filtered
    return opts;
  }, [activeRole]);

  const defaultScope: ExportType = scopeOptions.all
    ? 'all'
    : scopeOptions.myDivision
      ? 'my_division'
      : hasFilter
        ? 'filtered'
        : 'selected';

  const [exportType, setExportType] = useState<ExportType>(defaultScope);
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [selectedFields, setSelectedFields] = useState<string[]>(DEFAULT_FIELDS);

  // Reset scope if role changes and current type isn't allowed
  React.useEffect(() => {
    if (exportType === 'all' && !scopeOptions.all) setExportType(defaultScope);
    if (exportType === 'my_division' && !scopeOptions.myDivision) setExportType(defaultScope);
  }, [scopeOptions, exportType, defaultScope]);

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token || !user?.id) {
        throw new Error('Authentication required');
      }

      const idsForExport =
        exportType === 'selected' ? selectedUserIds :
        exportType === 'filtered' ? filteredUserIds :
        undefined;

      const response = await supabase.functions.invoke('export-users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          userIds: idsForExport,
          searchTerm: exportType === 'filtered' ? searchTerm : undefined,
          exportType: exportType === 'filtered' ? 'selected' : exportType,
          format,
          fields: selectedFields,
          includePasswords: false,
          adminId: user.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Export failed');
      }
      return response.data;
    },
    onSuccess: (data) => {
      const blob = new Blob([data], {
        type: format === 'csv' ? 'text/csv' : 'application/vnd.ms-excel',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const filename = `users_export_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.${format === 'csv' ? 'csv' : 'xls'}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: `Users exported to ${filename}`,
      });

      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const toggleField = (fieldId: string) => {
    if (selectedFields.includes(fieldId)) {
      setSelectedFields(selectedFields.filter(f => f !== fieldId));
    } else {
      setSelectedFields([...selectedFields, fieldId]);
    }
  };

  const getExportCount = () => {
    switch (exportType) {
      case 'selected': return selectedUserIds.length;
      case 'filtered': return filteredCount ?? filteredUserIds.length;
      case 'all': return totalUsers;
      case 'my_division': return totalUsers; // shown as label-only count below
      default: return 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Users
          </DialogTitle>
          <DialogDescription>
            Select the data you want to export and the file format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Scope */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Scope</Label>
            <RadioGroup value={exportType} onValueChange={(v) => setExportType(v as ExportType)}>
              {scopeOptions.selected && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="selected"
                    id="selected"
                    disabled={selectedUserIds.length === 0}
                  />
                  <Label htmlFor="selected" className="flex items-center gap-2">
                    Selected Users
                    {selectedUserIds.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{selectedUserIds.length}</Badge>
                    )}
                  </Label>
                </div>
              )}
              {scopeOptions.filtered && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="filtered" id="filtered" disabled={!hasFilter} />
                  <Label htmlFor="filtered" className="flex items-center gap-2">
                    Filtered Users
                    {hasFilter && (
                      <Badge variant="outline" className="text-xs">
                        {filteredCount ?? filteredUserIds.length}
                      </Badge>
                    )}
                  </Label>
                </div>
              )}
              {scopeOptions.myDivision && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="my_division" id="my_division" />
                  <Label htmlFor="my_division" className="flex items-center gap-2">
                    My Division Users
                  </Label>
                </div>
              )}
              {scopeOptions.all && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="flex items-center gap-2">
                    All Users
                    <Badge variant="secondary" className="text-xs">{totalUsers}</Badge>
                  </Label>
                </div>
              )}
            </RadioGroup>
          </div>

          {/* File Format */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">File Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'csv' | 'xlsx')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  CSV (.csv)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label htmlFor="xlsx" className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel (.xls)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Field Selection — Sectioned */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Fields to Export</Label>
            {FIELD_SECTIONS.map(section => (
              <div key={section.title} className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {section.title}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {section.fields.map((field) => (
                    <div key={field.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={field.id}
                        checked={selectedFields.includes(field.id)}
                        onCheckedChange={() => toggleField(field.id)}
                      />
                      <Label htmlFor={field.id} className="text-sm cursor-pointer">
                        {field.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => exportMutation.mutate()}
            disabled={selectedFields.length === 0 || exportMutation.isPending}
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {exportType === 'my_division' ? '' : `${getExportCount()} `}Users
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
