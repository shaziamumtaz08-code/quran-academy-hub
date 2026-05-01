import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Settings, 
  Search,
  Edit,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Phone,
  Mail,
  Calendar,
  User,
  Lock,
  Save,
  X,
  Plus,
  Minus,
  Upload,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Archive,
  ArchiveRestore,
  MapPin,
  MessageCircle,
  Network,
  Crown,
  GraduationCap,
  Heart,
  Briefcase,
  HelpCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BulkUserImportDialog } from '@/components/users/BulkUserImportDialog';
import { ExportUsersDialog } from '@/components/users/ExportUsersDialog';
import { HolisticUserProfileDrawer } from '@/components/users/HolisticUserProfileDrawer';
import { AssignRoleDialog } from '@/components/users/AssignRoleDialog';
import { AuthAuditTab } from '@/components/admin/AuthAuditTab';
import { Checkbox } from '@/components/ui/checkbox';
import { Country, State, City, ICountry, IState, ICity } from 'country-state-city';
import { SearchableCitySelect } from '@/components/ui/searchable-city-select';
import { useDivisionMembership, getDivisionShortName, getDivisionBadgeClass, formatRoleLabel } from '@/hooks/useDivisionMembership';
import { useDivision } from '@/contexts/DivisionContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, ChevronDown, ChevronRight, ChevronUp, AlertTriangle, Video, Presentation, ClipboardCheck, UserCircle2 } from 'lucide-react';

const ALL_PERMISSIONS = [
  { group: 'Users', permissions: ['users.view', 'users.create', 'users.edit', 'users.delete', 'users.assign_roles'] },
  { group: 'Students', permissions: ['students.view', 'students.create', 'students.edit', 'students.delete'] },
  { group: 'Teachers', permissions: ['teachers.view', 'teachers.create', 'teachers.edit', 'teachers.delete'] },
  { group: 'Exams', permissions: ['exams.view', 'exams.create', 'exams.edit', 'exams.delete', 'exams.grade'] },
  { group: 'Attendance', permissions: ['attendance.view', 'attendance.mark', 'attendance.edit'] },
  { group: 'Schedules', permissions: ['schedules.view', 'schedules.create', 'schedules.edit', 'schedules.delete'] },
  { group: 'Reports', permissions: ['reports.view', 'reports.generate'] },
  { group: 'Payments', permissions: ['payments.view', 'payments.create', 'payments.edit'] },
  { group: 'Settings', permissions: ['settings.view', 'settings.edit'] },
  { group: 'Dashboard', permissions: ['dashboard.admin', 'dashboard.teacher', 'dashboard.student', 'dashboard.parent'] },
];

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  admin_division: 'Division Admin',
  admin_admissions: 'Admissions Manager',
  admin_fees: 'Finance Manager',
  admin_academic: 'Academic Manager',
  teacher: 'Teacher',
  examiner: 'Examiner',
  student: 'Student',
  parent: 'Parent',
};

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: 'bg-red-500/10 text-red-700 border-red-200',
  admin: 'bg-purple-500/10 text-purple-700 border-purple-200',
  admin_division: 'bg-purple-500/10 text-purple-700 border-purple-200',
  admin_admissions: 'bg-blue-500/10 text-blue-700 border-blue-200',
  admin_fees: 'bg-green-500/10 text-green-700 border-green-200',
  admin_academic: 'bg-orange-500/10 text-orange-700 border-orange-200',
  teacher: 'bg-teal-500/10 text-teal-700 border-teal-200',
  examiner: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
  student: 'bg-sky-500/10 text-sky-700 border-sky-200',
  parent: 'bg-pink-500/10 text-pink-700 border-pink-200',
};

