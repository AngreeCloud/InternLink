import { TutorLayout } from "@/components/layout/tutor-layout";
import { TutorInternshipProtocolView } from "@/components/tutor/tutor-internship-protocol-view";

export default async function TutorInternshipProtocolPage({
  params,
}: {
  params: { schoolId: string; estagioId: string };
}) {
  const { schoolId, estagioId } = params;

  return (
    <TutorLayout>
      <TutorInternshipProtocolView schoolId={schoolId} estagioId={estagioId} />
    </TutorLayout>
  );
}
