"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Upload, Search, Filter, Eye, Download, Plus, ChevronLeft, ChevronRight } from "lucide-react"

// Mock data
const mockProtocols = [
  {
    id: "1",
    studentName: "João Silva",
    school: "Escola Secundária de Lisboa",
    company: "TechCorp Lda",
    status: "approved",
    uploadedAt: "2024-01-15",
    description: "Estágio em desenvolvimento web",
  },
  {
    id: "2",
    studentName: "Maria Santos",
    school: "Escola Técnica do Porto",
    company: "InnovaTech SA",
    status: "pending",
    uploadedAt: "2024-01-18",
    description: "Estágio em design gráfico",
  },
  {
    id: "3",
    studentName: "Pedro Costa",
    school: "Instituto Politécnico",
    company: "DataSoft Solutions",
    status: "approved",
    uploadedAt: "2024-01-20",
    description: "Estágio em análise de dados",
  },
]

export function ProtocolsManager() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentStudent, setCurrentStudent] = useState(0)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)

  const filteredProtocols = mockProtocols.filter((protocol) => {
    const matchesSearch =
      protocol.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      protocol.company.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || protocol.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
            Aprovado
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="default" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            Pendente
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="default" className="bg-red-500/10 text-red-500 border-red-500/20">
            Rejeitado
          </Badge>
        )
      default:
        return <Badge variant="secondary">Desconhecido</Badge>
    }
  }

  const handlePreviousStudent = () => {
    setCurrentStudent((prev) => (prev > 0 ? prev - 1 : filteredProtocols.length - 1))
  }

  const handleNextStudent = () => {
    setCurrentStudent((prev) => (prev < filteredProtocols.length - 1 ? prev + 1 : 0))
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
                  placeholder="Pesquisar por aluno ou empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Protocolo
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Carregar Protocolo</DialogTitle>
                  <DialogDescription>Selecione o ficheiro do protocolo para carregar</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student">Aluno</Label>
                    <Input id="student" placeholder="Nome do aluno" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea id="description" placeholder="Descrição do estágio..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file">Ficheiro</Label>
                    <Input id="file" type="file" accept=".pdf,.docx" />
                  </div>
                  <Button className="w-full">
                    <Upload className="mr-2 h-4 w-4" />
                    Carregar Protocolo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      {filteredProtocols.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Navegação por Aluno</CardTitle>
                <CardDescription>
                  Aluno {currentStudent + 1} de {filteredProtocols.length}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handlePreviousStudent}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextStudent}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Current Protocol */}
      {filteredProtocols.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Protocolo - {filteredProtocols[currentStudent].studentName}
                </CardTitle>
                <CardDescription>
                  {filteredProtocols[currentStudent].school} • {filteredProtocols[currentStudent].company}
                </CardDescription>
              </div>
              {getStatusBadge(filteredProtocols[currentStudent].status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Detalhes do Estágio</h4>
                  <p className="text-sm text-muted-foreground">{filteredProtocols[currentStudent].description}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Data de Submissão</h4>
                  <p className="text-sm text-muted-foreground">{filteredProtocols[currentStudent].uploadedAt}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline">
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar
                </Button>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Descarregar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {filteredProtocols.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum protocolo encontrado</h3>
            <p className="text-muted-foreground">Tente ajustar os filtros ou carregar um novo protocolo.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
