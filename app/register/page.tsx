import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Que tipo de utilizador és tu?</CardTitle>
          <CardDescription className="text-center">
            Escolhe o perfil que melhor se adequa a ti para começares.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col space-y-4">
          <Button asChild size="lg">
            <Link href="/register/aluno">Aluno</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/register/professor">Professor / Representante da Escola</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/register/tutor">Tutor da Empresa</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

