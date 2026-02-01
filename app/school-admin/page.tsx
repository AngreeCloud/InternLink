import { PendingTeachersSection } from "@/components/school-admin/pending-teachers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function SchoolAdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard da Escola</h1>
        <p className="text-muted-foreground">Visão geral da sua escola e professores pendentes.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
            <CardDescription>Gestão local da escola.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Utilize a secção de informações para manter os dados da escola atualizados e acompanhe os
            professores pendentes abaixo.
          </CardContent>
        </Card>

        <PendingTeachersSection />
      </div>
    </div>
  );
}
