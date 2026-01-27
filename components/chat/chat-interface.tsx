"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { MessageSquare, Send, Users, Building, School, User, Paperclip } from "lucide-react"

// Mock data for chat rooms (internships)
const mockChatRooms = [
  {
    id: "1",
    studentName: "João Silva",
    school: "Escola Secundária de Lisboa",
    company: "TechCorp Lda",
    participants: [
      { id: "1", name: "João Silva", role: "student", avatar: "", online: true },
      { id: "2", name: "Prof. Maria Costa", role: "school", avatar: "", online: true },
      { id: "3", name: "Eng. Pedro Santos", role: "company", avatar: "", online: false },
    ],
    lastMessage: "Obrigado pela orientação!",
    lastMessageTime: "14:30",
    unreadCount: 2,
  },
  {
    id: "2",
    studentName: "Maria Santos",
    school: "Escola Técnica do Porto",
    company: "InnovaTech SA",
    participants: [
      { id: "4", name: "Maria Santos", role: "student", avatar: "", online: false },
      { id: "5", name: "Prof. Ana Rodrigues", role: "school", avatar: "", online: true },
      { id: "6", name: "Dr. Carlos Lima", role: "company", avatar: "", online: true },
    ],
    lastMessage: "Quando podemos marcar a reunião?",
    lastMessageTime: "12:15",
    unreadCount: 0,
  },
]

// Mock messages for the selected chat room
const mockMessages = [
  {
    id: "1",
    senderId: "2",
    senderName: "Prof. Maria Costa",
    senderRole: "school",
    content: "Bom dia! Como está a correr o primeiro dia de estágio?",
    timestamp: "2024-01-29T09:00:00Z",
    type: "text",
  },
  {
    id: "2",
    senderId: "1",
    senderName: "João Silva",
    senderRole: "student",
    content: "Bom dia! Está a correr muito bem. A equipa é muito acolhedora.",
    timestamp: "2024-01-29T09:15:00Z",
    type: "text",
  },
  {
    id: "3",
    senderId: "3",
    senderName: "Eng. Pedro Santos",
    senderRole: "company",
    content: "Ótimo! Hoje vamos começar com uma introdução aos projetos da empresa.",
    timestamp: "2024-01-29T10:30:00Z",
    type: "text",
  },
  {
    id: "4",
    senderId: "1",
    senderName: "João Silva",
    senderRole: "student",
    content: "Perfeito! Estou ansioso para começar a contribuir.",
    timestamp: "2024-01-29T10:35:00Z",
    type: "text",
  },
  {
    id: "5",
    senderId: "2",
    senderName: "Prof. Maria Costa",
    senderRole: "school",
    content: "Lembrem-se de documentar as atividades para o relatório final.",
    timestamp: "2024-01-29T14:20:00Z",
    type: "text",
  },
  {
    id: "6",
    senderId: "1",
    senderName: "João Silva",
    senderRole: "student",
    content: "Obrigado pela orientação!",
    timestamp: "2024-01-29T14:30:00Z",
    type: "text",
  },
]

export function ChatInterface() {
  const [selectedRoom, setSelectedRoom] = useState(mockChatRooms[0])
  const [messages, setMessages] = useState(mockMessages)
  const [newMessage, setNewMessage] = useState("")
  const [currentUser] = useState({ id: "2", name: "Prof. Maria Costa", role: "school" })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = () => {
    if (!newMessage.trim()) return

    const message = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      content: newMessage,
      timestamp: new Date().toISOString(),
      type: "text" as const,
    }

    setMessages([...messages, message])
    setNewMessage("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "student":
        return <User className="h-3 w-3" />
      case "school":
        return <School className="h-3 w-3" />
      case "company":
        return <Building className="h-3 w-3" />
      default:
        return <User className="h-3 w-3" />
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

  return (
    <div className="flex h-full gap-4">
      {/* Chat Rooms Sidebar */}
      <Card className="w-80 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversas de Estágio
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full">
            <div className="space-y-1 p-3">
              {mockChatRooms.map((room) => (
                <div
                  key={room.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedRoom.id === room.id ? "bg-primary/10 border border-primary/20" : "hover:bg-accent"
                  }`}
                  onClick={() => setSelectedRoom(room)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">{room.studentName}</h4>
                      <p className="text-xs text-muted-foreground truncate">{room.school}</p>
                      <p className="text-xs text-muted-foreground truncate">{room.company}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{room.lastMessage}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">{room.lastMessageTime}</span>
                      {room.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {room.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col">
        {/* Chat Header */}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {selectedRoom.studentName}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedRoom.school} • {selectedRoom.company}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedRoom.participants.map((participant) => (
                <div key={participant.id} className="flex items-center gap-1">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={participant.avatar || "/placeholder.svg"} />
                    <AvatarFallback className="text-xs">{participant.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className={`h-2 w-2 rounded-full ${participant.online ? "bg-green-500" : "bg-gray-400"}`} />
                </div>
              ))}
            </div>
          </div>
        </CardHeader>

        <Separator />

        {/* Participants Info */}
        <div className="p-3 bg-muted/30">
          <div className="flex flex-wrap gap-2">
            {selectedRoom.participants.map((participant) => (
              <div key={participant.id} className="flex items-center gap-2">
                {getRoleIcon(participant.role)}
                <span className="text-xs text-muted-foreground">{participant.name}</span>
                {getRoleBadge(participant.role)}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Messages Area */}
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.senderId === currentUser.id ? "flex-row-reverse" : "flex-row"}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{message.senderName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div
                    className={`flex flex-col gap-1 max-w-xs lg:max-w-md ${
                      message.senderId === currentUser.id ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{message.senderName}</span>
                      {getRoleBadge(message.senderRole)}
                      <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>
                    </div>
                    <div
                      className={`rounded-lg px-3 py-2 text-sm ${
                        message.senderId === currentUser.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </CardContent>

        <Separator />

        {/* Message Input */}
        <div className="p-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Escreva a sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
