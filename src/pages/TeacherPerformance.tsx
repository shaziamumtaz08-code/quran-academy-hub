import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MyPerformanceSection } from '@/components/dashboard/teacher/MyPerformanceSection';

export default function TeacherPerformancePage() {
  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-[1100px] mx-auto p-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">My Performance</h1>
          <p className="text-muted-foreground mt-1">Your teaching metrics this month</p>
        </div>
        <MyPerformanceSection />
      </div>
    </DashboardLayout>
  );
}
