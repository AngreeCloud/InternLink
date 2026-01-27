"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Building, School, UserCheck, UserX, Clock, CheckCircle, AlertTriangle } from "lucide-react"

// Mock data for admin overview
const mockStats = {
  totalUsers: 156,
  pendingApprovals: 12,
  totalSchools: 8,
  totalCompanies: 24,
  activeInternships: 45,
  completedInternships: 89,
}

const mockPendingUsers = [
  {
    id: "1",
    name: "Ana Silva",
    email: "ana@email.com",
    userType: "student",
    school: "Escola Secundária de Lisboa",
    company: "TechCorp Lda",
    registeredAt: "2024-01-28",
    description: "Estágio em desenvolvimento web",
  },
  {
    id: "2",
    name: "Carlos Santos",
    email: "carlos@empresa.com",
    userType: "company",
    school: "",
    company: "InnovaTech SA",
    registeredAt: "2024-01-27",
    description: "Representante da empresa para estágios",
  },
  {
    id: "3",
    name: "Prof. Maria Costa",
    email: "maria@escola.pt",
    userType: "school",
    school: "Instituto Politécnico",
    company: "",
    registeredAt: "2024-01-26",
    description: "Coordenadora de estágios",
  },
]

const mockSchools = [
  {
    id: "1",
    name: "Escola Secundária de Lisboa",
    location: "Lisboa",
    activeStudents: 23,
    totalInternships: 45,
    status: "active",
  },
  {
    id: "2",
    name: "Escola Técnica do Porto",
    location: "Porto",
    activeStudents: 18,
    totalInternships: 32,
    status: "active",
  },
  {
    id: "3",
    name: "Instituto Politécnico",
    location: "Coimbra",
    activeStudents: 15,
    totalInternships: 28,
    status: "active",
  },
]

const mockCompanies = [
  {
    id: "1",
    name: "TechCorp Lda",
    sector: "Tecnologia",
    activeInterns: 8,
    totalInternships: 15,
    status: "active",
  },
  {
    id: "2",
    name: "InnovaTech SA",
    sector: "Design",
    activeInterns: 5,
    totalInternships: 12,
    status: "active",
  },
  {
    id: "3",
    name: "DataSoft Solutions",
    sector: "Análise de Dados",
    activeInterns: 6,
    totalInternships: 18,
    status: "active",
  },
]

export function AdminOverview() {
  const getUserTypeBadge = (userType: string) => {
    switch (userType) {
      case "student":
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            Aluno
          </Badge>
        )
      case "school":
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
            Escola
          </Badge>
        )
      case "company":
        return (
          <Badge variant="secondary" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
            Empresa
          </Badge>
        )
      default:
        return <Badge variant="secondary">Desconhecido</Badge>
    }
  }

  const handleApproveUser = (userId: string) => {
    console.log("Approving user:", userId)
    // TODO: Implement user approval logic
  }

  const handleRejectUser = (userId: string) => {
    console.log("Rejecting user:", userId)
    // TODO: Implement user rejection logic
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Utilizadores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">+12 este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovações Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{mockStats.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">Requer atenção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escolas Ativas</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.totalSchools}</div>
            <p className="text-xs text-muted-foreground">Todas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas Parceiras</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.totalCompanies}</div>
            <p className="text-xs text-muted-foreground">+3 este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estágios Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{mockStats.activeInternships}</div>
            <p className="text-xs text-muted-foreground">Em progresso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estágios Concluídos</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.completedInternships}</div>
            <p className="text-xs text-muted-foreground">Total histórico</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="approvals" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="approvals">Aprovações</TabsTrigger>
          <TabsTrigger value="schools">Escolas</TabsTrigger>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="users">Utilizadores</TabsTrigger>
        </TabsList>

        {/* Pending Approvals Tab */}
        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Aprovações Pendentes
              </CardTitle>
              <CardDescription>Utilizadores aguardando aprovação para aceder à plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockPendingUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-foreground">{user.name}</h4>
                        {getUserTypeBadge(user.userType)}
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <div className="text-xs text-muted-foreground">
                        {user.school && <span>Escola: {user.school}</span>}
                        {user.company && <span>Empresa: {user.company}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{user.description}</p>
                      <p className="text-xs text-muted-foreground">Registado em: {user.registeredAt}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 border-green-600 hover:bg-green-50 bg-transparent"
                        onClick={() => handleApproveUser(user.id)}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
                        onClick={() => handleRejectUser(user.id)}
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schools Tab */}
        <TabsContent value="schools" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <School className="h-5 w-5" />
                    Escolas Registadas
                  </CardTitle>
                  <CardDescription>Gerir escolas parceiras da plataforma</CardDescription>
                </div>
                <Button>Adicionar Escola</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockSchools.map((school) => (
                  <div
                    key={school.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div>
                      <h4 className="text-sm font-medium text-foreground">{school.name}</h4>
                      <p className="text-xs text-muted-foreground">Localização: {school.location}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{school.activeStudents} alunos ativos</span>
                        <span>{school.totalInternships} estágios total</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                        Ativa
                      </Badge>
                      <Button variant="outline" size="sm">
                        Editar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Empresas Parceiras
                  </CardTitle>
                  <CardDescription>Gerir empresas que oferecem estágios</CardDescription>
                </div>
                <Button>Adicionar Empresa</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div>
                      <h4 className="text-sm font-medium text-foreground">{company.name}</h4>
                      <p className="text-xs text-muted-foreground">Setor: {company.sector}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{company.activeInterns} estagiários ativos</span>
                        <span>{company.totalInternships} estágios total</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                        Ativa
                      </Badge>
                      <Button variant="outline" size="sm">
                        Editar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestão de Utilizadores
              </CardTitle>
              <CardDescription>Ver e gerir todos os utilizadores da plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Gestão de Utilizadores</h3>
                <p className="text-muted-foreground">
                  Funcionalidade completa de gestão de utilizadores será implementada aqui.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
