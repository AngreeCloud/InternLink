"use client"

import type React from "react"
import { useState } from "react"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { getDbRuntime } from "@/lib/firebase-runtime"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function RequestAccessPage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setError(null)

    const formData = new FormData(event.currentTarget)
    const schoolName = String(formData.get("schoolName") || "").trim()
    const contactEmail = String(formData.get("contactEmail") || "").trim()
    const contactName = String(formData.get("contactName") || "").trim()
    const role = String(formData.get("role") || "").trim()
    const message = String(formData.get("message") || "").trim()

    if (!schoolName || !contactEmail || !contactName || !role) {
      setError("Preencha todos os campos obrigatórios.")
      return
    }

    try {
      setLoading(true)
      const db = await getDbRuntime()
      await addDoc(collection(db, "schoolRequests"), {
        schoolName,
        contactEmail,
        contactName,
        role,
        message,
        createdAt: serverTimestamp(),
        status: "pending",
      })
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
      <div className="mx-auto max-w-3xl px-4 py-16">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email institucional</Label>
                <Input id="contactEmail" name="contactEmail" type="email" placeholder="contacto@escola.pt" required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Nome do responsável</Label>
                  <Input id="contactName" name="contactName" placeholder="Nome completo" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Cargo</Label>
                  <Input id="role" name="role" placeholder="Direção, coordenação..." required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Mensagem (opcional)</Label>
                <Textarea id="message" name="message" rows={4} placeholder="Deixe detalhes adicionais..." />
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
