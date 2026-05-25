import { ProfessorLayout } from "@/components/layout/professor-layout";
import { EmpresasCreateForm } from "@/components/empresas/empresas-create-form";

export default function ProfessorNovaEmpresaPage() {
  return (
    <ProfessorLayout>
      <EmpresasCreateForm basePath="/professor" />
    </ProfessorLayout>
  );
}
