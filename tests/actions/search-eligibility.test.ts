import { describe, it, expect } from "vitest";
import { isValidEmail } from "@/lib/chat/realtime-chat";

describe("isValidEmail", () => {
  it("aceita email normal", () => {
    expect(isValidEmail("user@domain.pt")).toBe(true);
  });

  it("aceita email com subdominio", () => {
    expect(isValidEmail("user@sub.domain.com")).toBe(true);
  });

  it("rejeita string sem @", () => {
    expect(isValidEmail("userdomain.pt")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejeita string sem ponto", () => {
    expect(isValidEmail("user@domain")).toBe(false);
  });

  it("trim espacos e aceita", () => {
    expect(isValidEmail(" user@domain.pt ")).toBe(true);
  });
});
