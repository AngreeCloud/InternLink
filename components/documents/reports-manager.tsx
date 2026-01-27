"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import {
  FileText,
  Upload,
  Search,
  Filter,
  Eye,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
} from "lucide-react"

// Mock data
const mockReports = [
  {
    id: "1",
    studentName: "João Silva",
    school: "Escola Secundária de Lisboa",
    company: "TechCorp Lda",
    status: "blocked",
    uploadedAt: "2024-01-20",
    blockedUntil: "2024-02-05",
    description: "Relatório de estágio em desenvolvimento web",
    weeksCompleted: 1,
    totalWeeks: 8,
  },
  {
    id: "2",
    studentName: "Maria Santos",
    school: "Escola Técnica do Porto",
    company: "InnovaTech SA",
    status: "available",
    uploadedAt: "2024-01-25",
    description: "Relatório de estágio em design gráfico",
    weeksCompleted: 3,
    totalWeeks: 6,
  },
  {
    id: "3",
    studentName: "Pedro Costa",
    school: "Instituto Politécnico",
    company: "DataSoft Solutions",
    status: "submitted",
    uploadedAt: "2024-01-28",
    description: "Relatório de estágio em análise de dados",
    weeksCompleted: 8,
    totalWeeks: 8,
  },
]

export function ReportsManager() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentStudent, setCurrentStudent] = useState(0)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)

  const filteredReports = mockReports.filter((report) => {
    const matchesSearch =
      report.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.company.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || report.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
            Submetido
          </Badge>
        )
      case "available":
        return (
          <Badge variant="default" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            Disponível
          </Badge>
        )
      case "blocked":
        return (
          <Badge variant="default" className="bg-red-500/10 text-red-500 border-red-500/20">
            Bloqueado
          </Badge>
        )
      default:
        return <Badge variant="secondary">Desconhecido</Badge>
    }
  }

  const getStatusAlert = (report: any) => {
    if (report.status === "blocked") {
      return (
        <Alert className="border-red-500/20 bg-red-500/10">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-500">
            Relatório bloqueado até {report.blockedUntil}. O aluno deve aguardar o período mínimo de 2 semanas.
          </AlertDescription>
        </Alert>
      )
    }
    if (report.status === "available" && report.weeksCompleted >= 2) {
      return (
        <Alert className="border-blue-500/20 bg-blue-500/10">
          <Clock className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-blue-500">
            Relatório disponível para submissão. O aluno já completou {report.weeksCompleted} semanas.
          </AlertDescription>
        </Alert>
      )
    }
    return null
  }

  const handlePreviousStudent = () => {
    setCurrentStudent((prev) => (prev > 0 ? prev - 1 : filteredReports.length - 1))
  }

  const handleNextStudent = () => {
    setCurrentStudent((prev) => (prev < filteredReports.length - 1 ? prev + 1 : 0))
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
                <SelectItem value="submitted">Submetido</SelectItem>
                <SelectItem value="available">Disponível</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Relatório
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Carregar Relatório</DialogTitle>
                  <DialogDescription>Selecione o ficheiro do relatório para carregar</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student">Aluno</Label>
                    <Input id="student" placeholder="Nome do aluno" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea id="description" placeholder="Descrição do relatório..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file">Ficheiro</Label>
                    <Input id="file" type="file" accept=".pdf,.docx" />
                  </div>
                  <Button className="w-full">
                    <Upload className="mr-2 h-4 w-4" />
                    Carregar Relatório
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      {filteredReports.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Navegação por Aluno</CardTitle>
                <CardDescription>
                  Aluno {currentStudent + 1} de {filteredReports.length}
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

      {/* Current Report */}
      {filteredReports.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Relatório - {filteredReports[currentStudent].studentName}
                </CardTitle>
                <CardDescription>
                  {filteredReports[currentStudent].school} • {filteredReports[currentStudent].company}
                </CardDescription>
              </div>
              {getStatusBadge(filteredReports[currentStudent].status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getStatusAlert(filteredReports[currentStudent])}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Detalhes do Relatório</h4>
                  <p className="text-sm text-muted-foreground">{filteredReports[currentStudent].description}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Progresso do Estágio</h4>
                  <p className="text-sm text-muted-foreground">
                    {filteredReports[currentStudent].weeksCompleted} de {filteredReports[currentStudent].totalWeeks}{" "}
                    semanas completadas
                  </p>
                  <div className="w-full bg-muted rounded-full h-2 mt-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{
                        width: `${(filteredReports[currentStudent].weeksCompleted / filteredReports[currentStudent].totalWeeks) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button variant="outline" disabled={filteredReports[currentStudent].status === "blocked"}>
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar
                </Button>
                <Button variant="outline" disabled={filteredReports[currentStudent].status === "blocked"}>
                  <Download className="mr-2 h-4 w-4" />
                  Descarregar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {filteredReports.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum relatório encontrado</h3>
            <p className="text-muted-foreground">Tente ajustar os filtros ou carregar um novo relatório.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
