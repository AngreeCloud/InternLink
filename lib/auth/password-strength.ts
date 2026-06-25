export type PasswordStrength = {
  score: number;
  label: string;
  textClass: string;
};

export function computePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: "Ainda sem avaliação", textClass: "text-muted-foreground" };
  }
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return { score, label: "Fraca", textClass: "text-red-500" };
  if (score === 2) return { score, label: "Média", textClass: "text-amber-500" };
  if (score === 3) return { score, label: "Boa", textClass: "text-lime-600" };
  return { score, label: "Forte", textClass: "text-emerald-600" };
}
