import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Path,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

// ── Palette ─────────────────────────────────────────────
const TEAL = "#01696f";
const DARK = "#1c1b19";
const MUTED = "#7a7974";
const BEGE = "#f3f0ec";
const WHITE = "#ffffff";
const GREEN_BG = "#e8f5f0";
const BORDER = "#dcd9d5";
const MARGIN = 40;
const PAGE_W = 595.28;

const SVG_LOGO_PATHS = [
  { d: "M22 10L12 4 2 10l10 6 10-6Z" },
  { d: "M6 12v5c3 2 9 2 12 0v-5" },
  { d: "M22 10v6" },
];

// ── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    padding: MARGIN,
    fontFamily: "Helvetica",
    color: DARK,
    fontSize: 10,
    lineHeight: 1.4,
  },
  topBar: {
    backgroundColor: TEAL,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  brandName: {
    color: WHITE,
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 1.5,
  },
  tealLine: {
    height: 2,
    backgroundColor: TEAL,
    marginVertical: 12,
    width: 100,
  },
  coverTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: TEAL,
    lineHeight: 1.3,
  },
  label: {
    fontSize: 7,
    fontWeight: "bold",
    color: TEAL,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
    marginTop: 14,
  },
  value: {
    fontSize: 11,
    fontWeight: "bold",
    color: DARK,
    marginBottom: 4,
  },
  infoTable: {
    marginTop: 14,
  },
  infoRow: {
    flexDirection: "row",
    minHeight: 24,
  },
  infoLabel: {
    width: 100,
    backgroundColor: BEGE,
    padding: "6 10",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: WHITE,
  },
  infoLabelText: {
    fontSize: 8,
    fontWeight: "bold",
    color: DARK,
  },
  infoValue: {
    flex: 1,
    padding: "6 12",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  infoValueText: {
    fontSize: 10,
    color: DARK,
  },
  periodBox: {
    backgroundColor: BEGE,
    padding: "10 14",
    marginTop: 16,
    borderRadius: 3,
  },
  periodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  periodLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: TEAL,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  periodValue: {
    fontSize: 10,
    color: DARK,
  },
  weekHeader: {
    backgroundColor: TEAL,
    paddingTop: 8,
    paddingRight: 14,
    paddingBottom: 8,
    paddingLeft: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 3,
    marginBottom: 12,
  },
  weekTitle: {
    color: WHITE,
    fontSize: 13,
    fontWeight: "bold",
    flexShrink: 0,
  },
  weekDates: {
    color: "#ffffffcc",
    fontSize: 10,
    flexShrink: 1,
    textAlign: "right",
  },
  contentBlock: {
    backgroundColor: BEGE,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    padding: "10 14",
    marginBottom: 10,
  },
  contentText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: DARK,
  },
  contentLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: TEAL,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
    marginTop: 12,
  },
  validationBadge: {
    backgroundColor: GREEN_BG,
    borderRadius: 3,
    padding: "8 12",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  validationIcon: {
    color: TEAL,
    fontSize: 9,
    fontWeight: "bold",
  },
  validationText: {
    color: TEAL,
    fontSize: 9,
  },
  declaration: {
    fontSize: 10,
    lineHeight: 1.6,
    color: DARK,
    marginTop: 14,
    marginBottom: 24,
  },
  sigBlockContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sigBlock: {
    width: 210,
  },
  sigLine: {
    height: 1,
    backgroundColor: TEAL,
    marginBottom: 6,
    width: "100%",
  },
  sigName: {
    fontSize: 10,
    fontWeight: "bold",
    color: DARK,
    marginBottom: 2,
  },
  sigRole: {
    fontSize: 8,
    color: MUTED,
  },
  sigCompany: {
    fontSize: 7,
    color: MUTED,
  },
  sigImage: {
    width: 120,
    height: 50,
    marginBottom: 6,
    objectFit: "contain",
  },
  sigPlaceholder: {
    height: 50,
    marginBottom: 6,
  },
  generatedAt: {
    fontSize: 8,
    color: MUTED,
    marginTop: 24,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: MARGIN,
    width: PAGE_W - 2 * MARGIN,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 4,
    overflow: "hidden",
  },
  footerText: {
    fontSize: 7,
    color: MUTED,
  },
  footerPage: {
    fontSize: 7,
    color: MUTED,
  },
});

// ── Logo SVG Component ─────────────────────────────────
const LogoSvg = ({ size = 28, color = WHITE }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {SVG_LOGO_PATHS.map((p, i) => (
      <Path key={i} d={p.d} fill="none" stroke={color} strokeWidth={2} />
    ))}
  </Svg>
);

