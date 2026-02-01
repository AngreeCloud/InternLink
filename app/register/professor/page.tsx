"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { registerProfessor } from "@/actions/register";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";

const professorSchema = z.object({
  nome: z.string().min(3, "O nome é obrigatório."),
  email: z.string().email("Email inválido."),
  password: z.string().min(6, "A password deve ter no mínimo 6 caracteres."),
  escola: z.string().min(1, "A escola é obrigatória."),
  dataNascimento: z.string().optional(),
  localidade: z.string().optional(),
  telefone: z.string().optional(),
});

export default function ProfessorRegisterPage() {
  const [schools, setSchools] = useState<{
    id: string;
    name: string;
    emailDomain?: string;
    requireInstitutionalEmail?: boolean;
  }[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [submitError, setSubmitError] = useState("");

  const form = useForm<z.infer<typeof professorSchema>>({
    resolver: zodResolver(professorSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      escola: "",
      dataNascimento: "",
      localidade: "",
      telefone: "",
    },
  });

  const router = useRouter();
  const selectedSchoolId = form.watch("escola");

  useEffect(() => {
    let active = true;

    const loadSchools = async () => {
      setLoadingSchools(true);
      const db = await getDbRuntime();
      const snapshot = await getDocs(collection(db, "schools"));
      if (!active) return;
      setSchools(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as {
            name?: string;
            emailDomain?: string;
            requireInstitutionalEmail?: boolean;
          };
          return {
            id: docSnap.id,
            name: data.name || "—",
            emailDomain: data.emailDomain || "",
            requireInstitutionalEmail: Boolean(data.requireInstitutionalEmail),
          };
        })
      );
      setLoadingSchools(false);
    };

    loadSchools();

    return () => {
      active = false;
    };
  }, []);

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId),
    [schools, selectedSchoolId]
  );

  const selectedSchoolName = selectedSchool?.name || "";

  async function onSubmit(values: z.infer<typeof professorSchema>) {
    try {
      setSubmitError("");
      if (selectedSchool?.requireInstitutionalEmail && selectedSchool.emailDomain) {
        const domain = selectedSchool.emailDomain.trim().toLowerCase();
        const email = values.email.trim().toLowerCase();
        if (!email.endsWith(domain)) {
          setSubmitError("Esta escola exige email institucional. Use um email com o domínio correto.");
          return;
        }
      }

      const result = await registerProfessor({
        ...values,
        escolaId: values.escola,
        escolaNome: selectedSchoolName,
      });
      router.push(
        `/account-status?email=${encodeURIComponent(result.email ?? values.email)}&createdAt=${encodeURIComponent(
          result.createdAt ?? ""
        )}`
      );
    } catch (error) {
      console.error("Erro ao criar conta de professor:", error);
      alert("Erro ao criar conta. Tente novamente.");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Registo de Professor</CardTitle>
          <CardDescription>Preencha os seus dados para criar a conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {submitError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {submitError}
                </div>
              )}
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
              <FormField control={form.control} name="escola" render={({ field }) => (
                <FormItem>
                  <FormLabel>Escola</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={(value) => {
                      field.onChange(value);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingSchools ? "A carregar escolas..." : "Selecione a escola"} />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.map((school) => (
                          <SelectItem key={school.id} value={school.id}>
                            {school.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
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
