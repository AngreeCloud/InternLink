export default function WaitingPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Aguarde aprovação</h1>
        <p className="text-muted-foreground">
          O seu registo foi submetido. Assim que um administrador aprovar a conta, poderá aceder à plataforma.
        </p>
      </div>
    </div>
  )
}