// ── Footer Component ────────────────────────────────────
const Footer = ({
  alunoName,
  label = "Registo de Sumarios",
}: {
  alunoName: string;
  label?: string;
}) => (
  <View fixed style={styles.footer}>
    <Text style={styles.footerText}>
      InternLink - {label} - {alunoName}
    </Text>
    <Text
      style={styles.footerPage}
      render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `Pagina ${pageNumber} de ${totalPages}`
      }
    />
  </View>
);

// ── Top Bar ─────────────────────────────────────────────
const TopBar = () => (
  <View style={styles.topBar}>
    <LogoSvg size={28} color={WHITE} />
    <Text style={styles.brandName}>InternLink</Text>
  </View>
);

// ── Cover Page ──────────────────────────────────────────
const CoverPage = ({
  alunoName,
  tutorName,
  professorName,
  empresa,
  courseName,
  periodoInicio,
  periodofim,
  totalSemanas,
  generatedAt,
}: {
  alunoName: string;
  tutorName: string;
  professorName: string;
  empresa: string;
  courseName: string;
  periodoInicio: string;
  periodofim: string;
  totalSemanas: number;
  generatedAt: string;
}) => (
  <Page size="A4" style={styles.page}>
    <TopBar />

    <Text style={styles.coverTitle}>
      REGISTO DE SUMARIOS{`\n`}SEMANAIS DA FCT
    </Text>
    <View style={styles.tealLine} />

    {courseName && courseName !== "-" && (
      <>
        <Text style={styles.label}>Curso</Text>
        <Text style={styles.value}>{courseName}</Text>
      </>
    )}

    <View style={styles.infoTable}>
      {[
        { label: "Formando", value: alunoName },
        { label: "Tutor", value: tutorName },
        { label: "Orientador", value: professorName },
        { label: "Empresa", value: empresa },
      ].map((row, i) => (
        <View key={i} style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Text style={styles.infoLabelText}>{row.label}</Text>
          </View>
          <View style={styles.infoValue}>
            <Text style={styles.infoValueText}>{row.value}</Text>
          </View>
        </View>
      ))}
    </View>

    <View style={styles.periodBox}>
      <View style={styles.periodRow}>
        <Text style={styles.periodLabel}>Periodo</Text>
        <Text style={styles.periodValue}>
          {periodoInicio} - {periodofim}
        </Text>
      </View>
      <View
        style={{ height: 1, backgroundColor: BORDER, marginVertical: 6 }}
      />
      <View style={styles.periodRow}>
        <Text style={styles.periodLabel}>Semanas</Text>
        <Text style={styles.periodValue}>
          {totalSemanas} semana{totalSemanas !== 1 ? "s" : ""} de trabalho
        </Text>
      </View>
    </View>

    <Text
      style={[
        styles.generatedAt,
        { position: "absolute", bottom: 60, left: MARGIN },
      ]}
    >
      Gerado em: {generatedAt}
    </Text>

    <Footer alunoName={alunoName} label="Registo de Sumarios" />
  </Page>
);

// ── Sumario Page ────────────────────────────────────────
const SumarioPage = ({
  sumario,
  alunoName,
}: {
  sumario: {
    weekNumber: number;
    weekYear: number;
    weekStart: string;
    weekEnd: string;
    content: string;
    signedByTutor?: boolean;
    tutorSignedByName?: string;
    tutorSignedAt?: string;
  };
  alunoName: string;
}) => (
  <Page size="A4" style={styles.page}>
    <View style={styles.weekHeader}>
      <Text style={styles.weekTitle}>
        SEMANA {sumario.weekNumber} - {sumario.weekYear}
      </Text>
      <Text style={styles.weekDates}>
        {sumario.weekStart} - {sumario.weekEnd}
      </Text>
    </View>

    <Text style={styles.contentLabel}>
      Atividades realizadas durante a semana
    </Text>
    <View style={styles.contentBlock}>
      <Text style={styles.contentText}>
        {sumario.content || "(sem conteudo)"}
      </Text>
    </View>

    {sumario.signedByTutor && (
      <View style={styles.validationBadge}>
        <Text style={styles.validationIcon}>{">"}</Text>
        <Text style={styles.validationText}>
          Validado pelo tutor: {sumario.tutorSignedByName || "Tutor"}
          {sumario.tutorSignedAt ? ` - ${sumario.tutorSignedAt}` : ""}
        </Text>
      </View>
    )}

    <Footer alunoName={alunoName} label="Registo de Sumarios" />
  </Page>
);

