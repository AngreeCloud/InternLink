import { EncarregadoLayout } from "@/components/layout/encarregado-layout";
import { EncarregadoDashboard } from "@/components/encarregado/encarregado-dashboard";

export default function EncarregadoPage() {
  return (
    <EncarregadoLayout>
      <EncarregadoDashboard />
    </EncarregadoLayout>
  );
}
