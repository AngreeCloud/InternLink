"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { registerTutor } from "@/actions/register";
import { useRouter } from "next/navigation";

const tutorSchema = z.object({
  nome: z.string().min(3, "O nome é obrigatório."),
  email: z.string().email("Email inválido."),
  password: z.string().min(6, "A password deve ter no mínimo 6 caracteres."),
  empresa: z.string().min(1, "A empresa é obrigatória."),
  dataNascimento: z.string().optional(),
  localidade: z.string().optional(),
  telefone: z.string().optional(),
});

export default function TutorRegisterPage() {
  const form = useForm<z.infer<typeof tutorSchema>>({
    resolver: zodResolver(tutorSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      empresa: "",
      dataNascimento: "",
      localidade: "",
      telefone: "",
    },
  });

  const router = useRouter();

  async function onSubmit(values: z.infer<typeof tutorSchema>) {
    try {
      const result = await registerTutor(values);
      router.push(
        `/account-status?email=${encodeURIComponent(result.email ?? values.email)}&createdAt=${encodeURIComponent(
          result.createdAt ?? ""
        )}`
      );
    } catch (error) {
      console.error("Erro ao criar conta de tutor:", error);
      alert("Erro ao criar conta. Tente novamente.");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Registo de Tutor</CardTitle>
          <CardDescription>Preencha os seus dados para criar a conta de tutor.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl><Input placeholder="O seu nome" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
               <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="teu@email.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="empresa" render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <FormControl><Input placeholder="Nome da sua empresa" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
               <FormField control={form.control} name="dataNascimento" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Nascimento (Opcional)</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="localidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Localidade (Opcional)</FormLabel>
                  <FormControl><Input placeholder="A sua localidade" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (Opcional)</FormLabel>
                  <FormControl><Input placeholder="O seu contacto" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full mt-1">Criar Conta</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
