"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, MessageSquare } from "lucide-react"

interface ChatNotification {
  id: string
  senderName: string
  senderRole: string
  message: string
  timestamp: string
  roomId: string
}

// Mock notifications
const mockNotifications: ChatNotification[] = [
  {
    id: "1",
    senderName: "Eng. Pedro Santos",
    senderRole: "company",
    message: "Ótimo! Hoje vamos começar com uma introdução aos projetos da empresa.",
    timestamp: "2024-01-29T10:30:00Z",
    roomId: "1",
  },
  {
    id: "2",
    senderName: "Dr. Carlos Lima",
    senderRole: "company",
    message: "Quando podemos marcar a reunião?",
    timestamp: "2024-01-29T12:15:00Z",
    roomId: "2",
  },
]

export function ChatNotifications() {
  const [notifications, setNotifications] = useState<ChatNotification[]>([])
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Simulate receiving notifications
    const timer = setTimeout(() => {
      setNotifications(mockNotifications)
      setIsVisible(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const dismissNotification = (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id))
    if (notifications.length <= 1) {
      setIsVisible(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "student":
        return (
          <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">
            Aluno
          </Badge>
        )
      case "school":
        return (
          <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
            Escola
          </Badge>
        )
      case "company":
        return (
          <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
            Empresa
          </Badge>
        )
      default:
        return <Badge variant="secondary">Desconhecido</Badge>
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (!isVisible || notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <Card key={notification.id} className="border-primary/20 bg-card/95 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{notification.senderName}</span>
                {getRoleBadge(notification.senderRole)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => dismissNotification(notification.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{notification.message}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{formatTime(notification.timestamp)}</span>
              <Button variant="outline" size="sm" className="h-6 text-xs bg-transparent">
                Responder
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
