// =====================================================
// Handlebars 템플릿 컴파일 + 렌더
// =====================================================

import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { join } from "path";
import { getFontFaceCss } from "./font-face";

let compiledTemplate: HandlebarsTemplateDelegate | null = null;

// 등호(===) 비교 헬퍼 — 신살 category 등 조건부 렌더에 사용.
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper("gte", (a: number, b: number) => a >= b);

// LLM 텍스트용 마크다운 헬퍼 — HTML 이스케이프 후 **볼드** → <b>, 줄바꿈 → <br>.
// 레퍼런스 PDF 대조에서 **가 리터럴로 노출되던 버그의 수정. LLM 이 만든 문자열은
// 신뢰 불가 입력이므로 반드시 이스케이프를 먼저 하고 마크업 변환을 나중에 한다.
Handlebars.registerHelper("md", (text: unknown) => {
  if (typeof text !== "string") return "";
  const escaped = Handlebars.escapeExpression(text);
  const html = escaped
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\n/g, "<br>");
  return new Handlebars.SafeString(html);
});

function getTemplate(): HandlebarsTemplateDelegate {
  if (compiledTemplate) return compiledTemplate;
  const source = readFileSync(join(process.cwd(), "src/lib/report/template/report.hbs"), "utf-8");
  compiledTemplate = Handlebars.compile(source, { noEscape: false });
  return compiledTemplate;
}

export function renderReportHtml(context: Record<string, unknown>): string {
  const template = getTemplate();
  return template({ ...context, fontFaceCss: new Handlebars.SafeString(getFontFaceCss()) });
}
