// =====================================================
// 리포트 PDF 공용 한글 폰트 @font-face 임베드
// =====================================================
// 인생 애널리스트 리포트(report.hbs)와 커플 궁합 리포트가 공유 — Vercel 서버리스
// Chromium 은 한글 폰트가 전혀 없어 base64 임베드 없이는 전부 깨진다(tofu).
// 모듈 레벨 캐시 — 프로세스당 1회만 읽음.

import { readFileSync } from "fs";
import { join } from "path";

let fontFaceCss: string | null = null;

export function getFontFaceCss(): string {
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
