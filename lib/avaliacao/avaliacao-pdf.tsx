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
import type { AvaliacaoConfig, SignatureData } from "./types";

const TEAL = "#01696f";
const DARK = "#1c1b19";
const MUTED = "#7a7974";
const BEGE = "#f3f0ec";
const WHITE = "#ffffff";
const BORDER = "#dcd9d5";
const MARGIN = 40;
const PAGE_W = 595.28;

const SVG_LOGO_PATHS = [
  { d: "M22 10L12 4 2 10l10 6 10-6Z" },
  { d: "M6 12v5c3 2 9 2 12 0v-5" },
  { d: "M22 10v6" },
];

const pdfStyles = StyleSheet.create({
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
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: TEAL,
    lineHeight: 1.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 16,
  },
  tealLine: {
    height: 2,
    backgroundColor: TEAL,
    marginVertical: 12,
    width: 100,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: TEAL,
    marginTop: 16,
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    minHeight: 22,
  },
  infoLabel: {
    width: 90,
    backgroundColor: BEGE,
    padding: "4 8",
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
    padding: "4 10",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  infoValueText: {
    fontSize: 10,
    color: DARK,
  },
  paramTable: {
    marginTop: 10,
  },
  paramHeader: {
    flexDirection: "row",
    backgroundColor: TEAL,
    padding: "8 10",
  },
  paramHeaderText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: "bold",
  },
  paramRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  paramCell: {
    padding: "6 10",
    justifyContent: "center",
  },
  paramCellText: {
    fontSize: 10,
    color: DARK,
  },
  finalGradeBox: {
    backgroundColor: BEGE,
    padding: 12,
    marginTop: 16,
    borderRadius: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  finalGradeLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: TEAL,
  },
  finalGradeValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: DARK,
  },
  sigBlock: {
    width: 210,
    marginTop: 16,
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
    marginTop: 20,
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

const LogoSvg = ({
  size = 28,
  color = WHITE,
}: {
  size?: number;
  color?: string;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {SVG_LOGO_PATHS.map((p, i) => (
      <Path
        key={i}
        d={p.d}
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
    ))}
  </Svg>
);

const Footer = ({
  label,
  alunoName,
}: {
  label: string;
  alunoName: string;
}) => (
  <View fixed style={pdfStyles.footer}>
    <Text style={pdfStyles.footerText}>
      InternLink - {label} - {alunoName}
    </Text>
    <Text
      style={pdfStyles.footerPage}
      render={({
        pageNumber,
        totalPages,
      }: {
        pageNumber: number;
        totalPages: number;
      }) => `Página ${pageNumber} de ${totalPages}`}
    />
  </View>
);

const TopBar = () => (
  <View style={pdfStyles.topBar}>
    <LogoSvg size={28} color={WHITE} />
    <Text style={pdfStyles.brandName}>InternLink</Text>
  </View>
);

const SignatureBlock = ({
  signature,
  name,
  role,
  includeSignatures,
}: {
  signature?: SignatureData;
  name: string;
  role: string;
  includeSignatures: boolean;
}) => (
  <View style={pdfStyles.sigBlock}>
    {includeSignatures && signature?.signatureDataUrl ? (
      <Image src={signature.signatureDataUrl} style={pdfStyles.sigImage} />
    ) : (
      <View style={pdfStyles.sigPlaceholder} />
    )}
    <View style={pdfStyles.sigLine} />
    <Text style={pdfStyles.sigName}>{name}</Text>
    <Text style={pdfStyles.sigRole}>{role}</Text>
  </View>
);

export type AvaliacaoPDFData = {
  alunoName: string;
  tutorName: string;
  professorName: string;
  empresa: string;
  courseName: string;
  config: AvaliacaoConfig;
  parametros: Record<string, number>;
  assinaturaTutor?: SignatureData;
  assinaturaProfessor?: SignatureData;
  notaFinal?: number;
  generatedAt: string;
};

const AvaliacaoTutorPDF = ({
  data,
  includeSignatures,
}: {
  data: AvaliacaoPDFData;
  includeSignatures: boolean;
}) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <TopBar />

      <Text style={pdfStyles.title}>FICHA DE AVALIAÇÃO DO ESTÁGIO</Text>
      <Text style={pdfStyles.subtitle}>
        Preenchida pelo tutor da entidade de acolhimento
      </Text>
      <View style={pdfStyles.tealLine} />

      {/* Info */}
      {[
        { label: "Formando", value: data.alunoName },
        { label: "Tutor", value: data.tutorName },
        { label: "Orientador", value: data.professorName },
        { label: "Empresa", value: data.empresa },
        { label: "Curso", value: data.courseName },
      ].map((row, i) => (
        <View key={i} style={pdfStyles.infoRow}>
          <View style={pdfStyles.infoLabel}>
            <Text style={pdfStyles.infoLabelText}>{row.label}</Text>
          </View>
          <View style={pdfStyles.infoValue}>
            <Text style={pdfStyles.infoValueText}>{row.value}</Text>
          </View>
        </View>
      ))}

      {/* Parameters */}
      <Text style={pdfStyles.sectionTitle}>
        Parâmetros de Avaliação (escala {data.config.escala.min}-
        {data.config.escala.max})
      </Text>

      <View style={pdfStyles.paramTable}>
        <View style={pdfStyles.paramHeader}>
          <View style={{ flex: 1 }}>
            <Text style={pdfStyles.paramHeaderText}>Parâmetro</Text>
          </View>
          <View style={{ width: 60, alignItems: "flex-end" }}>
            <Text style={pdfStyles.paramHeaderText}>Nota</Text>
          </View>
        </View>
        {data.config.parametros.map((param, i) => (
          <View
            key={i}
            style={[
              pdfStyles.paramRow,
              i % 2 === 0
                ? { backgroundColor: BEGE }
                : {},
            ]}
          >
            <View style={[pdfStyles.paramCell, { flex: 1 }]}>
              <Text style={pdfStyles.paramCellText}>
                {param.nome}
              </Text>
            </View>
            <View
              style={[
                pdfStyles.paramCell,
                { width: 60, alignItems: "flex-end" },
              ]}
            >
              <Text style={pdfStyles.paramCellText}>
                {data.parametros[param.nome] ?? "-"}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Signatures */}
      <Text style={pdfStyles.sectionTitle}>Assinaturas</Text>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <SignatureBlock
          signature={data.assinaturaTutor}
          name={data.tutorName}
          role="Tutor de Estágio"
          includeSignatures={includeSignatures}
        />
        <SignatureBlock
          signature={data.assinaturaProfessor}
          name={data.professorName}
          role="Professor Orientador"
          includeSignatures={includeSignatures}
        />
      </View>

      <Text style={pdfStyles.generatedAt}>
        Documento gerado pela plataforma InternLink em{" "}
        {data.generatedAt}
      </Text>

      <Footer label="Ficha de Avaliação" alunoName={data.alunoName} />
    </Page>
  </Document>
);

const NotaFinalPDF = ({
  data,
  includeSignatures,
}: {
  data: AvaliacaoPDFData;
  includeSignatures: boolean;
}) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <TopBar />

      <Text style={pdfStyles.title}>
        NOTA FINAL DO ESTÁGIO
      </Text>
      <Text style={pdfStyles.subtitle}>
        Avaliação final com nota atribuída pelo professor orientador
      </Text>
      <View style={pdfStyles.tealLine} />

      {/* Info */}
      {[
        { label: "Formando", value: data.alunoName },
        { label: "Tutor", value: data.tutorName },
        { label: "Orientador", value: data.professorName },
        { label: "Empresa", value: data.empresa },
        { label: "Curso", value: data.courseName },
      ].map((row, i) => (
        <View key={i} style={pdfStyles.infoRow}>
          <View style={pdfStyles.infoLabel}>
            <Text style={pdfStyles.infoLabelText}>{row.label}</Text>
          </View>
          <View style={pdfStyles.infoValue}>
            <Text style={pdfStyles.infoValueText}>{row.value}</Text>
          </View>
        </View>
      ))}

      {/* Final grade */}
      <View style={pdfStyles.finalGradeBox}>
        <Text style={pdfStyles.finalGradeLabel}>Nota Final</Text>
        <Text style={pdfStyles.finalGradeValue}>
          {data.notaFinal ?? "-"} /{" "}
          {data.config.notaFinalEsperada.max}{" "}
          <Text style={{ fontSize: 10, color: MUTED }}>
            valores
          </Text>
        </Text>
      </View>

      {/* Parameters */}
      <Text style={pdfStyles.sectionTitle}>
        Parâmetros de Avaliação (escala {data.config.escala.min}-
        {data.config.escala.max})
      </Text>

      <View style={pdfStyles.paramTable}>
        <View style={pdfStyles.paramHeader}>
          <View style={{ flex: 1 }}>
            <Text style={pdfStyles.paramHeaderText}>Parâmetro</Text>
          </View>
          <View style={{ width: 60, alignItems: "flex-end" }}>
            <Text style={pdfStyles.paramHeaderText}>Nota</Text>
          </View>
        </View>
        {data.config.parametros.map((param, i) => (
          <View
            key={i}
            style={[
              pdfStyles.paramRow,
              i % 2 === 0
                ? { backgroundColor: BEGE }
                : {},
            ]}
          >
            <View style={[pdfStyles.paramCell, { flex: 1 }]}>
              <Text style={pdfStyles.paramCellText}>
                {param.nome}
              </Text>
            </View>
            <View
              style={[
                pdfStyles.paramCell,
                { width: 60, alignItems: "flex-end" },
              ]}
            >
              <Text style={pdfStyles.paramCellText}>
                {data.parametros[param.nome] ?? "-"}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Signatures */}
      <Text style={pdfStyles.sectionTitle}>Assinaturas</Text>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <SignatureBlock
          signature={data.assinaturaTutor}
          name={data.tutorName}
          role="Tutor de Estágio"
          includeSignatures={includeSignatures}
        />
        <SignatureBlock
          signature={data.assinaturaProfessor}
          name={data.professorName}
          role="Professor Orientador"
          includeSignatures={includeSignatures}
        />
      </View>

      <Text style={pdfStyles.generatedAt}>
        Documento gerado pela plataforma InternLink em{" "}
        {data.generatedAt}
      </Text>

      <Footer label="Nota Final" alunoName={data.alunoName} />
    </Page>
  </Document>
);

export async function renderAvaliacaoTutorPDF(
  data: AvaliacaoPDFData,
  includeSignatures: boolean
): Promise<Uint8Array> {
  return renderToBuffer(
    <AvaliacaoTutorPDF
      data={data}
      includeSignatures={includeSignatures}
    />
  );
}

export async function renderNotaFinalPDF(
  data: AvaliacaoPDFData,
  includeSignatures: boolean
): Promise<Uint8Array> {
  return renderToBuffer(
    <NotaFinalPDF
      data={data}
      includeSignatures={includeSignatures}
    />
  );
}
