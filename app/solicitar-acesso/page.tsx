"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { submitSchoolRequest } from "@/actions/school-requests"
import { schoolRequestSchema } from "@/lib/validators/school-request"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function RequestAccessPage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setError(null)
    setFieldErrors({})

    const formData = new FormData(event.currentTarget)
    const input = {
      schoolName: String(formData.get("schoolName") || "").trim(),
      contactEmail: String(formData.get("contactEmail") || "").trim(),
      contactName: String(formData.get("contactName") || "").trim(),
      role: String(formData.get("role") || "").trim(),
      message: String(formData.get("message") || "").trim(),
    }

    const validation = schoolRequestSchema.safeParse(input)
    if (!validation.success) {
      setFieldErrors(validation.error.flatten().fieldErrors)
      return
    }

    try {
      setLoading(true)
      const result = await submitSchoolRequest(validation.data)
      if (!result.ok) {
        setFieldErrors(result.issues || {})
        setError("Preencha os campos corretamente.")
        return
      }
      setSubmitted(true)
      event.currentTarget.reset()
    } catch (err) {
      setError("Não foi possível enviar o pedido. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">Voltar</Link>
        </Button>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Solicitar Acesso</CardTitle>
            <CardDescription>
              Preencha o formulário para que possamos criar o acesso da sua escola à InternLink.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="schoolName">Nome da escola</Label>
                <Input id="schoolName" name="schoolName" placeholder="Escola Secundária de..." required />
                {fieldErrors.schoolName?.map((message) => (
                  <p key={message} className="text-sm text-destructive">
                    {message}
                  </p>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email institucional</Label>
                <Input id="contactEmail" name="contactEmail" type="email" placeholder="contacto@escola.pt" required />
                {fieldErrors.contactEmail?.map((message) => (
                  <p key={message} className="text-sm text-destructive">
                    {message}
                  </p>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Nome do responsável</Label>
                  <Input id="contactName" name="contactName" placeholder="Nome completo" required />
                  {fieldErrors.contactName?.map((message) => (
                    <p key={message} className="text-sm text-destructive">
                      {message}
                    </p>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Cargo</Label>
                  <Input id="role" name="role" placeholder="Direção, coordenação..." required />
                  {fieldErrors.role?.map((message) => (
                    <p key={message} className="text-sm text-destructive">
                      {message}
                    </p>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Mensagem (opcional)</Label>
                <Textarea id="message" name="message" rows={4} placeholder="Deixe detalhes adicionais..." />
                {fieldErrors.message?.map((message) => (
                  <p key={message} className="text-sm text-destructive">
                    {message}
                  </p>
                ))}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {submitted && !error && (
                <p className="text-sm text-primary">Pedido enviado com sucesso! Entraremos em contacto em breve.</p>
              )}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "A enviar..." : "Enviar pedido"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
