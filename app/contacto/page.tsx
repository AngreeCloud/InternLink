"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function ContactoPage() {
  const [sent, setSent] = useState(false)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSent(true)
    event.currentTarget.reset()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">Voltar</Link>
        </Button>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Contacto</CardTitle>
            <CardDescription>Tem alguma questão? Envie-nos uma mensagem.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" placeholder="Nome completo" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="nome@email.pt" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea id="message" name="message" rows={5} placeholder="Escreva a sua mensagem..." required />
              </div>
              {sent && <p className="text-sm text-primary">Mensagem enviada! Vamos responder em breve.</p>}
              <Button type="submit" className="w-full">
                Enviar mensagem
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
