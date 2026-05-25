import { EmpresasDetail } from "@/components/empresas/empresas-detail";

export default async function SchoolAdminEmpresaDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <EmpresasDetail empresaId={id} basePath="/school-admin" />;
}
