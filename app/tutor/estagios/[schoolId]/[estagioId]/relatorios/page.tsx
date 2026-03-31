import { TutorLayout } from "@/components/layout/tutor-layout";
import { TutorInternshipReportsView } from "@/components/tutor/tutor-internship-reports-view";

export default async function TutorInternshipReportsPage({
  params,
}: {
  params: { schoolId: string; estagioId: string };
}) {
  const { schoolId, estagioId } = params;

  return (
    <TutorLayout>
      <TutorInternshipReportsView schoolId={schoolId} estagioId={estagioId} />
    </TutorLayout>
  );
}
