// =====================================================
// 커플 궁합 리포트 — Handlebars 템플릿 컴파일 + 렌더
// =====================================================
// render-html.ts(인생 리포트)와 동일 패턴 — couple-report.hbs 전용.

import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { join } from "path";
import { getFontFaceCss } from "@/lib/report/template/font-face";

let compiledTemplate: HandlebarsTemplateDelegate | null = null;

// report.hbs와 동일한 헬퍼 등록 — 두 템플릿이 별개 Handlebars 인스턴스를 공유하므로
// registerHelper는 멱등(같은 이름 재등록 시 마지막 등록이 유효)하지만 안전하게 재선언.
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper("gte", (a: number, b: number) => a >= b);
Handlebars.registerHelper("md", (text: unknown) => {
  if (typeof text !== "string") return "";
  const escaped = Handlebars.escapeExpression(text);
  const html = escaped.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  return new Handlebars.SafeString(html);
});

function getTemplate(): HandlebarsTemplateDelegate {
  if (compiledTemplate) return compiledTemplate;
  const source = readFileSync(join(process.cwd(), "src/lib/report/couple/couple-report.hbs"), "utf-8");
  compiledTemplate = Handlebars.compile(source, { noEscape: false });
  return compiledTemplate;
}

export function renderCoupleReportHtml(context: Record<string, unknown>): string {
  const template = getTemplate();
  return template({ ...context, fontFaceCss: new Handlebars.SafeString(getFontFaceCss()) });
}
