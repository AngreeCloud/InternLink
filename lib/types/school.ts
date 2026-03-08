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
  /**
   * Se true, exige validação de número de telemóvel via SMS após verificação de email.
   */
  requiresPhone?: boolean;
  createdAt?: Date | { toDate: () => Date };
  updatedAt?: Date | { toDate: () => Date };
};

export type SchoolConfig = Pick<
  School,
  "requireInstitutionalEmail" | "emailDomain" | "allowGoogleLogin" | "requiresPhone"
>;
