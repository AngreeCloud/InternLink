"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Search, Filter, UserCheck, UserX, Mail } from "lucide-react"
import { collection, getDocs } from "firebase/firestore"
import { getDbRuntime } from "@/lib/firebase-runtime"

export function UsersManager() {
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [users, setUsers] = useState<Array<Record<string, any>>>([])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const db = await getDbRuntime()
        const snap = await getDocs(collection(db, "users"))
        if (!active) return
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }))
        setUsers(items)
      } catch (err) {
        console.error("Failed to load users", err)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const filteredUsers = users.filter((user) => {
    const name = (user.nome || user.name || "").toString()
    const email = (user.email || "").toString()
    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase())
    const role = (user.role || user.roleName || "").toString()
    const status = (user.estado || user.status || "").toString()
    const matchesRole = roleFilter === "all" || role === roleFilter
    const matchesStatus = statusFilter === "all" || status === statusFilter
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
                    <AvatarImage src={undefined} alt={(user.nome || user.name || "").toString()} />
                    <AvatarFallback>{(user.nome || user.name || "").toString().charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">{(user.nome || user.name || "—").toString()}</h4>
                      {getRoleBadge((user.role || user.roleName || "").toString())}
                      {getStatusBadge((user.estado || user.status || "").toString())}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>{(user.email || "").toString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(user.school || user.schoolName) && <span>Escola: {(user.school || user.schoolName).toString()}</span>}
                      {(user.company || user.tutorEmpresa) && <span>Empresa: {(user.company || user.tutorEmpresa).toString()}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Registado: {user.joinedAt} • Último acesso: {user.lastActive}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {((user.estado || user.status) === "pending" || (user.estado || user.status) === "pendente") && (
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
                  {((user.estado || user.status) === "active" || (user.estado || user.status) === "ativo") && (
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
