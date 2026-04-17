import React, { useState } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Loader2, 
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';

interface ExportUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserIds: string[];
  searchTerm: string;
  filteredUserIds?: string[];
  filteredCount?: number;
  totalUsers: number;
}

const EXPORT_FIELDS = [
  { id: 'id', label: 'User ID', default: true },
  { id: 'full_name', label: 'Full Name', default: true },
  { id: 'email', label: 'Email', default: true },
  { id: 'whatsapp_number', label: 'Phone', default: true },
  { id: 'role', label: 'Role', default: true },
  { id: 'gender', label: 'Gender', default: true },
  { id: 'age', label: 'Age', default: true },
  { id: 'country', label: 'Country', default: true },
  { id: 'city', label: 'City', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'created_at', label: 'Created Date', default: true },
  { id: 'password', label: 'Password (Plain Text)', default: false, sensitive: true },
];

export function ExportUsersDialog({
  open,
  onOpenChange,
  selectedUserIds,
  searchTerm,
  filteredUserIds = [],
  filteredCount,
  totalUsers,
}: ExportUsersDialogProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const hasFilter = filteredUserIds.length > 0 && filteredUserIds.length !== totalUsers;
  
  const [exportType, setExportType] = useState<'selected' | 'filtered' | 'all'>('all');
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.filter(f => f.default).map(f => f.id)
  );
  const [includePasswords, setIncludePasswords] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

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
          includePasswords,
          adminId: user.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Export failed');
      }

      // The response.data should be the file content
      return response.data;
    },
    onSuccess: (data) => {
      // Create blob and download
      const blob = new Blob([data], { 
        type: format === 'csv' ? 'text/csv' : 'application/vnd.ms-excel' 
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
      setShowConfirmation(false);
    },
    onError: (error) => {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
      setShowConfirmation(false);
    },
  });

  const toggleField = (fieldId: string) => {
    if (selectedFields.includes(fieldId)) {
      setSelectedFields(selectedFields.filter(f => f !== fieldId));
      if (fieldId === 'password') {
        setIncludePasswords(false);
      }
    } else {
      setSelectedFields([...selectedFields, fieldId]);
    }
  };

  const handleExport = () => {
    if (includePasswords || selectedFields.includes('password')) {
      setShowConfirmation(true);
    } else {
      exportMutation.mutate();
    }
  };

  const getExportCount = () => {
    switch (exportType) {
      case 'selected':
        return selectedUserIds.length;
      case 'filtered':
        return filteredCount ?? filteredUserIds.length;
      case 'all':
        return totalUsers;
      default:
        return 0;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
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
              <RadioGroup value={exportType} onValueChange={(v) => setExportType(v as 'selected' | 'filtered' | 'all')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value="selected" 
                    id="selected" 
                    disabled={selectedUserIds.length === 0}
                  />
                  <Label htmlFor="selected" className="flex items-center gap-2">
                    Selected Users
                    {selectedUserIds.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedUserIds.length}
                      </Badge>
                    )}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value="filtered" 
                    id="filtered"
                    disabled={!searchTerm}
                  />
                  <Label htmlFor="filtered" className="flex items-center gap-2">
                    Filtered Users
                    {searchTerm && (
                      <Badge variant="outline" className="text-xs">
                        "{searchTerm}"
                      </Badge>
                    )}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="flex items-center gap-2">
                    All Users
                    <Badge variant="secondary" className="text-xs">
                      {totalUsers}
                    </Badge>
                  </Label>
                </div>
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

            {/* Field Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Fields to Export</Label>
              <div className="grid grid-cols-2 gap-2">
                {EXPORT_FIELDS.map((field) => (
                  <div key={field.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={field.id}
                      checked={selectedFields.includes(field.id)}
                      onCheckedChange={() => toggleField(field.id)}
                    />
                    <Label 
                      htmlFor={field.id} 
                      className={`text-sm ${field.sensitive ? 'text-amber-600 dark:text-amber-400' : ''}`}
                    >
                      {field.label}
                      {field.sensitive && <ShieldAlert className="h-3 w-3 inline ml-1" />}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Include Passwords Toggle */}
            {selectedFields.includes('password') && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                    <Label htmlFor="include-passwords" className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Include Passwords
                    </Label>
                  </div>
                  <Switch
                    id="include-passwords"
                    checked={includePasswords}
                    onCheckedChange={setIncludePasswords}
                  />
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Note: Passwords managed by the authentication system cannot be exported in plain text.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleExport}
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
                  Export {getExportCount()} Users
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Security Warning Confirmation */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Security Warning
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-medium text-foreground">
                This export contains sensitive credentials.
              </p>
              <p>
                You are about to export user data that may include sensitive information. 
                Please handle the exported file securely and ensure it is stored in a protected location.
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Do not share this file over unsecured channels</li>
                <li>Delete the file after use</li>
                <li>This action will be logged for audit purposes</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => exportMutation.mutate()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              I Understand, Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
