import { CoursesManager } from "@/components/school-admin/courses-manager";

export default function SchoolAdminCoursesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cursos</h1>
        <p className="text-muted-foreground">Criação e gestão dos cursos da escola.</p>
      </div>

      <CoursesManager />
    </div>
  );
}
