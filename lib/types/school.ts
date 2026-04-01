export type School = {
  id: string;
  name: string;
  shortName?: string;
  address?: string;
  contact?: string;
  educationLevel?: string;
  emailDomain?: string;
  requireInstitutionalEmail?: boolean;
  /**
   * Se true, permite login com Google (OAuth).
   * Se false, apenas email/password é permitido.
   * Nota: Se requireInstitutionalEmail for true, Google Login é automaticamente bloqueado.
   */
  allowGoogleLogin?: boolean;
  profileImageUrl?: string;
  /**
   * Backwards-compatible flag. Original field used `requiresPhone`.
   * New fields split responsibilities:
   * - `requirePhone`: se true, o número de telemóvel é obrigatório no registo
   * - `requirePhoneVerification`: se true, a verificação por SMS é exigida após verificação de email
   */
  requiresPhone?: boolean;
  requirePhone?: boolean;
  requirePhoneVerification?: boolean;
  createdAt?: Date | { toDate: () => Date };
  updatedAt?: Date | { toDate: () => Date };
};

export type SchoolConfig = Pick<
  School,
  | "requireInstitutionalEmail"
  | "emailDomain"
  | "allowGoogleLogin"
  | "requiresPhone"
  | "requirePhone"
  | "requirePhoneVerification"
>;
