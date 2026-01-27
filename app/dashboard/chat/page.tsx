import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ChatInterface } from "@/components/chat/chat-interface"

export default function ChatPage() {
  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)]">
        <ChatInterface />
      </div>
    </DashboardLayout>
  )
}
