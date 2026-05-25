import { ProfessorLayout } from "@/components/layout/professor-layout";
import { EmpresasPage } from "@/components/empresas/empresas-page";

export default function ProfessorEmpresasPage() {
  return (
    <ProfessorLayout>
      <EmpresasPage basePath="/professor" />
    </ProfessorLayout>
  );
}
