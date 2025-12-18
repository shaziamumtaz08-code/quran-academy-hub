export type UserRole = 'admin' | 'teacher' | 'student' | 'parent' | 'examiner';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export interface Teacher {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  assignedStudents: string[];
  monthlyRate: number;
  paymentStatus: 'paid' | 'unpaid';
}

export interface Student {
  id: string;
  userId: string;
  name: string;
  email: string;
  parentId?: string;
  teacherId?: string;
  monthlyFee: number;
  feeStatus: 'paid' | 'unpaid';
}

export interface Parent {
  id: string;
  userId: string;
  name: string;
  email: string;
  childrenIds: string[];
}

export interface ClassSchedule {
  id: string;
  studentId: string;
  teacherId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:MM
  duration: number; // minutes
  isActive: boolean;
}

export interface Attendance {
  id: string;
  scheduleId: string;
  studentId: string;
  teacherId: string;
  date: Date;
  status: 'present' | 'absent' | 'late';
  lessonCovered?: string;
  homework?: string;
  notes?: string;
}

export interface MonthlyReport {
  id: string;
  studentId: string;
  teacherId: string;
  month: number;
  year: number;
  totalClasses: number;
  attendedClasses: number;
  lessonsCompleted: string[];
  progressNotes: string;
}

export interface TeacherKPI {
  teacherId: string;
  month: number;
  year: number;
  totalClasses: number;
  classesDelivered: number;
  averageAttendance: number;
  studentsAssigned: number;
}
