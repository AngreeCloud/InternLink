"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Upload, Download, Eye, Clock, CheckCircle, AlertCircle } from "lucide-react"

// Mock data - in real app this would come from Firebase
const mockDocuments = [
  {
    id: "1",
    title: "Protocolo de Estágio - João Silva",
    type: "protocol",
    status: "approved",
    uploadedBy: "Escola Secundária",
    uploadedAt: "2024-01-15",
    size: "2.3 MB",
  },
  {
    id: "2",
    title: "Relatório de Estágio - João Silva",
    type: "report",
    status: "blocked",
    uploadedBy: "João Silva",
    uploadedAt: "2024-01-20",
    size: "1.8 MB",
    blockedUntil: "2024-02-05",
  },
  {
    id: "3",
    title: "Protocolo de Estágio - Maria Santos",
    type: "protocol",
    status: "pending",
    uploadedBy: "Escola Técnica",
    uploadedAt: "2024-01-18",
    size: "2.1 MB",
  },
]

export function DocumentsOverview() {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "blocked":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

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

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Protocolos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">+2 este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Relatórios</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">3 pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovações</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15</div>
            <p className="text-xs text-muted-foreground">+5 esta semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Documentos Recentes</CardTitle>
              <CardDescription>Gerir protocolos e relatórios de estágio</CardDescription>
            </div>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Carregar Documento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(doc.status)}
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{doc.title}</h4>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <span>Por {doc.uploadedBy}</span>
                      <span>•</span>
                      <span>{doc.uploadedAt}</span>
                      <span>•</span>
                      <span>{doc.size}</span>
                    </div>
                    {doc.status === "blocked" && doc.blockedUntil && (
                      <p className="text-xs text-red-500 mt-1">Bloqueado até {doc.blockedUntil}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(doc.status)}
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
