import { TutorLayout } from "@/components/layout/tutor-layout";
import { TutorSchoolInternships } from "@/components/tutor/tutor-school-internships";

export default async function TutorSchoolEstagiosPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;

  return (
    <TutorLayout>
      <TutorSchoolInternships schoolId={schoolId} />
    </TutorLayout>
  );
}
