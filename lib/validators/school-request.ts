import { z } from "zod"

export const schoolRequestSchema = z.object({
  schoolName: z
    .string()
    .min(3, "O nome da escola deve ter pelo menos 3 caracteres.")
    .max(120, "O nome da escola é demasiado longo."),
  contactEmail: z
    .string()
    .email("Email institucional inválido.")
    .max(160, "O email é demasiado longo."),
  contactName: z
    .string()
    .min(2, "O nome do responsável é obrigatório.")
    .max(120, "O nome do responsável é demasiado longo."),
  role: z
    .string()
    .min(2, "O cargo é obrigatório.")
    .max(120, "O cargo é demasiado longo."),
  message: z
    .string()
    .max(500, "A mensagem não pode exceder 500 caracteres.")
    .optional()
    .or(z.literal("")),
})

export type SchoolRequestInput = z.infer<typeof schoolRequestSchema>
