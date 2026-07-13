// =====================================================
// HTML → PDF 렌더링 (Puppeteer)
// =====================================================
// 로컬 개발: 번들 Chromium 포함된 puppeteer(devDependency) 사용.
// Vercel 프로덕션: puppeteer-core + @sparticuz/chromium-min (경량, 서버리스 대응).
// VERCEL 환경변수(Vercel이 자동 주입)로 분기 — 코드 한 곳에서 양쪽 다 지원.
//
// ⚠️ Vercel 실배포 검증 전(아직 Vercel 프로젝트 미생성) — 콜드스타트 시간/청크 URL
// 버전은 실제 배포 시 @sparticuz/chromium-min 최신 문서 기준으로 재확인 필요.
// 로컬에서는 puppeteer(full)로 렌더 로직 자체는 검증 가능.

import { PDFDocument } from "pdf-lib";

export type RenderPdfResult = {
  buffer: Buffer;
  pageCount: number;
};

// @sparticuz/chromium-min 은 chromium 바이너리를 이 URL에서 받아온다.
// 버전 호환성 주의 — chromium-min 버전과 브라우저 버전이 맞아야 함.
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

async function launchBrowser() {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (isServerless) {
    const [{ default: chromium }, puppeteerCore] = await Promise.all([
      import("@sparticuz/chromium-min"),
      import("puppeteer-core"),
    ]);
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    });
  }
  // 로컬 개발 — devDependency puppeteer(번들 Chromium).
  const puppeteer = await import("puppeteer");
  return puppeteer.launch({ headless: true });
}

export async function renderPdf(html: string): Promise<RenderPdfResult> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // 모든 리소스(폰트/차트)를 base64/inline SVG로 내장하므로 외부 네트워크 요청이 없음 —
    // "load" 로 충분 (networkidle0 은 최신 puppeteer 타입에서 setContent에 미지원).
    await page.setContent(html, { waitUntil: "load" });
    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
    const buffer = Buffer.from(pdfBytes);

    // 페이지수 검증 — DOM .page div 개수가 아니라 실제 렌더된 PDF 산출물 기준.
    const doc = await PDFDocument.load(buffer);
    const pageCount = doc.getPageCount();

    return { buffer, pageCount };
  } finally {
    await browser.close();
  }
}
