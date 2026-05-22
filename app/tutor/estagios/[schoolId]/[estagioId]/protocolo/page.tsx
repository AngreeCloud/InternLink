import { TutorLayout } from "@/components/layout/tutor-layout";
import { TutorInternshipProtocolView } from "@/components/tutor/tutor-internship-protocol-view";

export default async function TutorInternshipProtocolPage({
  params,
}: {
  params: Promise<{ schoolId: string; estagioId: string }>;
}) {
  const { schoolId, estagioId } = await params;

  return (
    <TutorLayout>
      <TutorInternshipProtocolView schoolId={schoolId} estagioId={estagioId} />
    </TutorLayout>
  );
}
