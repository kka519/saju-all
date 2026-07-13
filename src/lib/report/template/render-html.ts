// =====================================================
// Handlebars 템플릿 컴파일 + 렌더
// =====================================================

import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { join } from "path";

let compiledTemplate: HandlebarsTemplateDelegate | null = null;
let fontFaceCss: string | null = null;

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

/**
 * 폰트 3종을 base64 data URI @font-face 로 임베드.
 * - 로컬 macOS 는 시스템 한글 폰트가 있어 없어도 보였지만, Vercel 서버리스 Chromium 은
 *   한글 폰트가 전혀 없어 미임베드 시 전부 깨짐(tofu) — 프로덕션 필수.
 * - 레퍼런스 PDF 의 명조체 헤드라인(NotoSerifKR)도 이 임베드로 재현.
 * 모듈 레벨 캐시 — 프로세스당 1회만 읽음.
 */
function getFontFaceCss(): string {
  if (fontFaceCss) return fontFaceCss;
  const fontsDir = join(process.cwd(), "src/lib/report/template/fonts");
  const load = (file: string) => readFileSync(join(fontsDir, file)).toString("base64");
  fontFaceCss = `
@font-face { font-family:'NotoKR'; src:url(data:font/otf;base64,${load("NotoSansKR-Regular.otf")}) format('opentype'); font-weight:normal; }
@font-face { font-family:'NotoKR'; src:url(data:font/otf;base64,${load("NotoSansKR-Bold.otf")}) format('opentype'); font-weight:bold; }
@font-face { font-family:'NotoSerifKR'; src:url(data:font/otf;base64,${load("NotoSerifKR-Bold.otf")}) format('opentype'); font-weight:bold; }
`;
  return fontFaceCss;
}

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