// Premium pill styles for role badges (soft tinted background + colored dot)
const ROLE_PILL: Record<AppRole, { bg: string; text: string; dot: string }> = {
  super_admin: { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  admin: { bg: 'bg-slate-100 dark:bg-slate-500/15', text: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-500' },
  admin_division: { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  admin_admissions: { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  admin_fees: { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  admin_academic: { bg: 'bg-orange-100 dark:bg-orange-500/15', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  teacher: { bg: 'bg-violet-100 dark:bg-violet-500/15', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  examiner: { bg: 'bg-indigo-100 dark:bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
  student: { bg: 'bg-teal-100 dark:bg-teal-500/15', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  parent: { bg: 'bg-pink-100 dark:bg-pink-500/15', text: 'text-pink-700 dark:text-pink-300', dot: 'bg-pink-500' },
};

const RolePill = ({ role, prefix }: { role: AppRole; prefix?: string }) => {
  const p = ROLE_PILL[role] || ROLE_PILL.student;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${p.bg} ${p.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
      {prefix && <><span className="font-semibold">{prefix}</span><span className="opacity-50">·</span></>}
      <span>{formatRoleLabel(role)}</span>
    </span>
  );
};

// ─── Identity Icons ──────────────────────────────────────────────────────
// Inline icons that appear inside the URN pill: divisions a user belongs to,
// plus a crown for global admin/super_admin roles. Mirrors the legend.
type IdentityIconKind = 'division-1to1' | 'division-group' | 'division-recorded' | 'admin-crown';

// Division color palette — also applied to role icons (Teacher/Student) per division.
const DIVISION_COLOR: Record<'1to1' | 'group' | 'recorded', string> = {
  '1to1':     'text-blue-600 dark:text-blue-400',
  'group':    'text-orange-700 dark:text-orange-500',
  'recorded': 'text-yellow-500 dark:text-yellow-400',
};

const IDENTITY_ICON_META: Record<IdentityIconKind, { Icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  'division-1to1':     { Icon: UserCircle2, color: DIVISION_COLOR['1to1'],     label: '1:1 Mentorship' },
  'division-group':    { Icon: Users,       color: DIVISION_COLOR['group'],    label: 'Group Academy' },
  'division-recorded': { Icon: Video,       color: DIVISION_COLOR['recorded'], label: 'Recorded' },
  'admin-crown':       { Icon: Crown,       color: 'text-rose-600 dark:text-rose-400', label: 'Admin / Super Admin' },
};

const divisionIconKind = (modelType: string, divisionName: string): IdentityIconKind => {
  const m = (modelType || '').toLowerCase();
  const n = (divisionName || '').toLowerCase();
  if (m === 'one_to_one' || n.includes('1:1') || n.includes('1-to-1') || n.includes('mentorship')) return 'division-1to1';
  if (n.includes('recorded')) return 'division-recorded';
  return 'division-group';
};

// Avatar background colors per primary role
const AVATAR_COLORS: Record<string, string> = {
  super_admin: 'bg-red-600',
  admin: 'bg-slate-700',
  admin_admissions: 'bg-blue-600',
  admin_fees: 'bg-emerald-600',
  admin_academic: 'bg-orange-600',
  teacher: 'bg-violet-600',
  examiner: 'bg-indigo-600',
  student: 'bg-teal-600',
  parent: 'bg-pink-600',
  default: 'bg-slate-500',
};

const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getPrimaryRole = (roles: AppRole[] | undefined): AppRole | 'default' => {
  if (!roles || roles.length === 0) return 'default';
  const priority: AppRole[] = ['super_admin', 'admin', 'admin_admissions', 'admin_fees', 'admin_academic', 'teacher', 'examiner', 'parent', 'student'];
  for (const r of priority) if (roles.includes(r)) return r;
  return roles[0];
};

// Map dial code → flag emoji (covers common codes; falls back to globe)
const dialCodeToFlag = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const p = phone.replace(/[^\d+]/g, '');
  const map: Record<string, string> = {
    '+92': '🇵🇰', '+1': '🇺🇸', '+44': '🇬🇧', '+91': '🇮🇳', '+971': '🇦🇪', '+966': '🇸🇦',
    '+61': '🇦🇺', '+49': '🇩🇪', '+33': '🇫🇷', '+39': '🇮🇹', '+34': '🇪🇸', '+90': '🇹🇷',
    '+880': '🇧🇩', '+60': '🇲🇾', '+62': '🇮🇩', '+86': '🇨🇳', '+81': '🇯🇵', '+82': '🇰🇷',
    '+27': '🇿🇦', '+20': '🇪🇬', '+212': '🇲🇦', '+974': '🇶🇦', '+965': '🇰🇼', '+973': '🇧🇭',
    '+968': '🇴🇲', '+964': '🇮🇶', '+98': '🇮🇷', '+93': '🇦🇫', '+7': '🇷🇺', '+31': '🇳🇱',
    '+32': '🇧🇪', '+46': '🇸🇪', '+47': '🇳🇴', '+45': '🇩🇰', '+358': '🇫🇮', '+48': '🇵🇱',
    '+353': '🇮🇪', '+64': '🇳🇿', '+65': '🇸🇬', '+852': '🇭🇰', '+66': '🇹🇭', '+84': '🇻🇳',
    '+63': '🇵🇭', '+92322': '🇵🇰',
  };
  // Try longest match first
  const codes = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const c of codes) if (p.startsWith(c)) return map[c];
  return '🌐';
};

interface UserWithRoles {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_number: string | null;
  gender: string | null;
  age: number | null;
  country: string | null;
  city: string | null;
  created_at: string;
  archived_at: string | null;
  registration_id: string | null;
  roles: AppRole[];
  exceptions: Array<{ permission: string; is_granted: boolean }>;
}

export default function UserManagement() {
  const { isSuperAdmin, hasPermission, user: currentUser, session, activeRole } = useAuth();
  const { activeDivision } = useDivision();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const staffMode = new URLSearchParams(location.search).get('mode') === 'staff';
  const TEACHING_ROLES: AppRole[] = ['teacher', 'student', 'parent'];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [holisticUserId, setHolisticUserId] = useState<string | null>(null);
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserWithRoles | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserWithRoles | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [removeRoleConfirm, setRemoveRoleConfirm] = useState<{ user: UserWithRoles; role: AppRole } | null>(null);
  const [replaceConflictState, setReplaceConflictState] = useState<{ user: UserWithRoles; newRole: AppRole; conflictingRoles: AppRole[] } | null>(null);
  const [replaceConfirmText, setReplaceConfirmText] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('student');
  const [newUserWhatsapp, setNewUserWhatsapp] = useState('');
  const [newUserGender, setNewUserGender] = useState<'male' | 'female' | ''>('');
  const [newUserAge, setNewUserAge] = useState('');
  const [newUserCountry, setNewUserCountry] = useState('PK');  // ISO code default Pakistan
  const [newUserCity, setNewUserCity] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [addRoleSelection, setAddRoleSelection] = useState<AppRole>('student');
  const [createAsSibling, setCreateAsSibling] = useState(false); // For creating siblings with shared email
  const [newUserBranchId, setNewUserBranchId] = useState('');
  const [newUserParentId, setNewUserParentId] = useState('');
  const [newUserDivisionId, setNewUserDivisionId] = useState('');
  const [newUserDob, setNewUserDob] = useState('');
  const [newUserTimezone, setNewUserTimezone] = useState('');
  const [newUserGuardianType, setNewUserGuardianType] = useState<'' | 'none' | 'parent' | 'guardian' | 'emergency'>('');
  const [newUserParentEmail, setNewUserParentEmail] = useState('');
  const [newUserParentName, setNewUserParentName] = useState('');
  const [newUserParentExisting, setNewUserParentExisting] = useState(false);
  const [emailExistsCheck, setEmailExistsCheck] = useState<{ id: string; full_name: string | null } | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [assignRoleUser, setAssignRoleUser] = useState<UserWithRoles | null>(null);
  const [showNoRoleOnly, setShowNoRoleOnly] = useState(false);

  // View/Edit dialog states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editGender, setEditGender] = useState<'male' | 'female' | ''>('');
  const [editAge, setEditAge] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Location filter states
  const [filterCountry, setFilterCountry] = useState<string>('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterDivision, setFilterDivision] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  // Sorting state
  type SortField = 'name' | 'role' | 'gender' | 'age' | 'country' | 'city';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Check access permission
  const canAccessPage = isSuperAdmin || hasPermission('users.view');

  // Open profile drawer with permission check (prevents blank-page bug for unauthorized roles)
  const openProfileDrawer = (userId: string) => {
    const ADMIN_VIEWERS: AppRole[] = ['super_admin', 'admin', 'admin_division', 'admin_admissions', 'admin_academic'];
    const role = activeRole as AppRole | null;
    const allowed = isSuperAdmin || (role && ADMIN_VIEWERS.includes(role));
    if (!allowed) {
      toast({ title: 'Access denied', description: 'You do not have permission to view user profiles.', variant: 'destructive' });
      return;
    }
    setHolisticUserId(userId);
  };

  // Fetch users with profiles and ALL roles
  const { data: users, isLoading: usersLoading, error: usersError, refetch, isFetching } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get ALL roles for each user
      const usersWithRoles: UserWithRoles[] = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);

          const { data: exceptions } = await supabase
            .from('permission_exceptions')
            .select('permission, is_granted')
            .eq('user_id', profile.id);

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            whatsapp_number: profile.whatsapp_number,
            gender: profile.gender,
            age: profile.age,
            country: profile.country,
            city: profile.city,
            created_at: profile.created_at,
            archived_at: profile.archived_at,
            registration_id: (profile as any).registration_id ?? null,
            roles: (rolesData || []).map(r => r.role as AppRole),
            exceptions: exceptions || [],
          };
        })
      );

      return usersWithRoles;
    },
  });

  // Fetch role templates
  const { data: roleTemplates } = useQuery({
    queryKey: ['role-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Fetch timezone mappings for country/city dropdowns (kept for edit backward compat)
  const { data: timezoneMappings = [] } = useQuery({
    queryKey: ['timezone-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timezone_mappings')
        .select('country, city, timezone')
        .order('country')
        .order('city');
      
      if (error) throw error;
      return data as Array<{ country: string; city: string; timezone: string }>;
    },
  });

  // Fetch branches for branch selector in create dialog
  const { data: branches = [] } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Array<{ id: string; name: string; code: string | null }>;
    },
  });

  // Fetch parent-role users for linking
  const { data: parentUsers = [] } = useQuery({
    queryKey: ['parent-users-for-linking'],
    queryFn: async () => {
      const { data: parentRoles, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'parent');
      if (error || !parentRoles) return [];
      const parentIds = parentRoles.map(r => r.user_id);
      if (parentIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', parentIds)
        .order('full_name');
      return (profiles || []) as Array<{ id: string; full_name: string; email: string | null }>;
    },
  });

  // Get unique countries (from timezone_mappings for backward compat - used in edit form as fallback)
  const oldCountries = [...new Set(timezoneMappings.map(t => t.country))];
  
  // Get cities for selected country (legacy)
  const getCitiesForCountryOld = (country: string) => {
    return timezoneMappings.filter(t => t.country === country).map(t => t.city);
  };

  // World data from country-state-city
  const allCountries = useMemo(() => Country.getAllCountries(), []);
  const getCitiesForCountry = (countryCode: string) => {
    return City.getCitiesOfCountry(countryCode) || [];
  };

  // Helper to get country name from ISO code
  const getCountryName = (isoCode: string) => {
    const c = Country.getCountryByCode(isoCode);
    return c ? c.name : isoCode;
  };

  // Add role to user mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role, replaceConflicting }: { userId: string; role: AppRole; replaceConflicting?: boolean }) => {
      if (!session?.access_token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const { data, error } = await supabase.functions.invoke('assign-role', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { userId, role, replaceConflicting: !!replaceConflicting },
      });

      if (error) {
        if (error instanceof FunctionsHttpError) {
          const errBody = await error.context.json().catch(() => null);
          if (errBody && errBody.error === 'ROLE_CONFLICT') {
            const conflictErr: any = new Error(errBody.message || 'Role conflict');
            conflictErr.code = 'ROLE_CONFLICT';
            conflictErr.conflictingRoles = errBody.conflictingRoles || [];
            throw conflictErr;
          }
          throw new Error(
            (errBody && typeof errBody.error === 'string' && errBody.error) ||
              error.message ||
              'Failed to add role'
          );
        }
        if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
          throw new Error(error.message || 'Failed to add role');
        }
        throw new Error(error.message || 'Failed to add role');
      }

      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Role added',
        description: data?.message || 'Role has been added successfully.',
      });
      setIsAddRoleDialogOpen(false);
      setReplaceConflictState(null);
      setReplaceConfirmText('');
    },
    onError: (error: any) => {
      if (error?.code === 'ROLE_CONFLICT' && viewingUser) {
        setReplaceConflictState({
          user: viewingUser,
          newRole: addRoleSelection,
          conflictingRoles: error.conflictingRoles || [],
        });
        setReplaceConfirmText('');
        return;
      }
      toast({
        title: 'Failed to add role',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Remove role mutation (via edge function: super_admin gated, audited, last-role guarded)
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      if (!session?.access_token) {
        throw new Error('Authentication required. Please log in again.');
      }
      const { data, error } = await supabase.functions.invoke('remove-role', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { userId, role },
      });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const errBody = await error.context.json().catch(() => null);
          throw new Error((errBody && errBody.error) || error.message || 'Failed to remove role');
        }
        throw new Error(error.message || 'Failed to remove role');
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Role removed',
        description: 'Role has been removed successfully.',
      });
      setRemoveRoleConfirm(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to remove role',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Update permission exception mutation
  const updateExceptionMutation = useMutation({
    mutationFn: async ({ 
      userId, 
      permission, 
      isGranted 
    }: { 
      userId: string; 
      permission: string; 
      isGranted: boolean | null;
    }) => {
      if (isGranted === null) {
        const { error } = await supabase
          .from('permission_exceptions')
          .delete()
          .eq('user_id', userId)
          .eq('permission', permission);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('permission_exceptions')
          .upsert({
            user_id: userId,
            permission,
            is_granted: isGranted,
          }, {
            onConflict: 'user_id,permission',
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Permission updated',
        description: 'Permission exception has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update permission',
        variant: 'destructive',
      });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (payload: {
      email: string;
      password?: string;
      fullName: string;
      role: AppRole;
      whatsapp?: string;
      gender?: 'male' | 'female';
      country?: string;
      city?: string;
      branch_id?: string;
      division_id?: string;
      date_of_birth?: string;
      timezone?: string;
      guardian_type?: string;
      parent_email?: string;
      parent_name?: string;
      parentExistingOnly?: boolean;
      parent_id?: string;
      addRoleOnly?: boolean;
      existingUserId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: payload,
      });
      if (error) {
        let serverMsg = error.message || 'Failed to create user';
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const b = await ctx.json();
            if (b?.message) serverMsg = b.message;
            else if (b?.error) serverMsg = b.error;
          } else if (ctx && typeof ctx.text === 'function') {
            const txt = await ctx.text();
            try { const b = JSON.parse(txt); if (b?.message) serverMsg = b.message; else if (b?.error) serverMsg = b.error; } catch { if (txt) serverMsg = txt; }
          }
        } catch { /* keep */ }
        throw new Error(serverMsg);
      }
      if (data?.error) throw new Error(data.message || data.error);
      return data as {
        userId: string;
        roleAdded?: boolean;
        alreadyExists?: boolean;
        message?: string;
        email?: string;
        role?: AppRole;
        registration_id?: string;
      };
    },
    onSuccess: (data) => {
      // Ensure the list refreshes immediately so the UI matches the toast
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.refetchQueries({ queryKey: ['users-with-roles'] });

      const title = data?.alreadyExists
        ? 'User already exists'
        : data?.roleAdded
          ? 'Role added'
          : 'User created';

      toast({
        title,
        description: data?.message || 'Operation completed successfully.',
      });

      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setNewUserRole('student');
      setNewUserWhatsapp('');
      setNewUserGender('');
      setNewUserAge('');
      setNewUserCountry('PK');
      setNewUserCity('');
      setNewUserBranchId('');
      setNewUserParentId('');
      setNewUserDivisionId('');
      setNewUserDob('');
      setNewUserTimezone('');
      setNewUserGuardianType('');
      setNewUserParentEmail('');
      setNewUserParentName('');
      setNewUserParentExisting(false);
      setEmailExistsCheck(null);
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create user',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId },
      });
      if (error) throw new Error(error.message || 'Failed to delete user');
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'User deleted',
        description: 'User was deleted successfully.',
      });
      setDeleteConfirmUser(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete user',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      fullName,
      email,
      whatsapp,
      gender,
      age,
      country,
      city,
      password,
    }: {
      userId: string;
      fullName?: string;
      email?: string;
      whatsapp?: string | null;
      gender?: 'male' | 'female' | null;
      age?: number | null;
      country?: string | null;
      city?: string | null;
      password?: string;
    }) => {
      let { data: sess } = await supabase.auth.getSession();
      const expiresAt = sess.session?.expires_at ? sess.session.expires_at * 1000 : 0;
      const isExpiringSoon = !expiresAt || expiresAt - Date.now() < 60_000;

      if (!sess.session || isExpiringSoon) {
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr || !refreshed.session) {
          throw new Error('Your session has expired. Please sign in again.');
        }
        sess = { session: refreshed.session } as any;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sess.session!.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ userId, fullName, email, whatsapp, gender, age, country, city, password }),
        }
      );

      const data = await resp.json().catch(() => ({}));
      const message = data?.error || `Failed to update user (${resp.status})`;

      if (!resp.ok) {
        if (resp.status === 400) {
          return { success: false as const, validationError: message };
        }
        throw new Error(message);
      }

      if (data?.error) {
        return { success: false as const, validationError: data.error as string };
      }

      return { success: true as const };
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast({
          title: 'Update blocked',
          description: result.validationError,
          variant: 'destructive',
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'User updated',
        description: 'User details have been updated successfully.',
      });
      setIsEditMode(false);
      setEditPassword('');
    },
    onError: (error) => {
      toast({
        title: 'Failed to update user',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Archive/Unarchive user mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ userId, archive }: { userId: string; archive: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ archived_at: archive ? new Date().toISOString() : null })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: variables.archive ? 'User Archived' : 'User Restored',
        description: variables.archive ? 'User has been archived.' : 'User has been restored from archive.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update archive status',
        variant: 'destructive',
      });
    },
  });
  // Fetch divisions for filter dropdown
  const { data: allDivisions = [] } = useQuery({
    queryKey: ['all-divisions-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('divisions')
        .select('id, name, model_type')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Array<{ id: string; name: string; model_type: string }>;
    },
  });

  // Division membership resolution
  const allUserIds = useMemo(() => (users || []).map(u => u.id), [users]);
  const { data: divMembershipMap } = useDivisionMembership(allUserIds, !!users && users.length > 0);

  // Permanent person number: AQT-NNNNNN derived from profiles ordered by created_at ASC.
  // Stable per person — survives role changes, division moves, re-enrollments.
  const personNumberMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!users) return m;
    const sorted = [...users].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    sorted.forEach((u, i) => {
      m.set(u.id, `AQT-${String(i + 1).padStart(6, '0')}`);
    });
    return m;
  }, [users]);

  // Collapsible "Unassigned" section state (only relevant when a division filter is active)
  const [showUnassigned, setShowUnassigned] = useState(false);

  // Cycling placeholder for the search input — premium polish
  const SEARCH_PLACEHOLDERS = ['Search by name or email…', 'Search by ID…', 'Search by phone…'];
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    if (searchTerm) return; // Pause cycling while user is typing
    const t = setInterval(() => setPlaceholderIdx(i => (i + 1) % SEARCH_PLACEHOLDERS.length), 2800);
    return () => clearInterval(t);
  }, [searchTerm]);

  // Quick-category filter pills — maps to existing filterRole
  type CategoryPill = 'all' | 'student' | 'teacher' | 'staff';
  const activeCategory: CategoryPill = useMemo(() => {
    if (!filterRole) return 'all';
    if (filterRole === 'student') return 'student';
    if (filterRole === 'teacher') return 'teacher';
    if (['admin', 'super_admin', 'admin_division', 'admin_admissions', 'admin_fees', 'admin_academic', 'examiner'].includes(filterRole)) return 'staff';
    return 'all';
  }, [filterRole]);

  // One-click "Assign to current filtered division" mutation
  const assignDivisionMutation = useMutation({
    mutationFn: async ({ userId, divisionId }: { userId: string; divisionId: string }) => {
      const { data: divFull } = await supabase
        .from('divisions')
        .select('branch_id')
        .eq('id', divisionId)
        .maybeSingle();
      const branchId = (divFull as any)?.branch_id;
      if (!branchId) throw new Error('Division has no branch');
      const { error } = await supabase
        .from('user_context')
        .insert({ user_id: userId, division_id: divisionId, branch_id: branchId, is_default: false });
      if (error && !String(error.message).toLowerCase().includes('duplicate')) throw error;
      return { userId, divisionId };
    },
    onSuccess: () => {
      toast({ title: 'Assigned', description: 'User added to this division.' });
      queryClient.invalidateQueries({ queryKey: ['division-membership'] });
    },
    onError: (e: any) => {
      toast({ title: 'Failed to assign', description: e?.message || 'Unknown error', variant: 'destructive' });
    },
  });

  const availableCountries = useMemo(() => {
    const countries = new Set<string>();
    users?.forEach(u => {
      if (u.country) countries.add(u.country);
    });
    return Array.from(countries).sort();
  }, [users]);

  const availableCities = useMemo(() => {
    if (!filterCountry) return [];
    const cities = new Set<string>();
    users?.forEach(u => {
      if (u.country === filterCountry && u.city) {
        cities.add(u.city);
      }
    });
    return Array.from(cities).sort();
  }, [users, filterCountry]);

  // Roles that are considered "global" (org-wide, not tied to any specific division)
  const GLOBAL_ROLES: AppRole[] = ['super_admin', 'admin', 'admin_admissions', 'admin_fees', 'admin_academic'];

  // Effective division: '__all__' = user explicitly picked All (override global), '' = follow global context, <id> = specific.
  const effectiveDivisionId = filterDivision === '__all__'
    ? ''
    : (filterDivision || activeDivision?.id || '');

  const filteredAll = users
    ?.filter(user => {
      const matchesArchive = showArchived ? !!user.archived_at : !user.archived_at;
      const matchesSearch = !searchTerm ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCountry = !filterCountry || user.country === filterCountry;
      const matchesCity = !filterCity || user.city === filterCity;
      const matchesStaffMode = !staffMode || (user.roles && user.roles.some(r => !TEACHING_ROLES.includes(r)));

      // Role filter is division-aware:
      // - If a division is in scope, the user must hold that role inside that division.
      // - Otherwise, fall back to global role list.
      const userMemberships = divMembershipMap?.get(user.id) || [];
      let matchesRole = true;
      if (filterRole) {
        const ADMIN_ROLES: AppRole[] = ['super_admin', 'admin', 'admin_division', 'admin_admissions', 'admin_fees', 'admin_academic'];
        const isAdminsPill = filterRole === '__admins__';
        if (effectiveDivisionId) {
          matchesRole = userMemberships.some(d => {
            if (d.divisionId !== effectiveDivisionId) return false;
            return isAdminsPill
              ? d.roles.some((r: string) => ADMIN_ROLES.includes(r as AppRole))
              : d.roles.includes(filterRole);
          });
        } else {
          matchesRole = isAdminsPill
            ? !!user.roles?.some(r => ADMIN_ROLES.includes(r))
            : !!user.roles?.includes(filterRole as AppRole);
        }
      }

      return matchesArchive && matchesSearch && matchesCountry && matchesCity && matchesRole && matchesStaffMode;
    })
    ?.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = (a.full_name || '').localeCompare(b.full_name || '');
          break;
        case 'role':
          const aRole = a.roles?.[0] || '';
          const bRole = b.roles?.[0] || '';
          comparison = aRole.localeCompare(bRole);
          break;
        case 'gender':
          comparison = (a.gender || '').localeCompare(b.gender || '');
          break;
        case 'age':
          comparison = (a.age || 0) - (b.age || 0);
          break;
        case 'country':
          comparison = (a.country || '').localeCompare(b.country || '');
          break;
        case 'city':
          comparison = (a.city || '').localeCompare(b.city || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Split into matched (in scope division) vs unassigned (no memberships at all).
  // Global-role users (admin/super_admin/etc.) are always matched.
  const filteredUsers = (filteredAll || []).filter(user => {
    if (!effectiveDivisionId) return true;
    const memberships = divMembershipMap?.get(user.id) || [];
    if (memberships.some(d => d.divisionId === effectiveDivisionId)) return true;
    const hasGlobalRole = (user.roles || []).some(r => GLOBAL_ROLES.includes(r));
    if (hasGlobalRole && memberships.length === 0) return true;
    return false;
  });

  const unassignedUsers = (filteredAll || []).filter(user => {
    if (!effectiveDivisionId) return false;
    const memberships = divMembershipMap?.get(user.id) || [];
    if (memberships.length > 0) return false;
    const hasGlobalRole = (user.roles || []).some(r => GLOBAL_ROLES.includes(r));
    return !hasGlobalRole; // global-role users without context already counted as matched
  });

  const hasActiveFilters = !!filterCountry || !!filterCity || !!filterRole || !!filterDivision || showArchived;

  const resetFilters = () => {
    setFilterCountry('');
    setFilterCity('');
    setFilterRole('');
    setFilterDivision('');
    setSearchTerm('');
    setShowArchived(false);
  };

  const getRoleTemplate = (role: AppRole | null) => {
    return roleTemplates?.find(t => t.role === role);
  };

  const hasRolePermission = (roles: AppRole[], permission: string) => {
    return roles.some(role => {
      const template = getRoleTemplate(role);
      return template?.permissions?.includes(permission) || false;
    });
  };

  const getEffectivePermission = (user: UserWithRoles, permission: string): boolean | 'inherited' => {
    const exception = user.exceptions?.find((e) => e.permission === permission);
    if (exception) {
      return exception.is_granted;
    }
    return 'inherited';
  };

  const getAvailableRoles = (user: UserWithRoles): AppRole[] => {
    const allRoles = Object.keys(ROLE_LABELS) as AppRole[];
    const userRoles = user.roles || [];
    // Exclude super_admin from UI-assignable roles (DB-level only)
    return allRoles.filter(role => !userRoles.includes(role) && role !== 'super_admin');
  };

  useEffect(() => {
    if (!users?.length) return;

    if (viewingUser) {
      const refreshedViewingUser = users.find(user => user.id === viewingUser.id);
      if (refreshedViewingUser) setViewingUser(refreshedViewingUser);
    }

    if (selectedUser) {
      const refreshedSelectedUser = users.find(user => user.id === selectedUser.id);
      if (refreshedSelectedUser) setSelectedUser(refreshedSelectedUser);
    }
  }, [users, viewingUser, selectedUser]);

  // Access denied - render after all hooks are called
  if (!canAccessPage) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access user management.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">{staffMode ? 'Staff' : 'User Management'}</h1>
            <p className="text-muted-foreground">{staffMode ? 'Non-teaching staff (admins, moderators, supervisors, examiners)' : 'Manage users, roles, and permissions'}</p>
          </div>
           {/* Header button gating by role */}
           <div className="flex gap-2">
             <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh" disabled={isFetching}>
               <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
             </Button>
             {(activeRole === 'super_admin' || activeRole === 'admin_division' || activeRole === 'admin') && (
               <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
                 <Upload className="h-4 w-4 mr-2" />
                 Bulk Import
               </Button>
             )}
             {(activeRole === 'super_admin' || activeRole === 'admin_division' || activeRole === 'admin' || activeRole === 'admin_admissions' || activeRole === 'admin_academic') && (
               <Button variant="outline" onClick={() => setIsExportDialogOpen(true)}>
                 <Download className="h-4 w-4 mr-2" />
                 Export Users
               </Button>
             )}
             {(activeRole === 'super_admin' || activeRole === 'admin_division' || activeRole === 'admin' || activeRole === 'admin_admissions') && (
               <>
                 <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                   <DialogTrigger asChild>
                     <Button className="btn-primary-glow">
                       <UserPlus className="h-4 w-4 mr-2" />
                       Add User
                     </Button>
                   </DialogTrigger>
                <DialogContent className="max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Add a new user to the platform. Each email can only be used once.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    {/* Row 1: Full Name | Email */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="name" className="text-xs">Full Name *</Label>
                        <Input
                          id="name"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="Enter full name"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-xs">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => {
                            setNewUserEmail(e.target.value);
                            setEmailExistsCheck(null);
                          }}
                          onBlur={async () => {
                            const em = newUserEmail.trim().toLowerCase();
                            if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
                              setEmailExistsCheck(null);
                              return;
                            }
                            setEmailChecking(true);
                            const { data } = await supabase
                              .from('profiles')
                              .select('id, full_name')
                              .eq('email', em)
                              .maybeSingle();
                            setEmailChecking(false);
                            setEmailExistsCheck(data ? { id: data.id, full_name: data.full_name } : null);
                          }}
                          placeholder="user@example.com"
                          className="h-9"
                        />
                        {emailChecking && (
                          <p className="text-[11px] text-muted-foreground">Checking…</p>
                        )}
                      </div>
                    </div>

                    {/* Email-exists hard block */}
                    {emailExistsCheck ? (
                      <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-2">
                        <p className="text-sm text-amber-900 dark:text-amber-200">
                          ⚠️ This email is already registered to <strong>{emailExistsCheck.full_name || 'an existing user'}</strong>. Use Add Role to assign an additional role to this user.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Role to add</Label>
                            <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="teacher">Teacher</SelectItem>
                                <SelectItem value="examiner">Examiner</SelectItem>
                                <SelectItem value="parent">Parent</SelectItem>
                                <SelectItem value="admin_division">Division Admin</SelectItem>
                                {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Division (optional)</Label>
                            <Select value={newUserDivisionId} onValueChange={setNewUserDivisionId}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Select division" /></SelectTrigger>
                              <SelectContent>
                                {allDivisions.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                          <Button
                            size="sm"
                            disabled={createUserMutation.isPending}
                            onClick={() => {
                              createUserMutation.mutate({
                                addRoleOnly: true,
                                existingUserId: emailExistsCheck.id,
                                email: newUserEmail.trim().toLowerCase(),
                                fullName: emailExistsCheck.full_name || 'User',
                                role: newUserRole,
                                division_id: newUserDivisionId || undefined,
                              });
                            }}
                          >
                            {createUserMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding…</> : 'Add Role'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Row 2: Password | Role */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-xs">Password (optional, blank = invite)</Label>
                            <div className="relative">
                              <Input
                                id="password"
                                type={showNewUserPassword ? 'text' : 'password'}
                                value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)}
                                placeholder="Min 6 characters"
                                className="h-9 pr-9"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                                onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                              >
                                {showNewUserPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="role" className="text-xs">Role *</Label>
                            <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="teacher">Teacher</SelectItem>
                                <SelectItem value="examiner">Examiner</SelectItem>
                                <SelectItem value="parent">Parent</SelectItem>
                                <SelectItem value="admin_division">Division Admin</SelectItem>
                                {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {newUserRole === 'admin_division' && (
                          <p className="text-[11px] text-muted-foreground">
                            ℹ️ Division Admin has full rights scoped to the selected division only.
                          </p>
                        )}

                        {/* Row 3: Division | Branch */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Division {newUserRole === 'admin_division' && '*'}</Label>
                            <Select value={newUserDivisionId} onValueChange={setNewUserDivisionId}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Select division" /></SelectTrigger>
                              <SelectContent>
                                {allDivisions.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Branch {newUserRole === 'admin_division' && '*'}</Label>
                            <Select value={newUserBranchId} onValueChange={setNewUserBranchId}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Select branch" /></SelectTrigger>
                              <SelectContent>
                                {branches.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ''}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Row 4: Gender | DOB | Country */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Gender</Label>
                            <Select value={newUserGender} onValueChange={(v) => setNewUserGender(v as 'male' | 'female' | '')}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Date of Birth</Label>
                            <Input
                              type="date"
                              value={newUserDob}
                              onChange={(e) => setNewUserDob(e.target.value)}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Country</Label>
                            <Select
                              value={newUserCountry}
                              onValueChange={(v) => {
                                setNewUserCountry(v);
                                setNewUserCity('');
                                const name = getCountryName(v).toLowerCase();
                                const tzMap: Record<string, string> = {
                                  'pakistan': 'Asia/Karachi',
                                  'united arab emirates': 'Asia/Dubai',
                                  'saudi arabia': 'Asia/Riyadh',
                                  'united kingdom': 'Europe/London',
                                  'united states': 'America/New_York',
                                  'australia': 'Australia/Sydney',
                                  'qatar': 'Asia/Qatar',
                                  'belgium': 'Europe/Brussels',
                                  'canada': 'America/Toronto',
                                };
                                if (tzMap[name]) setNewUserTimezone(tzMap[name]);
                              }}
                            >
                              <SelectTrigger className="h-9"><SelectValue placeholder="Select country" /></SelectTrigger>
                              <SelectContent className="max-h-60">
                                {allCountries.map((c) => (
                                  <SelectItem key={c.isoCode} value={c.isoCode}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Row 5: WhatsApp | Timezone */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">WhatsApp (E.164)</Label>
                            <Input
                              value={newUserWhatsapp}
                              onChange={(e) => setNewUserWhatsapp(e.target.value)}
                              placeholder="+1234567890"
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Timezone</Label>
                            <Input
                              value={newUserTimezone}
                              onChange={(e) => setNewUserTimezone(e.target.value)}
                              placeholder="e.g. Asia/Karachi"
                              className="h-9"
                            />
                          </div>
                        </div>

                        {/* Conditional: Student guardian section */}
                        {newUserRole === 'student' && (
                          <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Guardian Type</Label>
                              <Select
                                value={newUserGuardianType}
                                onValueChange={(v) => setNewUserGuardianType(v as any)}
                              >
                                <SelectTrigger className="h-9"><SelectValue placeholder="Select guardian type" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None — adult self-learner</SelectItem>
                                  <SelectItem value="parent">Parent (linked account)</SelectItem>
                                  <SelectItem value="guardian">Guardian (non-parent)</SelectItem>
                                  <SelectItem value="emergency">Emergency Contact Only</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {newUserGuardianType === 'parent' && (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Parent Email *</Label>
                                  <Input
                                    type="email"
                                    value={newUserParentEmail}
                                    onChange={(e) => setNewUserParentEmail(e.target.value)}
                                    placeholder="parent@example.com"
                                    className="h-9"
                                  />
                                  {newUserParentEmail && newUserParentEmail.trim().toLowerCase() === newUserEmail.trim().toLowerCase() && (
                                    <p className="text-[11px] text-destructive">Parent email must differ from student email.</p>
                                  )}
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Parent Name *</Label>
                                  <Input
                                    value={newUserParentName}
                                    onChange={(e) => setNewUserParentName(e.target.value)}
                                    placeholder="Parent full name"
                                    className="h-9"
                                  />
                                </div>
                                <div className="col-span-2 flex items-center gap-2">
                                  <Checkbox
                                    id="parentExists"
                                    checked={newUserParentExisting}
                                    onCheckedChange={(c) => setNewUserParentExisting(c === true)}
                                  />
                                  <Label htmlFor="parentExists" className="text-xs cursor-pointer">
                                    Parent account already exists — just link
                                  </Label>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2 border-t border-border mt-2">
                          <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={createUserMutation.isPending}
                            onClick={() => {
                              const email = newUserEmail.trim().toLowerCase();
                              const fullName = newUserName.trim();
                              const password = newUserPassword;

                              if (!fullName || fullName.length < 2) {
                                toast({ title: 'Name required', description: 'Full name must be at least 2 characters.', variant: 'destructive' });
                                return;
                              }
                              if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                toast({ title: 'Email required', description: 'Enter a valid email address.', variant: 'destructive' });
                                return;
                              }
                              if (password && (password.length < 6 || password.length > 100)) {
                                toast({ title: 'Invalid password', description: 'Password must be 6-100 characters.', variant: 'destructive' });
                                return;
                              }
                              if (newUserRole === 'admin_division' && (!newUserDivisionId || !newUserBranchId)) {
                                toast({ title: 'Division & branch required', description: 'Division Admin requires both division and branch.', variant: 'destructive' });
                                return;
                              }
                              if (newUserRole === 'student' && newUserGuardianType === 'parent') {
                                if (!newUserParentEmail.trim() || !newUserParentName.trim()) {
                                  toast({ title: 'Parent details required', description: 'Parent email and name are required.', variant: 'destructive' });
                                  return;
                                }
                                if (newUserParentEmail.trim().toLowerCase() === email) {
                                  toast({ title: 'Invalid parent email', description: 'Parent email must differ from student email.', variant: 'destructive' });
                                  return;
                                }
                              }

                              createUserMutation.mutate({
                                email,
                                password: password || undefined,
                                fullName,
                                role: newUserRole,
                                whatsapp: newUserWhatsapp.trim() || undefined,
                                gender: newUserGender || undefined,
                                country: newUserCountry ? getCountryName(newUserCountry) : undefined,
                                city: newUserCity || undefined,
                                branch_id: newUserBranchId || undefined,
                                division_id: newUserDivisionId || undefined,
                                date_of_birth: newUserDob || undefined,
                                timezone: newUserTimezone || undefined,
                                guardian_type: newUserRole === 'student' ? (newUserGuardianType || undefined) : undefined,
                                parent_email: (newUserRole === 'student' && newUserGuardianType === 'parent') ? newUserParentEmail.trim().toLowerCase() : undefined,
                                parent_name: (newUserRole === 'student' && newUserGuardianType === 'parent') ? newUserParentName.trim() : undefined,
                                parentExistingOnly: (newUserRole === 'student' && newUserGuardianType === 'parent') ? newUserParentExisting : undefined,
                              });
                            }}
                          >
                            {createUserMutation.isPending ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</>
                            ) : (
                              'Create User'
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                 </DialogContent>
               </Dialog>
               </>
             )}
             {(activeRole === 'super_admin' || activeRole === 'admin_division' || activeRole === 'admin') && (
               <BulkUserImportDialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen} />
             )}
           </div>
        </div>

        {/* Error state */}
        {usersError && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p>Failed to load users: {usersError instanceof Error ? usersError.message : 'Unknown error'}</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users ({filteredUsers?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" />
              Role Templates
            </TabsTrigger>
            {(isSuperAdmin || hasPermission('users.view')) && (
              <TabsTrigger value="auth-audit" className="gap-2">
                <AlertCircle className="h-4 w-4" />
                Auth Audit
              </TabsTrigger>
            )}
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            {/* Search and Filters — premium redesign */}
            <div className="space-y-3">
              {/* Top row: prominent search + category pills */}
              <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
                <div className="relative flex-1 w-full lg:max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={SEARCH_PLACEHOLDERS[placeholderIdx]}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 rounded-lg bg-card border-border/60 shadow-sm transition-all focus-visible:shadow-md"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Category pills — role filter */}
                <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border/60">
                  {([
                    { key: 'all', label: 'All', dot: 'bg-muted-foreground', role: '' },
                    { key: 'student', label: 'Students', dot: 'bg-teal-500', role: 'student' },
                    { key: 'teacher', label: 'Teachers', dot: 'bg-violet-500', role: 'teacher' },
                    { key: 'parent', label: 'Parents', dot: 'bg-amber-500', role: 'parent' },
                    { key: 'admin_division', label: 'Division Admin', dot: 'bg-purple-500', role: '__admins__' },
                    { key: 'examiner', label: 'Examiners', dot: 'bg-sky-500', role: 'examiner' },
                  ] as const).map((p) => {
                    const active = (filterRole || '') === p.role;
                    return (
                      <button
                        key={p.key}
                        onClick={() => setFilterRole(p.role)}
                        className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium transition-all ${
                          active
                            ? 'bg-card text-foreground shadow-sm border border-border/60'
                            : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Secondary row: contextual filters */}
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={filterDivision || "context"} onValueChange={(v) => setFilterDivision(v === "context" ? "" : v)}>
                  <SelectTrigger className="w-[200px] h-9 rounded-lg bg-card text-sm">
                    <SelectValue placeholder="Division filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="context">Current context{activeDivision ? ` (${activeDivision.name})` : ''}</SelectItem>
                    <SelectItem value="__all__">All Divisions (combined)</SelectItem>
                    {allDivisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filterCountry || "all"}
                  onValueChange={(v) => {
                    setFilterCountry(v === "all" ? "" : v);
                    setFilterCity('');
                  }}
                >
                  <SelectTrigger className="w-[160px] h-9 rounded-lg bg-card text-sm">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {availableCountries.map((country) => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filterCity || "all"}
                  onValueChange={(v) => setFilterCity(v === "all" ? "" : v)}
                  disabled={!filterCountry}
                >
                  <SelectTrigger className="w-[160px] h-9 rounded-lg bg-card text-sm">
                    <SelectValue placeholder={filterCountry ? "All Cities" : "Select Country"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {availableCities.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant={showArchived ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                  className={`h-9 rounded-lg ${showArchived ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                >
                  <Archive className="h-3.5 w-3.5 mr-1.5" />
                  {showArchived ? "Showing Archived" : "Archived"}
                </Button>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 rounded-lg text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5 mr-1" />
                    Reset filters
                  </Button>
                )}
              </div>
            </div>

            {/* Identity Legend — explains icons inside the ID · IDENTITY pill */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowLegend(s => !s)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md border border-border/60 bg-card px-2.5 py-1"
                title={showLegend ? 'Hide identity legend' : 'Show identity legend'}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {showLegend ? 'Hide legend' : 'Show legend'}
                {showLegend ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {showLegend && (
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-3 space-y-2">
                  <div className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 items-center text-xs">
                    {/* DIVISION row */}
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Division</div>
                    <div className="flex flex-wrap gap-3 items-center">
                      {(['division-1to1','division-group','division-recorded'] as IdentityIconKind[]).map(k => {
                        const meta = IDENTITY_ICON_META[k];
                        const bgMap: Record<string, string> = {
                          'division-1to1': 'bg-blue-600 dark:bg-blue-400',
                          'division-group': 'bg-orange-700 dark:bg-orange-500',
                          'division-recorded': 'bg-yellow-500 dark:bg-yellow-400',
                        };
                        return (
                          <span key={k} className="inline-flex items-center gap-1.5">
                            <span className={`h-3 w-3 rounded-none ring-1 ring-border/50 ${bgMap[k]}`} style={{ borderRadius: 0 }} aria-hidden />
                            <span className="text-foreground/80">{meta.label}</span>
                          </span>
                        );
                      })}
                    </div>

                    {/* ROLE row — Teacher/Student colored per division */}
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Role</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
                      <span className="inline-flex items-center gap-1.5"><Crown className="h-3.5 w-3.5 text-foreground" strokeWidth={1.75} /><span className="text-foreground/80">Super Admin</span></span>
                      <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-foreground" strokeWidth={1.75} /><span className="text-foreground/80">Admin</span></span>
                      <span className="inline-flex items-center gap-1.5"><Presentation className="h-3.5 w-3.5 text-foreground" strokeWidth={1.75} /><span className="text-foreground/80">Teacher</span></span>
                      <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-foreground" strokeWidth={1.75} /><span className="text-foreground/80">Student</span></span>
                      <span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5 text-foreground" strokeWidth={1.75} /><span className="text-foreground/80">Parent</span></span>
                      <span className="inline-flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5 text-foreground" strokeWidth={1.75} /><span className="text-foreground/80">Examiner</span></span>
                    </div>

                    {/* STATUS row */}
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Status</div>
                    <div className="flex flex-wrap gap-3 items-center">
                      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className="text-foreground/80">Active</span></span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /><span className="text-foreground/80">Paused</span></span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /><span className="text-foreground/80">Left</span></span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" /><span className="text-foreground/80">Completed</span></span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground italic pt-1 border-t border-border/40">
                    Tip: A user in two divisions shows two icons — one in each division's color.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Users Table — premium redesign */}
            <Card className="overflow-hidden border-border/60 shadow-sm">
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !filteredUsers?.length ? (
                  <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                      <Search className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="text-base font-medium text-foreground">No users found</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      Try adjusting your search or filters to find what you're looking for.
                    </p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={resetFilters}>
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table wrapperClassName="max-h-[65vh] overflow-auto">
                    <TableHeader className="bg-muted/40 backdrop-blur-sm">
                      <TableRow className="border-b border-border/60 hover:bg-transparent">
                        {isSuperAdmin && (
                          <TableHead className="w-10 h-11">
                            <Checkbox
                              checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedUserIds(filteredUsers.map(u => u.id));
                                else setSelectedUserIds([]);
                              }}
                            />
                          </TableHead>
                        )}
                        <TableHead className="w-12 h-11 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">#</TableHead>
                        <TableHead
                          className="h-11 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center">User{getSortIcon('name')}</div>
                        </TableHead>
                        <TableHead className="h-11 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                          <span className="inline-flex items-center gap-1">ID <span className="opacity-50">&amp;</span> ROLES</span>
                        </TableHead>
                        <TableHead className="h-11 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Phone</TableHead>
                        <TableHead className="h-11 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Location</TableHead>
                        <TableHead className="h-11 text-right text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pr-4">Actions</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredUsers.map((user, idx) => (
                        <TableRow
                          key={user.id}
                          onClick={() => openProfileDrawer(user.id)}
                          className={`group min-h-[64px] border-l-2 border-transparent transition-colors hover:bg-muted/30 hover:border-l-primary cursor-pointer ${idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}`}
                        >
                          {isSuperAdmin && (
                            <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedUserIds.includes(user.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedUserIds([...selectedUserIds, user.id]);
                                  } else {
                                    setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                                  }
                                }}
                              />
                            </TableCell>
                          )}
                          <TableCell className="py-3 text-muted-foreground text-sm tabular-nums">{idx + 1}</TableCell>
                          <TableCell className="py-3 font-medium">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${AVATAR_COLORS[getPrimaryRole(user.roles as AppRole[])] || AVATAR_COLORS.default}`}>
                                {getInitials(user.full_name)}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-foreground">{user.full_name}</span>
                                  {user.archived_at && (
                                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200">Archived</Badge>
                                  )}
                                </div>
                                {user.email && (
                                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            {(() => {
                              const personNo = personNumberMap.get(user.id);
                              const fullUrn = user.registration_id;
                              if (!personNo) {
                                return <span className="text-muted-foreground text-xs">—</span>;
                              }
                              return (
                                <TooltipProvider delayDuration={150}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1.5 group/id"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(fullUrn || personNo);
                                          toast({ title: 'Copied', description: fullUrn || personNo });
                                        }}
                                        title="Click to copy"
                                      >
                                        <span
                                          className="font-mono text-xs bg-white text-slate-800 border border-slate-300 px-2 py-1 inline-flex items-center gap-2"
                                          style={{
                                            boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(15,23,42,0.12), 0 2px 4px rgba(15,23,42,0.08)',
                                          }}
                                        >
                                          <span className="tabular-nums truncate text-left" style={{ width: '12ch' }}>{personNo}</span>
                                          {(() => {
                                            // Render ROLE icons colored by DIVISION.
                                            // For each division the user belongs to (parents inherit from their kids),
                                            // emit one icon per role-in-that-division. Same role across multiple
                                            // divisions = multiple icons in different colors.
                                            const memberships = divMembershipMap?.get(user.id) || [];
                                            const userRoles = user.roles || [];
                                            const isExaminer = userRoles.includes('examiner' as AppRole);
                                            const isSuperAdmin = userRoles.includes('super_admin' as AppRole);
                                            const isAdmin = userRoles.some(r => r === 'admin' || r === 'admin_admissions' || r === 'admin_fees' || r === 'admin_academic');

                                            type RoleIconKind = 'student' | 'teacher' | 'parent' | 'examiner' | 'admin' | 'super_admin';
                                            const ROLE_ICON: Record<RoleIconKind, React.ComponentType<{ className?: string }>> = {
                                              student: GraduationCap,
                                              teacher: Presentation,
                                              parent: Heart,
                                              examiner: ClipboardCheck,
                                              admin: Shield,
                                              super_admin: Crown,
                                            };

                                            const items: { Icon: React.ComponentType<{ className?: string }>; color: string; title: string }[] = [];
                                            const pushed = new Set<string>();
                                            const push = (kind: RoleIconKind, color: string, divLabel: string) => {
                                              const key = `${kind}|${color}`;
                                              if (pushed.has(key)) return;
                                              pushed.add(key);
                                              items.push({ Icon: ROLE_ICON[kind], color, title: `${kind.replace('_', ' ')} · ${divLabel}` });
                                            };

                                            // Per-division role icons
                                            memberships.forEach(m => {
                                              const dKind = divisionIconKind(m.modelType, m.divisionName);
                                              const colorKey = dKind === 'division-1to1' ? '1to1' : dKind === 'division-recorded' ? 'recorded' : 'group';
                                              const color = DIVISION_COLOR[colorKey];
                                              (m.roles || []).forEach(r => {
                                                if (r === 'student') push('student', color, m.divisionName);
                                                else if (r === 'teacher' || r === 'moderator' || r === 'supervisor') push('teacher', color, m.divisionName);
                                                else if (r === 'parent') push('parent', color, m.divisionName);
                                              });
                                            });

                                            // Global roles (no division coloring)
                                            const neutral = 'text-slate-700 dark:text-slate-300';
                                            if (isExaminer) push('examiner', neutral, 'Global');
                                            if (isAdmin) push('admin', 'text-slate-700 dark:text-slate-300', 'Global');
                                            if (isSuperAdmin) push('super_admin', 'text-rose-600 dark:text-rose-400', 'Global');

                                            const slots = Array.from({ length: 8 }, (_, i) => items[i]);
                                            return (
                                              <span className="inline-flex items-center gap-1 border-l border-slate-200 pl-2" style={{ width: 'calc(8 * 14px + 7 * 4px)' }}>
                                                {slots.map((it, i) => (
                                                  <span key={i} className="inline-flex items-center justify-center" style={{ width: 14, height: 14 }} title={it?.title}>
                                                    {it ? <it.Icon className={`h-3.5 w-3.5 ${it.color}`} /> : null}
                                                  </span>
                                                ))}
                                              </span>
                                            );
                                          })()}
                                        </span>
                                        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/id:opacity-100 transition-opacity" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="text-xs">
                                      <div className="font-medium">Universal ID: {personNo}</div>
                                      {fullUrn && <div className="text-muted-foreground mt-1">URN: {fullUrn}</div>}
                                      <div className="text-muted-foreground mt-1 italic">Click to copy</div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="py-3">
                            {user.whatsapp_number ? (
                              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
                                <span className="text-base leading-none">{dialCodeToFlag(user.whatsapp_number) || '🌐'}</span>
                                {user.whatsapp_number}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          {/* Role column removed — roles are now visualized as icons inside the ID pill (see ID & ROLES column). */}
                          <TableCell className="py-3">
                            {user.city || user.country ? (
                              <span className="text-sm text-muted-foreground">
                                {[user.city, user.country].filter(Boolean).join(', ')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              {/* Connections — visible to all admin roles (view-only roles allowed) */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const r = user.roles || [];
                                  const ut = r.includes('teacher') ? 'teacher' : r.includes('student') ? 'student' : r.includes('parent') ? 'parent' : 'student';
                                  navigate(`/connections/${ut}/${user.id}`);
                                }}
                                title="View connections graph"
                                className="text-primary hover:text-primary"
                              >
                                <Network className="h-4 w-4" />
                              </Button>

                              {/* Edit → opens 8-tab holistic profile (the profile drawer enforces tab-level access per role) */}
                              {activeRole !== 'admin_fees' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openProfileDrawer(user.id)}
                                  title="Open full profile"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}

                              {/* Delete — super_admin & admin_division only; never for current user */}
                              {(activeRole === 'super_admin' || activeRole === 'admin_division' || activeRole === 'admin') &&
                                user.id !== currentUser?.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteConfirmUser(user)}
                                    className="text-destructive hover:text-destructive"
                                    title="Delete user"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {effectiveDivisionId && unassignedUsers.length > 0 && (
                        <>
                          <TableRow className="bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer" onClick={() => setShowUnassigned(s => !s)}>
                            <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-amber-700 dark:text-amber-400 text-sm font-medium py-2">
                              <div className="flex items-center gap-2">
                                {showUnassigned ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <AlertTriangle className="h-4 w-4" />
                                {unassignedUsers.length} user{unassignedUsers.length === 1 ? '' : 's'} not assigned to any division
                              </div>
                            </TableCell>
                          </TableRow>
                          {showUnassigned && unassignedUsers.map((user) => (
                            <TableRow key={`u-${user.id}`} className="bg-amber-500/5">
                              {isSuperAdmin && <TableCell />}
                              <TableCell className="text-amber-600"><AlertTriangle className="h-3 w-3" /></TableCell>
                              <TableCell className="font-medium">{user.full_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs font-mono">{personNumberMap.get(user.id) || '—'}</Badge>
                              </TableCell>
                              <TableCell><span className="text-sm">{user.whatsapp_number || '—'}</span></TableCell>
                              <TableCell colSpan={3}>
                                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-200">⚠ Unassigned</Badge>
                              </TableCell>
                              <TableCell><span className="text-sm">{[user.city, user.country].filter(Boolean).join(', ') || '—'}</span></TableCell>
                              <TableCell className="text-right">
                                {isSuperAdmin && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    disabled={assignDivisionMutation.isPending}
                                    onClick={() => assignDivisionMutation.mutate({ userId: user.id, divisionId: effectiveDivisionId })}
                                  >
                                    Assign here
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Role Templates Tab */}
          <TabsContent value="roles" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roleTemplates?.map((template) => (
                <Card key={template.id} className="card-interactive">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.is_system && (
                        <Badge variant="outline" className="text-xs">System</Badge>
                      )}
                    </div>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Permissions:</p>
                      <div className="flex flex-wrap gap-1">
                        {(template.permissions || []).slice(0, 5).map((perm: string) => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                        {(template.permissions?.length || 0) > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{(template.permissions?.length || 0) - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Auth Audit Tab */}
          <TabsContent value="auth-audit">
            <AuthAuditTab />
          </TabsContent>
        </Tabs>

        {/* Add Role Dialog */}
        <Dialog open={isAddRoleDialogOpen} onOpenChange={setIsAddRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Role to {viewingUser?.full_name}</DialogTitle>
              <DialogDescription>
                Select a role to add to this user.
              </DialogDescription>
            </DialogHeader>
            {viewingUser && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Current Roles</Label>
                  <div className="flex flex-wrap gap-1">
                    {viewingUser.roles.map((role) => (
                      <Badge key={role} variant="outline" className={ROLE_COLORS[role]}>
                        {ROLE_LABELS[role]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Add New Role</Label>
                  <Select value={addRoleSelection} onValueChange={(v) => setAddRoleSelection(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableRoles(viewingUser).map((role) => (
                        <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={addRoleMutation.isPending}
                  onClick={() => {
                    if (viewingUser) {
                      addRoleMutation.mutate({
                        userId: viewingUser.id,
                        role: addRoleSelection,
                      });
                    }
                  }}
                >
                  {addRoleMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Role
                    </>
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Remove Role Confirmation */}
        <AlertDialog open={!!removeRoleConfirm} onOpenChange={() => setRemoveRoleConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Role</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove the <strong>{removeRoleConfirm?.role ? ROLE_LABELS[removeRoleConfirm.role] : ''}</strong> role 
                from <strong>{removeRoleConfirm?.user.full_name}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (removeRoleConfirm) {
                    removeRoleMutation.mutate({
                      userId: removeRoleConfirm.user.id,
                      role: removeRoleConfirm.role,
                    });
                  }
                }}
                disabled={removeRoleMutation.isPending}
              >
                {removeRoleMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  'Remove'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* REPLACE Confirmation Modal — mutual exclusivity hard block */}
        <AlertDialog
          open={!!replaceConflictState}
          onOpenChange={(open) => {
            if (!open) {
              setReplaceConflictState(null);
              setReplaceConfirmText('');
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Role Conflict — Replace Required
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 pt-2">
                  <p>
                    Adding <strong>{replaceConflictState?.newRole ? ROLE_LABELS[replaceConflictState.newRole] : ''}</strong>{' '}
                    to <strong>{replaceConflictState?.user.full_name}</strong> will{' '}
                    <strong className="text-destructive">REMOVE</strong> the following existing role
                    {replaceConflictState && replaceConflictState.conflictingRoles.length > 1 ? 's' : ''}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {replaceConflictState?.conflictingRoles.map((r) => (
                      <Badge key={r} variant="outline" className={ROLE_COLORS[r]}>
                        {ROLE_LABELS[r]}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm">
                    Type <strong>REPLACE</strong> to confirm.
                  </p>
                  <Input
                    value={replaceConfirmText}
                    onChange={(e) => setReplaceConfirmText(e.target.value)}
                    placeholder="Type REPLACE"
                    autoFocus
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={replaceConfirmText !== 'REPLACE' || addRoleMutation.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (replaceConflictState && replaceConfirmText === 'REPLACE') {
                    addRoleMutation.mutate({
                      userId: replaceConflictState.user.id,
                      role: replaceConflictState.newRole,
                      replaceConflicting: true,
                    });
                  }
                }}
              >
                {addRoleMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Replacing...
                  </>
                ) : (
                  'Confirm Replace'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit User Permissions Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Permissions: {selectedUser?.full_name}</DialogTitle>
              <DialogDescription>
                Configure permission exceptions for this user. Overrides take precedence over role defaults.
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-6 pt-4">
                <div className="flex items-center gap-4 p-4 bg-secondary rounded-lg">
                  <div>
                    <p className="font-medium">{selectedUser.full_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-1">
                    {selectedUser.roles.map((role) => (
                      <Badge key={role} className={ROLE_COLORS[role]}>
                        {ROLE_LABELS[role]}
                      </Badge>
                    ))}
                  </div>
                </div>

                {ALL_PERMISSIONS.map((group) => (
                  <div key={group.group} className="space-y-3">
                    <h4 className="font-medium text-foreground">{group.group}</h4>
                    <div className="grid gap-2">
                      {group.permissions.map((permission) => {
                        const roleHasIt = hasRolePermission(selectedUser.roles, permission);
                        const effective = getEffectivePermission(selectedUser, permission);
                        const isOverridden = effective !== 'inherited';
                        const finalValue = effective === 'inherited' ? roleHasIt : effective;

                        return (
                          <div 
                            key={permission} 
                            className="flex items-center justify-between p-3 rounded-lg border bg-card"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono">{permission}</span>
                              {roleHasIt && !isOverridden && (
                                <Badge variant="outline" className="text-xs">From role</Badge>
                              )}
                              {isOverridden && (
                                <Badge variant="secondary" className="text-xs">Override</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {finalValue ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                              <Select
                                value={
                                  effective === 'inherited' 
                                    ? 'inherited' 
                                    : effective ? 'granted' : 'denied'
                                }
                                onValueChange={(value) => {
                                  const isGranted = value === 'inherited' 
                                    ? null 
                                    : value === 'granted';
                                  updateExceptionMutation.mutate({
                                    userId: selectedUser.id,
                                    permission,
                                    isGranted,
                                  });
                                }}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="inherited">Inherited</SelectItem>
                                  <SelectItem value="granted">Granted</SelectItem>
                                  <SelectItem value="denied">Denied</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* View User Details Dialog */}
        <Dialog 
          open={isViewDialogOpen} 
          onOpenChange={(open) => {
            setIsViewDialogOpen(open);
            if (!open) {
              setIsEditMode(false);
              setEditPassword('');
              setShowEditPassword(false);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>{isEditMode ? 'Edit User' : 'User Details'}</DialogTitle>
                {viewingUser && isSuperAdmin && !isEditMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditFullName(viewingUser.full_name || '');
                      setEditEmail(viewingUser.email || '');
                      setEditWhatsapp(viewingUser.whatsapp_number || '');
                      setEditGender((viewingUser.gender as 'male' | 'female') || '');
                      setEditAge(viewingUser.age?.toString() || '');
                      setEditCountry(viewingUser.country || 'Pakistan');
                      setEditCity(viewingUser.city || 'Karachi');
                      setEditPassword('');
                      setIsEditMode(true);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </DialogHeader>
            {viewingUser && (
              <div className="space-y-4 pt-4">
                {!isEditMode ? (
                  <>
                    {/* View Mode */}
                    <div className="flex items-center gap-4 p-4 bg-secondary rounded-lg">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{viewingUser.full_name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {viewingUser.roles.map((role) => (
                            <Badge key={role} variant="outline" className={`text-xs ${ROLE_COLORS[role]}`}>
                              {ROLE_LABELS[role]}
                            </Badge>
                          ))}
                          {(viewingUser.roles?.length ?? 0) === 0 && (
                            <Badge variant="outline" className="text-xs">No role</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <div className="rounded-lg border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">Role access</p>
                            <p className="text-xs text-muted-foreground">Add a new role or remove an existing one for this user.</p>
                          </div>
                          <Button
                            size="sm"
                            disabled={getAvailableRoles(viewingUser).length === 0}
                            onClick={() => {
                              const availableRoles = getAvailableRoles(viewingUser);
                              if (availableRoles.length === 0) return;
                              setAddRoleSelection(availableRoles[0]);
                              setIsAddRoleDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add role
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {viewingUser.roles.map((role) => (
                            <div key={role} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1">
                              <Badge variant="outline" className={`text-xs ${ROLE_COLORS[role]}`}>
                                {ROLE_LABELS[role]}
                              </Badge>
                              {role !== 'super_admin' && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  title={`Remove ${ROLE_LABELS[role]}`}
                                  disabled={removeRoleMutation.isPending}
                                  onClick={() => setRemoveRoleConfirm({ user: viewingUser, role })}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>

                        {getAvailableRoles(viewingUser).length === 0 && (
                          <p className="text-xs text-muted-foreground">No additional UI-assignable roles are available for this user.</p>
                        )}
                      </div>
                    )}
                    {/* Universal ID + per-division URN breakdown */}
                    <div className="p-3 bg-muted/30 rounded-lg border">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Identity</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Universal ID</span>
                          <Badge variant="outline" className="font-mono">{personNumberMap.get(viewingUser.id) || '—'}</Badge>
                        </div>
                        {viewingUser.registration_id && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">URN</span>
                            <Badge variant="outline" className="font-mono text-xs">{viewingUser.registration_id}</Badge>
                          </div>
                        )}
                        {(divMembershipMap?.get(viewingUser.id) || []).map(m => (
                          <div key={m.divisionId} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{m.divisionName}</span>
                            <Badge variant="outline" className={`text-xs ${getDivisionBadgeClass(m.modelType)}`}>
                              {m.roles.map(formatRoleLabel).join(', ')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm font-medium">{viewingUser.email || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">WhatsApp</p>
                          <p className="text-sm font-medium">{viewingUser.whatsapp_number || '—'}</p>
                        </div>
                      </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Gender</p>
                            <p className="text-sm font-medium capitalize">{viewingUser.gender || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Age</p>
                            <p className="text-sm font-medium">{viewingUser.age || '—'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Location (Timezone)</p>
                          <p className="text-sm font-medium">
                            {viewingUser.city && viewingUser.country 
                              ? `${viewingUser.city}, ${viewingUser.country}` 
                              : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Created</p>
                          <p className="text-sm font-medium">
                            {new Date(viewingUser.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Edit Mode */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">Full Name</Label>
                        <Input
                          id="edit-name"
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          placeholder="Enter full name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-email">Email</Label>
                        <Input
                          id="edit-email"
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Enter email address"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-whatsapp">WhatsApp Number</Label>
                        <Input
                          id="edit-whatsapp"
                          value={editWhatsapp}
                          onChange={(e) => setEditWhatsapp(e.target.value)}
                          placeholder="e.g. +1234567890"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-gender">Gender</Label>
                          <Select value={editGender} onValueChange={(v) => setEditGender(v as 'male' | 'female' | '')}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-age">Age</Label>
                          <Input
                            id="edit-age"
                            type="number"
                            min="1"
                            max="120"
                            value={editAge}
                            onChange={(e) => setEditAge(e.target.value)}
                            placeholder="Age"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-country">Country</Label>
                          <Select 
                            value={editCountry} 
                            onValueChange={(v) => {
                              setEditCountry(v);
                              setEditCity('');
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {allCountries.map((c) => (
                                <SelectItem key={c.isoCode} value={c.name}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-city">City</Label>
                          <SearchableCitySelect
                            countryCode={(() => {
                              const countryObj = allCountries.find(c => c.name === editCountry);
                              return countryObj?.isoCode || '';
                            })()}
                            value={editCity}
                            onValueChange={setEditCity}
                            placeholder="Search city..."
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-password" className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          New Password (leave blank to keep current)
                        </Label>
                        <div className="relative">
                          <Input
                            id="edit-password"
                            type={showEditPassword ? "text" : "password"}
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="Enter new password (min 6 characters)"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowEditPassword(!showEditPassword)}
                          >
                            {showEditPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setIsEditMode(false);
                          setEditPassword('');
                          setShowEditPassword(false);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={updateUserMutation.isPending}
                        onClick={() => {
                          if (!editFullName.trim()) {
                            toast({
                              title: 'Name required',
                              description: 'Please enter a full name.',
                              variant: 'destructive',
                            });
                            return;
                          }
                          if (editPassword && editPassword.length < 6) {
                            toast({
                              title: 'Password too short',
                              description: 'Password must be at least 6 characters.',
                              variant: 'destructive',
                            });
                            return;
                          }
                          updateUserMutation.mutate({
                            userId: viewingUser.id,
                            fullName: editFullName.trim(),
                            email: editEmail.trim() || undefined,
                            whatsapp: editWhatsapp.trim() || null,
                            gender: editGender || null,
                            age: editAge ? parseInt(editAge) : null,
                            country: editCountry || null,
                            city: editCity || null,
                            password: editPassword || undefined,
                          });
                        }}
                      >
                        {updateUserMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmUser} onOpenChange={() => setDeleteConfirmUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteConfirmUser?.full_name}</strong>? 
                This action cannot be undone and will remove all their data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteConfirmUser) {
                    deleteUserMutation.mutate(deleteConfirmUser.id);
                  }
                }}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Export Users Dialog - Super Admin Only */}
        {isSuperAdmin && (
          <ExportUsersDialog
            open={isExportDialogOpen}
            onOpenChange={setIsExportDialogOpen}
            selectedUserIds={selectedUserIds}
            searchTerm={searchTerm}
            filteredUserIds={filteredUsers?.map(u => u.id) || []}
            totalUsers={users?.length || 0}
            filteredCount={filteredUsers?.length || 0}
          />
        )}

        {/* Holistic User Profile Drawer */}
        <HolisticUserProfileDrawer
          open={!!holisticUserId}
          onOpenChange={(o) => !o && setHolisticUserId(null)}
          userId={holisticUserId}
        />
      </div>
    </DashboardLayout>
  );
}
