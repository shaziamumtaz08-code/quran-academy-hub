import React from 'react';
import { BookOpen, CheckCircle, Calendar, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  type: 'lesson' | 'attendance' | 'schedule' | 'payment';
  title: string;
  description: string;
  time: string;
}

interface RecentActivityProps {
  activities: Activity[];
}

const iconMap = {
  lesson: BookOpen,
  attendance: CheckCircle,
  schedule: Calendar,
  payment: DollarSign,
};

const colorMap = {
  lesson: 'bg-primary/10 text-primary',
  attendance: 'bg-emerald-light/10 text-emerald-light',
  schedule: 'bg-teal/10 text-teal',
  payment: 'bg-accent/10 text-accent',
};

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-6 border-b border-border">
        <h3 className="font-serif text-xl font-bold text-foreground">Recent Activity</h3>
      </div>
      <div className="divide-y divide-border">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No recent activity</p>
          </div>
        ) : (
          activities.map((activity) => {
            const Icon = iconMap[activity.type];
            return (
              <div key={activity.id} className="p-4 hover:bg-secondary/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={cn("p-2 rounded-lg", colorMap[activity.type])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{activity.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{activity.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
