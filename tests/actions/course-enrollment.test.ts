import { describe, expect, it } from "vitest";
import {
  buildEnrolledCountByCourse,
  hasActiveInternshipForStudent,
  normalizeInternshipState,
  resolveStudentCourseId,
  resolveStudentCourseName,
} from "@/lib/course-enrollment";

const courses = [
  { id: "c1", name: "Informática - Sistemas" },
  { id: "c2", name: "Eletrónica" },
  { id: "c3", name: "Gestão" },
];

describe("course enrollment helpers", () => {
  it("resolveStudentCourseId prioriza courseId quando existe", () => {
    expect(resolveStudentCourseId({ courseId: "c2", curso: "Gestão" }, courses)).toBe("c2");
  });

  it("resolveStudentCourseId usa nome do curso quando não há courseId", () => {
    expect(resolveStudentCourseId({ curso: "informática - sistemas" }, courses)).toBe("c1");
  });

  it("resolveStudentCourseName devolve o nome da turma pelo id", () => {
    expect(resolveStudentCourseName("c3", courses, "Outro")).toBe("Gestão");
  });

  it("resolveStudentCourseName usa fallback quando id não existe", () => {
    expect(resolveStudentCourseName("", courses, "Curso legado")).toBe("Curso legado");
    expect(resolveStudentCourseName("", courses, "")).toBe("—");
  });

  it("buildEnrolledCountByCourse conta apenas turmas existentes", () => {
    const counts = buildEnrolledCountByCourse(
      [
        { courseId: "c1" },
        { courseId: "c1" },
        { curso: "Eletrónica" },
        { courseId: "inexistente" },
        { curso: "turma inexistente" },
      ],
      courses
    );

    expect(counts).toEqual({ c1: 2, c2: 1, c3: 0 });
  });

  it("normalizeInternshipState assume ativo quando estado vazio", () => {
    expect(normalizeInternshipState("")).toBe("ativo");
    expect(normalizeInternshipState(undefined)).toBe("ativo");
    expect(normalizeInternshipState("ATIVO")).toBe("ativo");
  });

  it("hasActiveInternshipForStudent bloqueia apenas quando há estágio ativo", () => {
    const internships = [
      { alunoId: "s1", estado: "ativo" },
      { alunoId: "s2", estado: "concluido" },
      { alunoId: "s3", estado: "" },
    ];

    expect(hasActiveInternshipForStudent(internships, "s1")).toBe(true);
    expect(hasActiveInternshipForStudent(internships, "s2")).toBe(false);
    expect(hasActiveInternshipForStudent(internships, "s3")).toBe(true);
    expect(hasActiveInternshipForStudent(internships, "s9")).toBe(false);
  });
});
