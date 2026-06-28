"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, AlertCircle } from "lucide-react";

type LandingSection = {
  id: string;
  title?: string;
  items?: { title: string; description: string }[];
  heroTitle?: string;
  heroSubtitle?: string;
  heroDescription?: string;
  question?: string;
  answer?: string;
  name?: string;
  role?: string;
  text?: string;
};

const SECTIONS = [
  { id: "hero", label: "Hero", fields: ["heroTitle", "heroSubtitle", "heroDescription", "heroCtaPrimary", "heroCtaSecondary"] },
  { id: "audience", label: "Para quem é", fields: [] },
  { id: "features", label: "Funcionalidades", fields: [] },
  { id: "steps", label: "Como funciona", fields: [] },
  { id: "faqs", label: "FAQ", fields: [] },
  { id: "testimonials", label: "Testemunhos", fields: [] },
  { id: "cta", label: "CTA", fields: ["ctaTitle", "ctaSubtitle", "ctaDescription"] },
  { id: "footer", label: "Footer", fields: ["footerDescription", "footerEmail"] },
];

export default function LandingPage() {
  const [content, setContent] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/super-admin/landing")
      .then((res) => res.json())
      .then((data: { content?: Record<string, Record<string, unknown>> }) => setContent(data.content || {}))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (sectionId: string, data: Record<string, unknown>) => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/super-admin/landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, data }),
      });
      if (!res.ok) throw new Error("Falha ao gravar.");
      setSaveMsg(`Secção "${sectionId}" gravada.`);
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gravar.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (sectionId: string, field: string, value: string) => {
    setContent((prev) => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] || {}), [field]: value },
    }));
  };

  const updateItemField = (sectionId: string, index: number, field: string, value: string) => {
    setContent((prev) => {
      const section = { ...(prev[sectionId] || {}) };
      const items = Array.isArray(section.items) ? [...section.items] : [];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, [sectionId]: { ...section, items } };
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Landing Page</h1>
          <p className="text-sm text-muted-foreground">Editar conteúdo da página inicial.</p>
        </div>
        {saveMsg && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" /> {saveMsg}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <Tabs defaultValue="hero">
        <TabsList className="flex-wrap">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>
          ))}
        </TabsList>

        {/* Hero */}
        <TabsContent value="hero" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Hero Section</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Hero Title</Label>
                <Input value={(content.hero?.heroTitle as string) || ""} onChange={(e) => updateField("hero", "heroTitle", e.target.value)} />
              </div>
              <div>
                <Label>Hero Subtitle</Label>
                <Input value={(content.hero?.heroSubtitle as string) || ""} onChange={(e) => updateField("hero", "heroSubtitle", e.target.value)} />
              </div>
              <div>
                <Label>Hero Description</Label>
                <Textarea value={(content.hero?.heroDescription as string) || ""} onChange={(e) => updateField("hero", "heroDescription", e.target.value)} rows={3} />
              </div>
              <div>
                <Label>CTA Primary text</Label>
                <Input value={(content.hero?.heroCtaPrimary as string) || ""} onChange={(e) => updateField("hero", "heroCtaPrimary", e.target.value)} />
              </div>
              <div>
                <Label>CTA Secondary text</Label>
                <Input value={(content.hero?.heroCtaSecondary as string) || ""} onChange={(e) => updateField("hero", "heroCtaSecondary", e.target.value)} />
              </div>
              <Button onClick={() => handleSave("hero", content.hero || {})} disabled={saving}>Gravar Hero</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* List sections (audience, features, steps) */}
        {["audience", "features", "steps"].map((sectionId) => {
          const section = content[sectionId] || {};
          const items = (Array.isArray(section.items) ? section.items : []) as { title: string; description: string }[];
          return (
            <TabsContent key={sectionId} value={sectionId} className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base capitalize">{sectionId}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map((item, i) => (
                    <div key={i} className="space-y-2 rounded-md border p-3">
                      <Label>Item {i + 1} - Título</Label>
                      <Input value={item.title || ""} onChange={(e) => updateItemField(sectionId, i, "title", e.target.value)} />
                      <Label>Item {i + 1} - Descrição</Label>
                      <Textarea value={item.description || ""} onChange={(e) => updateItemField(sectionId, i, "description", e.target.value)} rows={2} />
                    </div>
                  ))}
                  <Button onClick={() => handleSave(sectionId, { items })} disabled={saving}>Gravar {sectionId}</Button>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}

        {/* FAQs */}
        <TabsContent value="faqs" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Perguntas Frequentes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {((Array.isArray(content.faqs?.items) ? content.faqs.items : []) as { question: string; answer: string }[]).map((item, i) => (
                <div key={i} className="space-y-2 rounded-md border p-3">
                  <Label>Pergunta {i + 1}</Label>
                  <Input value={item.question || ""} onChange={(e) => updateItemField("faqs", i, "question", e.target.value)} />
                  <Label>Resposta {i + 1}</Label>
                  <Textarea value={item.answer || ""} onChange={(e) => updateItemField("faqs", i, "answer", e.target.value)} rows={2} />
                </div>
              ))}
              <Button onClick={() => handleSave("faqs", content.faqs || {})} disabled={saving}>Gravar FAQ</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Testimonials */}
        <TabsContent value="testimonials" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Testemunhos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {((Array.isArray(content.testimonials?.items) ? content.testimonials.items : []) as { name: string; role: string; text: string }[]).map((item, i) => (
                <div key={i} className="space-y-2 rounded-md border p-3">
                  <Label>Nome {i + 1}</Label>
                  <Input value={item.name || ""} onChange={(e) => updateItemField("testimonials", i, "name", e.target.value)} />
                  <Label>Cargo {i + 1}</Label>
                  <Input value={item.role || ""} onChange={(e) => updateItemField("testimonials", i, "role", e.target.value)} />
                  <Label>Texto {i + 1}</Label>
                  <Textarea value={item.text || ""} onChange={(e) => updateItemField("testimonials", i, "text", e.target.value)} rows={3} />
                </div>
              ))}
              <Button onClick={() => handleSave("testimonials", content.testimonials || {})} disabled={saving}>Gravar Testemunhos</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CTA */}
        <TabsContent value="cta" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Call to Action</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>CTA Title</Label>
                <Input value={(content.cta?.ctaTitle as string) || ""} onChange={(e) => updateField("cta", "ctaTitle", e.target.value)} />
              </div>
              <div>
                <Label>CTA Subtitle</Label>
                <Input value={(content.cta?.ctaSubtitle as string) || ""} onChange={(e) => updateField("cta", "ctaSubtitle", e.target.value)} />
              </div>
              <div>
                <Label>CTA Description</Label>
                <Textarea value={(content.cta?.ctaDescription as string) || ""} onChange={(e) => updateField("cta", "ctaDescription", e.target.value)} rows={2} />
              </div>
              <Button onClick={() => handleSave("cta", content.cta || {})} disabled={saving}>Gravar CTA</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Footer */}
        <TabsContent value="footer" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Footer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Footer Description</Label>
                <Textarea value={(content.footer?.footerDescription as string) || ""} onChange={(e) => updateField("footer", "footerDescription", e.target.value)} rows={3} />
              </div>
              <div>
                <Label>Support Email</Label>
                <Input value={(content.footer?.footerEmail as string) || ""} onChange={(e) => updateField("footer", "footerEmail", e.target.value)} />
              </div>
              <Button onClick={() => handleSave("footer", content.footer || {})} disabled={saving}>Gravar Footer</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
