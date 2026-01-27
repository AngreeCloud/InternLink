"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Search, Filter, UserCheck, UserX, Mail } from "lucide-react"

// Mock users data
const mockUsers = [
  {
    id: "1",
    name: "João Silva",
    email: "joao@escola.pt",
    role: "school",
    status: "active",
    school: "Escola Secundária de Lisboa",
    company: "",
    joinedAt: "2024-01-15",
    lastActive: "2024-01-29",
  },
  {
    id: "2",
    name: "Maria Santos",
    email: "maria@email.com",
    role: "student",
    status: "active",
    school: "Escola Técnica do Porto",
    company: "InnovaTech SA",
    joinedAt: "2024-01-18",
    lastActive: "2024-01-28",
  },
  {
    id: "3",
    name: "Eng. Pedro Costa",
    email: "pedro@empresa.com",
    role: "company",
    status: "active",
    school: "",
    company: "TechCorp Lda",
    joinedAt: "2024-01-20",
    lastActive: "2024-01-29",
  },
  {
    id: "4",
    name: "Ana Rodrigues",
    email: "ana@email.com",
    role: "student",
    status: "pending",
    school: "Instituto Politécnico",
    company: "DataSoft Solutions",
    joinedAt: "2024-01-28",
    lastActive: "2024-01-28",
  },
]

export function UsersManager() {
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredUsers = mockUsers.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  const getRoleBadge = (role: string) => {
    switch (role) {
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
      case "admin":
        return (
          <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-red-500/20">
            Admin
          </Badge>
        )
      default:
        return <Badge variant="secondary">Desconhecido</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
            Ativo
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="default" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            Pendente
          </Badge>
        )
      case "inactive":
        return (
          <Badge variant="default" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
            Inativo
          </Badge>
        )
      default:
        return <Badge variant="secondary">Desconhecido</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros e Pesquisa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar por papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                <SelectItem value="student">Aluno</SelectItem>
                <SelectItem value="school">Escola</SelectItem>
                <SelectItem value="company">Empresa</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Utilizadores ({filteredUsers.length})
          </CardTitle>
          <CardDescription>Lista de todos os utilizadores registados na plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="/placeholder.svg" alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">{user.name}</h4>
                      {getRoleBadge(user.role)}
                      {getStatusBadge(user.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>{user.email}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.school && <span>Escola: {user.school}</span>}
                      {user.company && <span>Empresa: {user.company}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Registado: {user.joinedAt} • Último acesso: {user.lastActive}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {user.status === "pending" && (
                    <>
                      <Button variant="outline" size="sm" className="text-green-600 border-green-600 bg-transparent">
                        <UserCheck className="mr-2 h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 border-red-600 bg-transparent">
                        <UserX className="mr-2 h-4 w-4" />
                        Rejeitar
                      </Button>
                    </>
                  )}
                  {user.status === "active" && (
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum utilizador encontrado</h3>
              <p className="text-muted-foreground">Tente ajustar os filtros de pesquisa.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
