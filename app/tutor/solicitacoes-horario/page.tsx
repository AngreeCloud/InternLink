"use client";

import { useState } from "react";
import { TutorLayout } from "@/components/layout/tutor-layout";
import { TutorRequestsCenter } from "@/components/tutor/tutor-requests-center";
import { TutorTerminosAntecipadosCenter } from "@/components/tutor/tutor-terminos-antecipados-center";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TutorSolicitacoesHorarioPage() {
  const [activeTab, setActiveTab] = useState("faltas");

  return (
    <TutorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Solicitações de mudança de horário</h1>
          <p className="text-muted-foreground">
            Pedidos de faltas futuras e término antecipado dos seus formandos.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="faltas">Faltas / alterações</TabsTrigger>
            <TabsTrigger value="terminos">Términos antecipados</TabsTrigger>
          </TabsList>
          <TabsContent value="faltas" className="mt-4">
            <TutorRequestsCenter />
          </TabsContent>
          <TabsContent value="terminos" className="mt-4">
            <TutorTerminosAntecipadosCenter />
          </TabsContent>
        </Tabs>
      </div>
    </TutorLayout>
  );
}
