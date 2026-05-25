import { ProfessorLayout } from "@/components/layout/professor-layout";
import { EmpresasDetail } from "@/components/empresas/empresas-detail";

export default async function ProfessorEmpresaDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return (
    <ProfessorLayout>
      <EmpresasDetail empresaId={id} basePath="/professor" />
    </ProfessorLayout>
  );
}
