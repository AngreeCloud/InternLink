type CourseRef = {
  id: string;
  name: string;
};

type StudentCourseRef = {
  courseId?: string | null;
  curso?: string | null;
};

type InternshipRef = {
  alunoId?: string | null;
  estado?: string | null;
};

function normalizeText(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

export function resolveStudentCourseId(
  student: StudentCourseRef,
  courses: CourseRef[]
): string | null {
  const rawCourseId = (student.courseId || "").trim();
  if (rawCourseId) {
    return rawCourseId;
  }

  const normalizedCourseName = normalizeText(student.curso);
  if (!normalizedCourseName) {
    return null;
  }

  const matched = courses.find((course) => normalizeText(course.name) === normalizedCourseName);
  return matched?.id || null;
}

export function resolveStudentCourseName(
  courseId: string | null | undefined,
  courses: CourseRef[],
  fallbackName?: string | null
): string {
  const normalizedCourseId = (courseId || "").trim();
  if (normalizedCourseId) {
    const matched = courses.find((course) => course.id === normalizedCourseId);
    if (matched?.name) {
      return matched.name;
    }
  }

  const fallback = (fallbackName || "").trim();
  return fallback || "—";
}

export function buildEnrolledCountByCourse(
  students: StudentCourseRef[],
  courses: CourseRef[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  const knownCourseIds = new Set(courses.map((course) => course.id));

  for (const course of courses) {
    counts[course.id] = 0;
  }

  for (const student of students) {
    const resolvedCourseId = resolveStudentCourseId(student, courses);
    if (!resolvedCourseId || !knownCourseIds.has(resolvedCourseId)) {
      continue;
    }

    counts[resolvedCourseId] += 1;
  }

  return counts;
}

export function normalizeInternshipState(value?: string | null): string {
  const normalized = normalizeText(value);
  return normalized || "ativo";
}

export function hasActiveInternshipForStudent(
  internships: InternshipRef[],
  studentId: string
): boolean {
  const normalizedStudentId = (studentId || "").trim();
  if (!normalizedStudentId) {
    return false;
  }

  return internships.some((internship) => {
    const internshipStudentId = (internship.alunoId || "").trim();
    if (internshipStudentId !== normalizedStudentId) {
      return false;
    }

    return normalizeInternshipState(internship.estado) === "ativo";
  });
}
