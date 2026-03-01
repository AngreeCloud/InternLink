import { z } from "zod";

const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?(?:[\s-]?[0-9]){8,14}$/;

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function isNotFutureDate(value: string) {
  const inputDate = new Date(`${value}T00:00:00.000Z`);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return inputDate.getTime() <= todayUtc.getTime();
}

const nomeSchema = z
  .string()
  .trim()
  .min(3, "O nome é obrigatório.")
  .max(120, "O nome é demasiado longo.");

const emailSchema = z
  .string()
  .trim()
  .email("Email inválido.")
  .max(160, "O email é demasiado longo.");

const passwordSchema = z
  .string()
  .min(6, "A password deve ter no mínimo 6 caracteres.")
  .max(128, "A password é demasiado longa.");

const requiredBirthDateSchema = z
  .string()
  .trim()
  .min(1, "A data de nascimento é obrigatória.")
  .refine(isValidDateString, "Data de nascimento inválida.")
  .refine(isNotFutureDate, "A data de nascimento não pode ser futura.");

const optionalBirthDateSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || isValidDateString(value), "Data de nascimento inválida.")
  .refine((value) => value === "" || isNotFutureDate(value), "A data de nascimento não pode ser futura.");

const telefoneSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || phoneRegex.test(value), "Telefone inválido.");

const localidadeSchema = z.string().trim().max(120, "A localidade é demasiado longa.").optional();

export const alunoRegisterFormSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  password: passwordSchema,
  escola: z.string().min(1, "A escola é obrigatória."),
  curso: z.string().min(1, "O curso é obrigatório."),
  dataNascimento: requiredBirthDateSchema,
  localidade: localidadeSchema,
  telefone: telefoneSchema.optional(),
});

export const professorRegisterFormSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  password: passwordSchema,
  escola: z.string().min(1, "A escola é obrigatória."),
  dataNascimento: optionalBirthDateSchema.optional(),
  localidade: localidadeSchema,
  telefone: telefoneSchema.optional(),
});

export const tutorRegisterFormSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  password: passwordSchema,
  empresa: z.string().trim().min(1, "A empresa é obrigatória.").max(160, "A empresa é demasiado longa."),
  dataNascimento: optionalBirthDateSchema.optional(),
  localidade: localidadeSchema,
  telefone: telefoneSchema.optional(),
});

export const alunoRegisterActionSchema = z
  .object({
    nome: nomeSchema,
    email: emailSchema,
    password: passwordSchema,
    escolaId: z.string().min(1, "A escola é obrigatória."),
    escolaNome: z.string().trim().min(1, "O nome da escola é obrigatório."),
    cursoId: z.string().min(1, "O curso é obrigatório."),
    cursoNome: z.string().trim().min(1, "O nome do curso é obrigatório."),
    recaptchaToken: z.string().trim().optional(),
    dataNascimento: requiredBirthDateSchema,
    localidade: localidadeSchema,
    telefone: telefoneSchema.optional(),
  })
  .passthrough();

export const professorRegisterActionSchema = z
  .object({
    nome: nomeSchema,
    email: emailSchema,
    password: passwordSchema,
    escolaId: z.string().min(1, "A escola é obrigatória."),
    escolaNome: z.string().trim().min(1, "O nome da escola é obrigatório."),
    recaptchaToken: z.string().trim().optional(),
    dataNascimento: optionalBirthDateSchema.optional(),
    localidade: localidadeSchema,
    telefone: telefoneSchema.optional(),
  })
  .passthrough();

export const tutorRegisterActionSchema = z
  .object({
    nome: nomeSchema,
    email: emailSchema,
    password: passwordSchema,
    empresa: z.string().trim().min(1, "A empresa é obrigatória.").max(160, "A empresa é demasiado longa."),
    recaptchaToken: z.string().trim().optional(),
    dataNascimento: optionalBirthDateSchema.optional(),
    localidade: localidadeSchema,
    telefone: telefoneSchema.optional(),
  })
  .passthrough();