// ── Signatures Page ─────────────────────────────────────
const SignaturesPage = ({
  alunoName,
  tutorName,
  tutorRole,
  empresa,
  includeSignatures,
  alunoSignatureDataUrl,
  tutorSignatureDataUrl,
  generatedAt,
}: {
  alunoName: string;
  tutorName: string;
  tutorRole: string;
  empresa: string;
  includeSignatures: boolean;
  alunoSignatureDataUrl?: string;
  tutorSignatureDataUrl?: string;
  generatedAt: string;
}) => (
  <Page size="A4" style={styles.page}>
    <TopBar />

    <Text
      style={{ fontSize: 18, fontWeight: "bold", color: TEAL, lineHeight: 1.3 }}
    >
      DECLARACAO DE CONCLUSAO DA FCT
    </Text>
    <View style={styles.tealLine} />

    <Text style={styles.declaration}>
      Os abaixo assinados declaram que os sumarios semanais registados neste
      documento sao fidedignos e representam o trabalho efetivamente realizado
      durante o periodo de formacao em contexto de trabalho.
    </Text>

    <View style={styles.sigBlockContainer}>
      <View style={styles.sigBlock}>
        {includeSignatures && alunoSignatureDataUrl ? (
          <Image src={alunoSignatureDataUrl} style={styles.sigImage} />
        ) : (
          <View style={styles.sigPlaceholder} />
        )}
        <View style={styles.sigLine} />
        <Text style={styles.sigName}>{alunoName}</Text>
        <Text style={styles.sigRole}>Formando</Text>
      </View>
      <View style={styles.sigBlock}>
        {includeSignatures && tutorSignatureDataUrl ? (
          <Image src={tutorSignatureDataUrl} style={styles.sigImage} />
        ) : (
          <View style={styles.sigPlaceholder} />
        )}
        <View style={styles.sigLine} />
        <Text style={styles.sigName}>{tutorName}</Text>
        <Text style={styles.sigRole}>{tutorRole}</Text>
        <Text style={styles.sigCompany}>{empresa}</Text>
      </View>
    </View>

    <Text style={styles.generatedAt}>
      Documento gerado pela plataforma InternLink em {generatedAt}
    </Text>

    <Footer alunoName={alunoName} label="Registo de Sumarios" />
  </Page>
);

// ── Root Document ───────────────────────────────────────
type SumarioData = {
  weekId: string;
  weekNumber: number;
  weekYear: number;
  weekStart: string;
  weekEnd: string;
  content: string;
  signedByTutor?: boolean;
  tutorSignedByName?: string;
  tutorSignedAt?: string;
  estado?: string;
};

type CoverData = {
  alunoName: string;
  tutorName: string;
  professorName: string;
  empresa: string;
  courseName: string;
  periodoInicio: string;
  periodofim: string;
  totalSemanas: number;
  generatedAt: string;
  tutorRole?: string;
};

const SumariosPDF = ({
  coverData,
  sumarios,
  includeSignatures,
  alunoSignatureDataUrl,
  tutorSignatureDataUrl,
}: {
  coverData: CoverData;
  sumarios: SumarioData[];
  includeSignatures: boolean;
  alunoSignatureDataUrl?: string;
  tutorSignatureDataUrl?: string;
}) => (
  <Document>
    <CoverPage {...coverData} />
    {sumarios.map((s, i) => (
      <SumarioPage
        key={s.weekId}
        sumario={s}
        alunoName={coverData.alunoName}
      />
    ))}
    <SignaturesPage
      alunoName={coverData.alunoName}
      tutorName={coverData.tutorName}
      tutorRole={coverData.tutorRole || "Tutor de Estagio"}
      empresa={coverData.empresa}
      includeSignatures={includeSignatures}
      alunoSignatureDataUrl={alunoSignatureDataUrl}
      tutorSignatureDataUrl={tutorSignatureDataUrl}
      generatedAt={coverData.generatedAt}
    />
  </Document>
);

// ── Public API ──────────────────────────────────────────
export async function renderSumariosExportPDF(params: {
  coverData: CoverData;
  sumarios: SumarioData[];
  includeSignatures: boolean;
  alunoSignatureBytes?: Uint8Array;
  tutorSignatureBytes?: Uint8Array;
}): Promise<Uint8Array> {
  const toDataUrl = (bytes?: Uint8Array): string | undefined => {
    if (!bytes || bytes.length === 0) return undefined;
    const b64 = Buffer.from(bytes).toString("base64");
    return `data:image/png;base64,${b64}`;
  };

  return renderToBuffer(
    <SumariosPDF
      coverData={params.coverData}
      sumarios={params.sumarios}
      includeSignatures={params.includeSignatures}
      alunoSignatureDataUrl={toDataUrl(params.alunoSignatureBytes)}
      tutorSignatureDataUrl={toDataUrl(params.tutorSignatureBytes)}
    />
  );
}
