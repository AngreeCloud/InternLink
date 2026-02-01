import { SchoolInfoForm } from "@/components/school-admin/school-info-form";

export default function SchoolInfoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Informações da Escola</h1>
        <p className="text-muted-foreground">Edite os dados institucionais da sua escola.</p>
      </div>
      <SchoolInfoForm />
    </div>
  );
}
