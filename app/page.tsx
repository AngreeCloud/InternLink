"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SeedSchoolAdmin } from "@/components/seed/seed-school-admin"
import {
	GraduationCap,
	Users,
	Shield,
	Briefcase,
	Sparkles,
	ChevronRight,
	School,
	UserCheck,
	ClipboardList,
	MessageSquareText,
	CheckCircle,
	Globe,
	Mail,
	Cpu,
} from "lucide-react"

const audience = [
	{
		title: "Alunos",
		description: "Acompanham o estágio, submetem relatórios e comunicam com a escola.",
		icon: <GraduationCap className="h-5 w-5" />,
	},
	{
		title: "Professores",
		description: "Validam documentos, monitorizam progresso e aprovam etapas.",
		icon: <UserCheck className="h-5 w-5" />,
	},
	{
		title: "Tutores",
		description: "Interagem com o aluno e acompanham o plano de estágio.",
		icon: <Users className="h-5 w-5" />,
	},
	{
		title: "Escolas",
		description: "Gerem cursos, pastas e aprovações com total visibilidade.",
		icon: <School className="h-5 w-5" />,
	},
]

const features = [
	{
		title: "Gestão integrada",
		description: "Fluxo único para alunos, professores e tutores acompanharem estágios em tempo real.",
		icon: <Users className="h-5 w-5" />,
	},
	{
		title: "Segurança e aprovação",
		description: "Estados pendente/ativo e validações garantem controlo e conformidade.",
		icon: <Shield className="h-5 w-5" />,
	},
	{
		title: "Documentos e protocolos",
		description: "Centralização de protocolos, relatórios e evidências de estágio.",
		icon: <ClipboardList className="h-5 w-5" />,
	},
	{
		title: "Comunicação fluida",
		description: "Chat integrado e notificações para decisões rápidas.",
		icon: <MessageSquareText className="h-5 w-5" />,
	},
	{
		title: "Relatórios claros",
		description: "Dashboards e indicadores para o acompanhamento pedagógico.",
		icon: <Briefcase className="h-5 w-5" />,
	},
	{
		title: "Escalável e moderno",
		description: "Arquitetura cloud pronta para crescimento e novas integrações.",
		icon: <Cpu className="h-5 w-5" />,
	},
]

const steps = [
	{
		title: "Solicitar acesso",
		description: "A escola submete o pedido e recebe orientação para configuração inicial.",
		icon: <Mail className="h-5 w-5" />,
	},
	{
		title: "Criação de admin escolar",
		description: "É criado o perfil responsável e ativados os módulos principais.",
		icon: <UserCheck className="h-5 w-5" />,
	},
	{
		title: "Configuração e uso",
		description: "Cursos, professores e alunos são geridos pela própria escola.",
		icon: <CheckCircle className="h-5 w-5" />,
	},
]

const faqs = [
	{
		question: "A plataforma é gratuita?",
		answer: "Sim, é uma solução académica pensada para uso escolar e projetos PAP.",
	},
	{
		question: "Como é feita a aprovação de contas?",
		answer: "O administrador escolar valida contas e controla quem entra na plataforma.",
	},
	{
		question: "Posso começar só com alguns cursos?",
		answer: "Sim. A escola pode ativar apenas os cursos necessários e expandir depois.",
	},
]

const testimonials = [
	{
		name: "Catarina M.",
		role: "Coordenadora de Estágios",
		text: "Finalmente temos um fluxo claro para aprovar protocolos e acompanhar cada aluno.",
	},
	{
		name: "João S.",
		role: "Aluno",
		text: "Consigo ver o estado do meu estágio e falar com o tutor num só local.",
	},
	{
		name: "Miguel P.",
		role: "Professor",
		text: "A gestão de relatórios ficou muito mais rápida e organizada.",
	},
]

