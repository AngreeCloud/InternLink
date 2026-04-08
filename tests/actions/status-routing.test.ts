import { describe, expect, it } from "vitest";
import { getDashboardRouteForRole, getLoginRedirectRoute } from "@/lib/auth/status-routing";

describe("status-routing", () => {
  describe("getLoginRedirectRoute", () => {
    it("routes pending students to waiting", () => {
      expect(getLoginRedirectRoute("aluno", "pendente")).toBe("/waiting");
    });

    it("routes approved students to dashboard", () => {
      expect(getLoginRedirectRoute("aluno", "ativo")).toBe("/dashboard");
    });

    it("routes approved professors to professor area", () => {
      expect(getLoginRedirectRoute("professor", "ativo")).toBe("/professor");
    });

    it("routes non-active professors to account-status", () => {
      expect(getLoginRedirectRoute("professor", "pendente")).toBe("/account-status");
    });

    it("routes tutor accounts to tutor area", () => {
      expect(getLoginRedirectRoute("tutor", "pendente")).toBe("/tutor");
    });

    it("routes school admins to school-admin area", () => {
      expect(getLoginRedirectRoute("admin_escolar", "ativo")).toBe("/school-admin");
    });

    it("falls back to account-status for unknown role", () => {
      expect(getLoginRedirectRoute("", "pendente")).toBe("/account-status");
    });
  });

  describe("getDashboardRouteForRole", () => {
    it("returns role-specific dashboard routes", () => {
      expect(getDashboardRouteForRole("aluno")).toBe("/dashboard");
      expect(getDashboardRouteForRole("professor")).toBe("/professor");
      expect(getDashboardRouteForRole("tutor")).toBe("/tutor");
      expect(getDashboardRouteForRole("admin_escolar")).toBe("/school-admin");
    });
  });
});