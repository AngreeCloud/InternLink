"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPin, Phone } from "lucide-react";

type SchoolProfile = {
  name: string;
  shortName: string;
  address: string;
  contact: string;
  bannerUrl: string;
  profileImageUrl: string;
};

export function SchoolProfileCard({
  schoolId,
  title = "Escola",
  description,
}: {
  schoolId: string;
  title?: string;
  description?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<SchoolProfile | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!schoolId) {
        if (active) {
          setSchool(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const db = await getDbRuntime();
        const snap = await getDoc(doc(db, "schools", schoolId));

        if (!active) return;

        if (!snap.exists()) {
          setSchool(null);
          return;
        }

        const data = snap.data() as {
          name?: string;
          shortName?: string;
          address?: string;
          contact?: string;
          bannerUrl?: string;
          profileImageUrl?: string;
        };

        setSchool({
          name: data.name || "Escola",
          shortName: data.shortName || "",
          address: data.address || "",
          contact: data.contact || "",
          bannerUrl: data.bannerUrl || "",
          profileImageUrl: data.profileImageUrl || "",
        });
      } catch {
        if (active) {
          setSchool(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [schoolId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">A carregar perfil da escola...</CardContent>
      </Card>
    );
  }

  if (!school) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      {school.bannerUrl ? (
        <div className="h-32 w-full bg-muted">
          <img src={school.bannerUrl} alt={`Banner de ${school.name}`} className="h-full w-full object-cover" />
        </div>
      ) : null}

      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {school.profileImageUrl ? (
            <img
              src={school.profileImageUrl}
              alt={`Imagem de ${school.name}`}
              className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Building2 className="h-5 w-5" />
            </div>
          )}
          <div>
            <p>{title}</p>
            <p className="text-sm font-normal text-muted-foreground">
              {school.name}
              {school.shortName ? ` (${school.shortName})` : ""}
            </p>
          </div>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>

      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {school.address ? (
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {school.address}
          </p>
        ) : null}
        {school.contact ? (
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            {school.contact}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
