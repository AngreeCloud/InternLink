import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

type Props = {
  title: string
  description: string
  icon: LucideIcon
}

export function ComingSoonTab({ title, description, icon: Icon }: Props) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-full bg-muted p-3 text-muted-foreground">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-balance">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground text-pretty">{description}</p>
      </CardContent>
    </Card>
  )
}
