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
import { professorRegisterFormSchema } from "@/lib/validators/register";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { getRecaptchaV3Token } from "@/lib/recaptcha-v3";

const professorSchema = professorRegisterFormSchema;

export default function ProfessorRegisterPage() {
  const [schools, setSchools] = useState<{
    id: string;
    name: string;
    emailDomain?: string;
    requireInstitutionalEmail?: boolean;
  }[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [submitError, setSubmitError] = useState("");
  const submitLockRef = useRef(false);
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

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

  useEffect(() => {
    if (!recaptchaSiteKey) return;
    void getRecaptchaV3Token(recaptchaSiteKey, "register_professor_pageview").catch(() => {});
  }, [recaptchaSiteKey]);

  const resolveRegisterErrorMessage = (error: unknown) => {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: string }).code)
        : "";

    if (code === "auth/email-already-in-use") {
      return "Este email já está registado. Utilize outro email ou recupere a palavra-passe.";
    }

    if (code === "auth/missing-recaptcha-token") {
      return "Falha na verificação CAPTCHA. Atualize a página e tente novamente.";
    }

    if (code === "auth/invalid-recaptcha-token" || code === "auth/recaptcha-check-failed") {
      return "Não foi possível validar o reCAPTCHA. Tente novamente.";
    }

    return "Erro ao criar conta. Tente novamente.";
  };

  async function onSubmit(values: z.infer<typeof professorSchema>) {
    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    try {
      setSubmitError("");

      let recaptchaToken = "";
      if (recaptchaSiteKey) {
        recaptchaToken = await getRecaptchaV3Token(recaptchaSiteKey, "register_professor");
      }

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
        recaptchaToken,
      });
      router.push(
        `/account-status?email=${encodeURIComponent(result.email ?? values.email)}&createdAt=${encodeURIComponent(
          result.createdAt ?? ""
        )}`
      );
    } catch (error) {
      console.error("Erro ao criar conta de professor:", error);
      setSubmitError(resolveRegisterErrorMessage(error));
    } finally {
      submitLockRef.current = false;
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
              {recaptchaSiteKey && (
                <p className="text-xs text-muted-foreground">Este formulário usa reCAPTCHA para proteção automática.</p>
              )}
              <Button type="submit" className="w-full mt-1" disabled={form.formState.isSubmitting || submitLockRef.current}>
                {form.formState.isSubmitting || submitLockRef.current ? "A registar..." : "Criar Conta"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
