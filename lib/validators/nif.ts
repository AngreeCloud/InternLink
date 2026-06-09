export function validateNIF(nif: string): { valid: boolean; message?: string } {
  const digits = nif.replace(/\s+/g, "").replace(/[^0-9]/g, "");
  if (!digits) return { valid: true };
  if (digits.length !== 9) return { valid: false, message: "NIF deve ter 9 dígitos" };
  if (/^([0-9])\1{8}$/.test(digits)) return { valid: false, message: "NIF inválido: dígitos repetidos" };
  const firstDigit = parseInt(digits[0], 10);
  if (firstDigit < 1 || firstDigit > 9) return { valid: false, message: "NIF inválido" };
  const checkDigit = parseInt(digits[8], 10);
  let total = 0;
  for (let i = 0; i < 8; i++) {
    total += parseInt(digits[i], 10) * (9 - i);
  }
  const remainder = total % 11;
  const expected = remainder < 2 ? 0 : 11 - remainder;
  if (checkDigit !== expected) return { valid: false, message: "NIF inválido: dígito de controlo incorreto" };
  return { valid: true };
}
