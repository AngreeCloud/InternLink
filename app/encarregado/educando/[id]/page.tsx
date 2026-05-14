import { EncarregadoLayout } from "@/components/layout/encarregado-layout";
import { EncarregadoEducandoDetail } from "@/components/encarregado/encarregado-educando-detail";

export default async function EncarregadoEducandoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <EncarregadoLayout>
      <EncarregadoEducandoDetail studentId={id} />
    </EncarregadoLayout>
  );
}
