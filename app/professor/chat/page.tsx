import { ProfessorLayout } from "@/components/layout/professor-layout";
import { ProfessorChatHub } from "@/components/professor/professor-chat-hub";

export default function ProfessorChatPage() {
  return (
    <ProfessorLayout>
      <ProfessorChatHub />
    </ProfessorLayout>
  );
}