export default function HomePage() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-foreground">
			<SeedSchoolAdmin />
			<header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
					<div className="flex items-center gap-2 font-semibold">
						<GraduationCap className="h-6 w-6 text-primary" />
						<span>InternLink</span>
					</div>
					<nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
						<Link href="/#para-quem" className="transition hover:text-foreground">
							Para quem é
						</Link>
						<Link href="/#funcionalidades" className="transition hover:text-foreground">
							Funcionalidades
						</Link>
						<Link href="/#como-funciona" className="transition hover:text-foreground">
							Como funciona
						</Link>
						<Link href="/para-escolas" className="transition hover:text-foreground">
							Para Escolas
						</Link>
						<Link href="/sobre" className="transition hover:text-foreground">
							Sobre
						</Link>
						<Link href="/contacto" className="transition hover:text-foreground">
							Contacto
						</Link>
					</nav>
					<div className="flex items-center gap-3">
						<Button asChild variant="ghost" className="hidden md:inline-flex">
							<Link href="/solicitar-acesso">Solicitar Acesso</Link>
						</Button>
						<Button asChild variant="ghost">
							<Link href="/login">Entrar</Link>
						</Button>
						<Button asChild>
							<Link href="/register">Criar Conta</Link>
						</Button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-6xl px-4 py-16 space-y-24">
				<section className="grid gap-10 lg:grid-cols-2 lg:items-center">
					<div className="space-y-6 animate-fade-in">
						<div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
							<Sparkles className="h-4 w-4" /> Gestão integrada de estágios
						</div>
						<h1 className="text-4xl font-bold leading-tight sm:text-5xl">
							A plataforma completa para gerir estágios curriculares
						</h1>
						<p className="text-lg text-muted-foreground">
							A InternLink centraliza comunicação, documentação e aprovações entre escolas, alunos e empresas.
						</p>
						<div className="flex flex-wrap gap-3">
							<Button size="lg" asChild>
								<Link href="/register">Criar Conta</Link>
							</Button>
							<Button size="lg" variant="outline" asChild>
								<Link href="/solicitar-acesso">Solicitar Acesso</Link>
							</Button>
							<Button size="lg" variant="ghost" asChild>
								<Link href="/login">Entrar</Link>
							</Button>
						</div>
						<div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
							<div className="flex items-center gap-2">
								<CheckCircle className="h-4 w-4 text-primary" /> Aprovações rápidas
							</div>
							<div className="flex items-center gap-2">
								<Globe className="h-4 w-4 text-primary" /> Acesso centralizado
							</div>
						</div>
					</div>
					<Card className="border-primary/20 shadow-lg animate-slide-up">
						<CardHeader>
							<CardTitle>Resumo rápido</CardTitle>
							<CardDescription>Visão geral do fluxo InternLink</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 text-sm text-muted-foreground">
							<div className="flex items-start gap-3">
								<div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
								<p>
									<strong>Solicitação e ativação</strong> para escolas que entram na plataforma.
								</p>
							</div>
							<div className="flex items-start gap-3">
								<div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
								<p>
									<strong>Gestão autónoma</strong> de cursos, professores e alunos.
								</p>
							</div>
							<div className="flex items-start gap-3">
								<div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
								<p>
									<strong>Comunicação contínua</strong> com chat, documentos e relatórios.
								</p>
							</div>
						</CardContent>
					</Card>
				</section>

				<section id="para-quem" className="space-y-8">
					<div className="space-y-2">
						<p className="text-sm uppercase tracking-wide text-primary">Para quem é?</p>
						<h2 className="text-3xl font-semibold">Perfis suportados pela plataforma</h2>
						<p className="text-muted-foreground">
							Cada perfil tem permissões e ferramentas específicas para acompanhar o estágio.
						</p>
					</div>
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
						{audience.map((item) => (
							<Card key={item.title} className="animate-fade-in">
								<CardHeader className="space-y-3">
									<div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
										{item.icon}
									</div>
									<CardTitle>{item.title}</CardTitle>
									<CardDescription>{item.description}</CardDescription>
								</CardHeader>
							</Card>
						))}
					</div>
				</section>

				<section id="funcionalidades" className="space-y-8">
					<div className="space-y-2">
						<p className="text-sm uppercase tracking-wide text-primary">Funcionalidades principais</p>
						<h2 className="text-3xl font-semibold">Tudo o que precisa para gerir estágios</h2>
					</div>
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{features.map((feature) => (
							<Card key={feature.title} className="animate-fade-in">
								<CardHeader className="space-y-3">
									<div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
										{feature.icon}
									</div>
									<CardTitle>{feature.title}</CardTitle>
									<CardDescription>{feature.description}</CardDescription>
								</CardHeader>
							</Card>
						))}
					</div>
				</section>

				<section id="como-funciona" className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
					<div className="space-y-4">
						<p className="text-sm uppercase tracking-wide text-primary">Como funciona</p>
						<h2 className="text-3xl font-semibold">Fluxo claro para adoção escolar</h2>
						<p className="text-muted-foreground">
							A escola solicita acesso, recebe apoio na configuração e começa a gerir estágios com autonomia.
						</p>
						<Button asChild>
							<Link href="/solicitar-acesso" className="flex items-center gap-2">
								Solicitar Acesso <ChevronRight className="h-4 w-4" />
							</Link>
						</Button>
					</div>
					<div className="space-y-4">
						{steps.map((step, index) => (
							<Card key={step.title}>
								<CardContent className="flex items-start gap-4 py-6">
									<Badge variant="secondary" className="rounded-full px-3 py-1 text-sm">
										0{index + 1}
									</Badge>
									<div className="space-y-1">
										<div className="flex items-center gap-2 text-sm text-primary">
											{step.icon}
											<span className="font-semibold">{step.title}</span>
										</div>
										<p className="text-sm text-muted-foreground">{step.description}</p>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</section>

				<section className="grid gap-6 md:grid-cols-3">
					{testimonials.map((item) => (
						<Card key={item.name} className="animate-fade-in">
							<CardHeader>
								<CardTitle>{item.name}</CardTitle>
								<CardDescription>{item.role}</CardDescription>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground">“{item.text}”</CardContent>
						</Card>
					))}
				</section>

				<section id="faq" className="space-y-6">
					<div className="space-y-2">
						<p className="text-sm uppercase tracking-wide text-primary">FAQ</p>
						<h2 className="text-3xl font-semibold">Perguntas frequentes</h2>
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						{faqs.map((item) => (
							<Card key={item.question}>
								<CardHeader>
									<CardTitle className="text-base">{item.question}</CardTitle>
								</CardHeader>
								<CardContent className="text-sm text-muted-foreground">{item.answer}</CardContent>
							</Card>
						))}
					</div>
				</section>

				<section className="rounded-2xl border border-border bg-card/80 p-8 shadow-lg animate-slide-up">
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div>
							<p className="text-sm uppercase tracking-wide text-primary">Pronto para começar?</p>
							<h2 className="text-2xl font-semibold">Crie a sua conta ou solicite acesso para a sua escola.</h2>
							<p className="text-muted-foreground">
								Respostas rápidas e acompanhamento contínuo durante todo o processo.
							</p>
						</div>
						<div className="flex flex-wrap gap-3">
							<Button asChild>
								<Link href="/register" className="flex items-center gap-2">
									Criar Conta <ChevronRight className="h-4 w-4" />
								</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link href="/solicitar-acesso">Solicitar Acesso</Link>
							</Button>
							<Button variant="ghost" asChild>
								<Link href="/login">Já tenho conta</Link>
							</Button>
						</div>
					</div>
				</section>
			</main>

			<footer className="border-t border-border bg-background/90">
				<div className="mx-auto max-w-6xl px-4 py-10">
					<div className="grid gap-8 md:grid-cols-4">
						<div className="space-y-2">
							<div className="flex items-center gap-2 font-semibold">
								<GraduationCap className="h-5 w-5 text-primary" />
								<span>InternLink</span>
							</div>
							<p className="text-sm text-muted-foreground">
								Plataforma de gestão de estágios curriculares para escolas, alunos e empresas.
							</p>
							<p className="text-sm text-muted-foreground">support@internlink.com</p>
						</div>
						<div className="space-y-2 text-sm">
							<p className="font-semibold">Acesso</p>
							<Link href="/solicitar-acesso" className="block text-muted-foreground hover:text-foreground">
								Solicitar Acesso
							</Link>
							<Link href="/register" className="block text-muted-foreground hover:text-foreground">
								Criar Conta
							</Link>
							<Link href="/login" className="block text-muted-foreground hover:text-foreground">
								Entrar
							</Link>
						</div>
						<div className="space-y-2 text-sm">
							<p className="font-semibold">Recursos</p>
							<Link href="/para-escolas" className="block text-muted-foreground hover:text-foreground">
								Para Escolas
							</Link>
							<Link href="/sobre" className="block text-muted-foreground hover:text-foreground">
								Sobre
							</Link>
							<Link href="/contacto" className="block text-muted-foreground hover:text-foreground">
								Contacto
							</Link>
						</div>
						<div className="space-y-2 text-sm">
							<p className="font-semibold">Legal</p>
							<Link href="/termos" className="block text-muted-foreground hover:text-foreground">
								Termos
							</Link>
							<Link href="/privacidade" className="block text-muted-foreground hover:text-foreground">
								Privacidade
							</Link>
							<Link href="/licenca" className="block text-muted-foreground hover:text-foreground">
								Licença
							</Link>
						</div>
					</div>
					<div className="mt-8 flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
						<p>© {new Date().getFullYear()} InternLink. Todos os direitos reservados.</p>
						<p>Autor: Miguel Pedrosa</p>
					</div>
				</div>
			</footer>

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
