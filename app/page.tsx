"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { GraduationCap, Users, Shield, Briefcase, Sparkles, ChevronRight } from "lucide-react"

const sections = [
	{
		title: "Integração completa",
		description: "Fluxo único para alunos, professores e tutores acompanharem estágios em tempo real.",
		icon: <Users className="h-5 w-5" />,
	},
	{
		title: "Segurança e aprovação",
		description: "Estados de conta pendente/ativo e validações garantem controlo e conformidade.",
		icon: <Shield className="h-5 w-5" />,
	},
	{
		title: "Foco no progresso",
		description: "Dashboards claros e relatórios ajudam a manter todos alinhados.",
		icon: <Briefcase className="h-5 w-5" />,
	},
]

export default function HomePage() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-foreground">
			<header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
					<div className="flex items-center gap-2 font-semibold">
						<GraduationCap className="h-6 w-6 text-primary" />
						<span>InternLink</span>
					</div>
					<div className="flex items-center gap-3">
						<Button asChild variant="ghost">
							<Link href="/login">Entrar</Link>
						</Button>
						<Button asChild>
							<Link href="/register">Criar Conta</Link>
						</Button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-6xl px-4 py-16 space-y-20">
				<section className="grid gap-10 lg:grid-cols-2 lg:items-center">
					<div className="space-y-6 animate-fade-in">
						<div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
							<Sparkles className="h-4 w-4" /> Gestão integrada de estágios
						</div>
						<h1 className="text-4xl font-bold leading-tight sm:text-5xl">
							Conecta Alunos, Professores e Tutores num só lugar
						</h1>
						<p className="text-lg text-muted-foreground">
							A InternLink centraliza a gestão de estágios curriculares, simplificando o acompanhamento, comunicação e
							aprovação de perfis em tempo real.
						</p>
						<div className="flex flex-wrap gap-3">
							<Button size="lg" asChild>
								<Link href="/register">Criar Conta</Link>
							</Button>
							<Button size="lg" variant="outline" asChild>
								<Link href="/login">Entrar</Link>
							</Button>
						</div>
					</div>
					<Card className="border-primary/20 shadow-lg animate-slide-up">
						<CardHeader>
							<CardTitle>Como funciona</CardTitle>
							<CardDescription>Fluxo claro para todos os perfis da plataforma</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 text-sm text-muted-foreground">
							<div className="flex items-start gap-3">
								<div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
								<p>
									<strong>Registo rápido</strong> com email para alunos, professores e tutores.
								</p>
							</div>
							<div className="flex items-start gap-3">
								<div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
								<p>
									<strong>Validação de conta</strong> e estados dinâmicos (pendente, ativo) sincronizados com o
									Firestore.
								</p>
							</div>
							<div className="flex items-start gap-3">
								<div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
								<p>
									<strong>Dashboard</strong> com dados do utilizador autenticado e módulos prontos para expansão.
								</p>
							</div>
						</CardContent>
					</Card>
				</section>

				<section className="grid gap-6 md:grid-cols-3">
					{sections.map((section) => (
						<Card key={section.title} className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
							<CardHeader className="space-y-2">
								<div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
									{section.icon}
								</div>
								<CardTitle>{section.title}</CardTitle>
								<CardDescription>{section.description}</CardDescription>
							</CardHeader>
						</Card>
					))}
				</section>

				<section className="rounded-2xl border border-border bg-card/80 p-8 shadow-lg animate-slide-up">
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div>
							<p className="text-sm uppercase tracking-wide text-primary">Pronto para começar?</p>
							<h2 className="text-2xl font-semibold">
								Crie a sua conta e acompanhe o estado em segundos.
							</h2>
							<p className="text-muted-foreground">
								A verificação de email ativa a sua conta para aceder ao dashboard.
							</p>
						</div>
						<div className="flex gap-3">
							<Button asChild>
								<Link href="/register" className="flex items-center gap-2">
									Começar agora <ChevronRight className="h-4 w-4" />
								</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link href="/login">Já tenho conta</Link>
							</Button>
						</div>
					</div>
				</section>
			</main>

			<style jsx global>{`
				@keyframes fade-in {
					from {
						opacity: 0;
						transform: translateY(8px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
				@keyframes slide-up {
					from {
						opacity: 0;
						transform: translateY(16px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
				.animate-fade-in {
					animation: fade-in 0.6s ease forwards;
				}
				.animate-slide-up {
					animation: slide-up 0.7s ease forwards;
				}
			`}</style>
		</div>
	)
}
