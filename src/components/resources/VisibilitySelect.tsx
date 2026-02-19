import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Globe, Lock, GraduationCap, Users, Settings2 } from "lucide-react";

interface VisibilitySelectProps {
  value: string;
  onChange: (value: string) => void;
}

const VISIBILITY_OPTIONS = [
  { value: "all", label: "Everyone", icon: Globe, description: "All users can see" },
  { value: "admin_only", label: "Admin Only", icon: Lock, description: "Admins & Super Admins" },
  { value: "teachers", label: "Teachers", icon: Users, description: "Teachers & Admins" },
  { value: "students", label: "Students", icon: GraduationCap, description: "Students & Admins" },
];

export function VisibilitySelect({ value, onChange }: VisibilitySelectProps) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
        Visibility
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Who can see this?" />
        </SelectTrigger>
        <SelectContent>
          {VISIBILITY_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{option.description}</span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
