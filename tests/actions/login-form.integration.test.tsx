import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRouterPush = vi.fn();
const mockRouterPrefetch = vi.fn();
const mockRouter = { push: mockRouterPush, prefetch: mockRouterPrefetch };

const mockSignInWithEmailAndPassword = vi.fn();
const mockGetAuthRuntime = vi.fn();
const mockGetDbRuntime = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn();
const mockCreateServerSession = vi.fn();
const mockGetLoginRedirectRoute = vi.fn();
const mockAccessValidationOverlay = vi.fn();
const mockFinalizePendingRegistration = vi.fn();
const mockIsVerificationBypassEnabled = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

vi.mock("@/lib/firebase-runtime", () => ({
  getAuthRuntime: (...args: unknown[]) => mockGetAuthRuntime(...args),
  getDbRuntime: (...args: unknown[]) => mockGetDbRuntime(...args),
}));

vi.mock("@/lib/verification", () => ({
  finalizePendingRegistration: (...args: unknown[]) => mockFinalizePendingRegistration(...args),
  isVerificationBypassEnabled: (...args: unknown[]) => mockIsVerificationBypassEnabled(...args),
}));

vi.mock("@/lib/auth/client-session", () => ({
  createServerSession: (...args: unknown[]) => mockCreateServerSession(...args),
}));

vi.mock("@/lib/auth/status-routing", () => ({
  getLoginRedirectRoute: (...args: unknown[]) => mockGetLoginRedirectRoute(...args),
}));

vi.mock("@/components/layout/access-validation-overlay", () => ({
  AccessValidationOverlay: () => {
    mockAccessValidationOverlay();
    return <div data-testid="access-validation-overlay" />;
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: { children: React.ReactNode }) => <label {...props}>{children}</label>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => {
  const Icon = () => <svg />;
  return {
    Eye: Icon,
    EyeOff: Icon,
    Lock: Icon,
    Mail: Icon,
  };
});

import { LoginForm } from "@/components/auth/login-form";

function makeDocSnapshot(data: Record<string, unknown>, exists = true) {
  return {
    exists: () => exists,
    data: () => data,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function fillCredentialsAndSubmit(renderer: TestRenderer.ReactTestRenderer, email: string, password: string) {
  const root = renderer.root as any;

  const emailInput = root.findByProps({ id: "email" });
  const passwordInput = root.findByProps({ id: "password" });

  await act(async () => {
    (emailInput.props as { onChange: (event: { target: { value: string } }) => void }).onChange({
      target: { value: email },
    });
    (passwordInput.props as { onChange: (event: { target: { value: string } }) => void }).onChange({
      target: { value: password },
    });
  });

  const form = root.findByType("form");
  await act(async () => {
    form.props.onSubmit({ preventDefault: vi.fn() });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});

  mockGetAuthRuntime.mockResolvedValue({ app: "auth" });
  mockGetDbRuntime.mockResolvedValue({ app: "db" });
  mockDoc.mockReturnValue({ path: "users/uid-1" });
  mockGetDoc.mockResolvedValue(makeDocSnapshot({ role: "aluno", estado: "ativo" }));
  mockCreateServerSession.mockResolvedValue({ role: "aluno", estado: "ativo" });
  mockGetLoginRedirectRoute.mockReturnValue("/dashboard");
  mockFinalizePendingRegistration.mockResolvedValue({ role: "professor", estado: "pendente", schoolId: "school-1" });
  mockIsVerificationBypassEnabled.mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LoginForm transition behavior", () => {
  it("não aciona transição quando o login é rejeitado", async () => {
    const deferred = createDeferred<never>();
    mockSignInWithEmailAndPassword.mockReturnValue(deferred.promise);

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<LoginForm />);
    });

    await fillCredentialsAndSubmit(renderer, "erro@escola.pt", "senha-invalida");
    await flush();

    deferred.reject(new Error("Credenciais inválidas"));
    await flush();

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(mockRouterPrefetch).not.toHaveBeenCalled();
    expect(mockAccessValidationOverlay).not.toHaveBeenCalled();
  });

  it("aciona transição e navega quando o login é bem sucedido", async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: {
        uid: "uid-1",
        email: "aluno@escola.pt",
        emailVerified: true,
      },
    });

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<LoginForm />);
    });

    await fillCredentialsAndSubmit(renderer, "aluno@escola.pt", "senha-correta");
    await flush();

    expect(mockRouterPrefetch).toHaveBeenCalledWith("/dashboard");
    expect(mockRouterPush).toHaveBeenCalledWith("/dashboard");
    expect(mockAccessValidationOverlay).toHaveBeenCalled();
  });

  it("redireciona para verify-email quando o email não está verificado", async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: {
        uid: "uid-pendente",
        email: "prof@escola.pt",
        emailVerified: false,
      },
    });

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<LoginForm />);
    });

    await fillCredentialsAndSubmit(renderer, "prof@escola.pt", "senha-correta");
    await flush();

    expect(mockRouterPush).toHaveBeenCalledWith("/verify-email?email=prof%40escola.pt");
    expect(mockCreateServerSession).not.toHaveBeenCalled();
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it("em bypass ativo, permite login sem verificação e redireciona como estado ativo", async () => {
    mockIsVerificationBypassEnabled.mockReturnValue(true);
    mockGetDoc.mockResolvedValueOnce(makeDocSnapshot({ role: "tutor", estado: "inativo" }));
    mockCreateServerSession.mockResolvedValueOnce({ role: "tutor", estado: "inativo" });
    mockGetLoginRedirectRoute.mockReturnValueOnce("/tutor");
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: {
        uid: "uid-bypass",
        email: "dev@escola.pt",
        emailVerified: false,
      },
    });

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<LoginForm />);
    });

    await fillCredentialsAndSubmit(renderer, "dev@escola.pt", "senha-correta");
    await flush();

    expect(mockGetLoginRedirectRoute).toHaveBeenCalledWith("tutor", "ativo");
    expect(mockRouterPush).toHaveBeenCalledWith("/tutor");
    expect(mockCreateServerSession).toHaveBeenCalled();
  });
});
