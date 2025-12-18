import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Eye, Filter, Calendar, BookOpen, User, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  mockSubjects, 
  mockExamTemplates, 
  mockTemplateFields,
  mockExamSubmissions, 
  mockSubmissionValues,
  mockStudents,
  getSubmissionWithValues 
} from '@/lib/mockExamData';
import { ExamSubmission, ExamTenure } from '@/types/exam';

export default function ExamResults() {
  const { user } = useAuth();
  const [selectedSubmission, setSelectedSubmission] = useState<ExamSubmission | null>(null);
  
  // Filters
  const [studentFilter, setStudentFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [tenureFilter, setTenureFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  const isAdminOrExaminer = user?.role === 'admin' || user?.role === 'examiner';
  const isTeacher = user?.role === 'teacher';
  const isStudentOrParent = user?.role === 'student' || user?.role === 'parent';

  // Enrich submissions with template and student data
  const enrichedSubmissions = useMemo(() => {
    return mockExamSubmissions.map(sub => {
      const template = mockExamTemplates.find(t => t.id === sub.template_id);
      const student = mockStudents.find(s => s.id === sub.student_id);
      return {
        ...sub,
        template: template ? { ...template, subject: mockSubjects.find(s => s.id === template.subject_id) } : undefined,
        student_name: student?.name || 'Unknown',
      };
    });
  }, []);

  // Apply filters
  const filteredSubmissions = useMemo(() => {
    return enrichedSubmissions.filter(sub => {
      if (studentFilter && sub.student_id !== studentFilter) return false;
      if (subjectFilter && sub.template?.subject_id !== subjectFilter) return false;
      if (tenureFilter && sub.template?.tenure !== tenureFilter) return false;
      if (monthFilter) {
        const subMonth = new Date(sub.exam_date).getMonth() + 1;
        if (subMonth !== parseInt(monthFilter)) return false;
      }
      
      // Role-based filtering
      if (isStudentOrParent && sub.student_id !== user?.id) {
        // In real implementation, parents would see children's results
        return false;
      }
      
      return true;
    });
  }, [enrichedSubmissions, studentFilter, subjectFilter, tenureFilter, monthFilter, isStudentOrParent, user?.id]);

  const handleViewDetails = (submission: ExamSubmission) => {
    const fullSubmission = getSubmissionWithValues(submission.id);
    if (fullSubmission) {
      setSelectedSubmission(fullSubmission);
    }
  };

  // Get visible fields for current user role
  const getVisibleValues = () => {
    if (!selectedSubmission?.values) return [];
    
    if (isAdminOrExaminer) {
      // Admin/Examiner sees all fields
      return selectedSubmission.values;
    }
    
    // Teacher sees all fields for assigned students, but not internal remarks
    // Student/Parent only sees public fields
    return selectedSubmission.values.filter(v => v.field?.is_public);
  };

  const visibleValues = getVisibleValues();

  const getPercentageBadge = (percentage: number) => {
    if (percentage >= 80) return <Badge className="bg-primary">Excellent</Badge>;
    if (percentage >= 70) return <Badge variant="default">Good</Badge>;
    if (percentage >= 50) return <Badge variant="secondary">Satisfactory</Badge>;
    return <Badge variant="destructive">Needs Improvement</Badge>;
  };

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Exam Results</h1>
          <p className="text-muted-foreground mt-1">
            {isStudentOrParent ? 'View your exam results and progress' : 'View and filter exam results'}
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {!isStudentOrParent && (
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={studentFilter} onValueChange={setStudentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All students" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All students</SelectItem>
                      {mockStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All subjects</SelectItem>
                    {mockSubjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Tenure</Label>
                <Select value={tenureFilter} onValueChange={setTenureFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All tenures" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All tenures</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All months</SelectItem>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardContent className="pt-6">
            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No exam results found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isStudentOrParent && <TableHead>Student</TableHead>}
                    <TableHead>Exam</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Tenure</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Percentage</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map((submission) => (
                    <TableRow key={submission.id}>
                      {!isStudentOrParent && (
                        <TableCell className="font-medium">{submission.student_name}</TableCell>
                      )}
                      <TableCell>{submission.template?.name}</TableCell>
                      <TableCell>{submission.template?.subject?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{submission.template?.tenure}</Badge>
                      </TableCell>
                      <TableCell>{new Date(submission.exam_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-center font-medium">
                        {submission.total_marks} / {submission.max_total_marks}
                      </TableCell>
                      <TableCell className="text-center">
                        {getPercentageBadge(submission.percentage)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetails(submission)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Exam Result Details</DialogTitle>
            </DialogHeader>
            
            {selectedSubmission && (
              <div className="space-y-6 pt-4">
                {/* Header Info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" /> Student
                    </p>
                    <p className="font-medium">{selectedSubmission.student_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Date
                    </p>
                    <p className="font-medium">{new Date(selectedSubmission.exam_date).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <BookOpen className="h-4 w-4" /> Exam
                    </p>
                    <p className="font-medium">{selectedSubmission.template?.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Subject</p>
                    <Badge variant="outline">{selectedSubmission.template?.subject?.name}</Badge>
                  </div>
                </div>

                <Separator />

                {/* Score Breakdown */}
                <div>
                  <h3 className="font-semibold mb-4">Score Breakdown</h3>
                  <div className="space-y-3">
                    {visibleValues.filter(v => v.field && v.field.max_marks > 0).map((value) => (
                      <div key={value.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                        <span>{value.field?.label}</span>
                        <span className="font-medium">
                          {value.marks} / {value.field?.max_marks}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Score */}
                <div className="p-4 bg-primary/10 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total Score</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary">
                        {selectedSubmission.total_marks}
                      </span>
                      <span className="text-muted-foreground"> / {selectedSubmission.max_total_marks}</span>
                      <div className="mt-1">
                        {getPercentageBadge(selectedSubmission.percentage)}
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({selectedSubmission.percentage}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Remarks */}
                {selectedSubmission.public_remarks && (
                  <div>
                    <h3 className="font-semibold mb-2">Feedback</h3>
                    <p className="p-3 bg-secondary/50 rounded-lg text-sm">
                      {selectedSubmission.public_remarks}
                    </p>
                  </div>
                )}

                {/* Internal remarks - only for admin/examiner */}
                {isAdminOrExaminer && selectedSubmission.examiner_remarks && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      Examiner Notes
                      <Badge variant="secondary" className="text-xs">Internal</Badge>
                    </h3>
                    <p className="p-3 bg-muted rounded-lg text-sm">
                      {selectedSubmission.examiner_remarks}
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
