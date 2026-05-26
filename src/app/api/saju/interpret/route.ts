// =====================================================
// POST /api/saju/interpret
// =====================================================
// /demo (그리고 후속 결과 페이지)가 CSR에서 호출하는 결과지 엔드포인트.
// 내부: fetchSajuAnalysis → ganjiToMyeongsik + formatSajuToManseryeok
//       → buildSajuPrompt + JSON schema instruction append
//       → generateInterpretation → JSON parse (실패 시 폴백)
//
// 응답 5섹션 키: greeting / saju / coreReading / advice / closing (PRD §7.2)
// 두리 톤 에러 메시지 — 사용자 친화적, 디버그 메시지는 detail에.
// TODO: rate limiting (IP/sessionId) — 현재 미적용, 베타 진입 전 추가.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  fetchSajuAnalysis,
  formatSajuToManseryeok,
  ganjiToMyeongsik,
  isSajuApiConfigured,
  SajuApiError,
  type SimpleMyeongsik,
} from "@/lib/saju/saju-api";
import { buildSajuPrompt } from "@/lib/saju/prompt";
import { generateInterpretation } from "@/lib/saju/llm";

const birthInfoSchema = z.object({
  birthYear: z.string().regex(/^\d{4}$/, "birthYear 는 YYYY 형식"),
  birthMonth: z.string().regex(/^(0?[1-9]|1[0-2])$/, "birthMonth 는 1~12"),
  birthDay: z.string().regex(/^(0?[1-9]|[12]\d|3[01])$/, "birthDay 는 1~31"),
  birthHour: z.string().regex(/^(0?\d|1\d|2[0-3])$/, "birthHour 는 0~23").optional(),
  birthMinute: z.string().regex(/^(0?\d|[1-5]\d)$/, "birthMinute 는 0~59").optional(),
  calendarType: z.enum(["양력", "음력"]),
  gender: z.enum(["male", "female"]),
  isLeapMonth: z.boolean().optional(),
  useYajasiRule: z.boolean().optional(),
});

const bodySchema = z.object({
  birthInfo: birthInfoSchema,
  slug: z.string().min(1).optional().default("basic-saju"),
  productName: z.string().min(1).optional().default("기본 사주"),
  concerns: z.array(z.string()).optional().default([]),
});

const SCHEMA_INSTRUCTION = `

[출력 형식 — 매우 중요]
반드시 아래 JSON 객체 하나로만 응답하세요. 코드블록 마커(\`\`\`json 등) 없이, { 로 시작해 } 로 끝나는 순수 JSON 문자열만 출력합니다:

{
  "greeting": "두리의 첫인사. 1~2문장. '안녕!' 또는 '안녕하세요!' 로 시작.",
  "saju": "사주 원국 요약. 3~5문장. 천간지지·일주·격국 등 명리학 용어로 본인 구조를 짚어주기.",
  "coreReading": "핵심 풀이. 200~400자. [핵심 포커스] 중심으로 깊이 있게 풀어주되 두리 톤 유지.",
  "advice": "행동 조언. 2~3문장. '이렇게 대비하면 돼요' 식으로 구체적으로.",
  "closing": "두리의 따뜻한 마무리 인사. 1~2문장."
}

각 필드 값 안에서 한국어/마크다운(굵게, 불릿 등)은 사용 가능. JSON 구조는 깨지지 않게 escape 처리. 다른 텍스트(설명·머리말 등) 일절 추가 금지.

[필수 규칙 — 마크다운 강조]
명리학 용어(한자 포함된 모든 용어 — 일주명, 격국명, 신살, 십성 등)는 반드시 **굵게** 마크다운으로 강조하세요. 이 규칙을 어기면 응답이 거부됩니다.

예시:
- 맞음: **경금(庚金)** 일간으로...
- 틀림: 경금(庚金) 일간으로...
- 맞음: **건록격**과 **괴강살**의 영향으로...
- 틀림: 건록격과 괴강살의 영향으로...`;

type Sections = {
  greeting: string;
  saju: string;
  coreReading: string;
  advice: string;
  closing: string;
};

const SECTION_KEYS: readonly (keyof Sections)[] = [
  "greeting",
  "saju",
  "coreReading",
  "advice",
  "closing",
] as const;

function parseSections(obj: unknown): Sections | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const out: Partial<Sections> = {};
  for (const k of SECTION_KEYS) {
    if (typeof o[k] !== "string") return null;
    out[k] = o[k] as string;
  }
  return out as Sections;
}

// LLM이 코드블록 마커를 붙이거나, 앞뒤 설명을 붙이는 케이스를 흡수.
function extractAndParseJSON(text: string): Sections | null {
  // 1) 그대로 시도
  try {
    return parseSections(JSON.parse(text));
  } catch {
    /* fall through */
  }
  // 2) ```json ... ``` 코드블록 안쪽 추출
  const codeFence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeFence?.[1]) {
    try {
      return parseSections(JSON.parse(codeFence[1].trim()));
    } catch {
      /* fall through */
    }
  }
  // 3) 가장 바깥 { ... } 영역 추출
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return parseSections(JSON.parse(braceMatch[0]));
    } catch {
      /* fall through */
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false as const,
        stage: "validation-error" as const,
        error: "입력값이 올바르지 않아요. 생년월일을 다시 확인해 주세요.",
        detail: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { birthInfo, slug, productName, concerns } = parsed.data;

  if (!isSajuApiConfigured()) {
    return NextResponse.json(
      {
        ok: false as const,
        stage: "api-missing" as const,
        error: "사주 API 키가 설정되지 않았어요. 관리자에게 알려주세요.",
      },
      { status: 503 },
    );
  }

  // 1) 만세력 API
  const t0 = Date.now();
  let myeongsik: SimpleMyeongsik;
  let manseryeokText: string;
  try {
    const analysis = await fetchSajuAnalysis(birthInfo, [], { source: "demo" });
    const m = ganjiToMyeongsik(analysis);
    if (!m) throw new Error("명식 변환에 필요한 ganji 데이터를 받지 못했습니다.");
    myeongsik = m;
    manseryeokText = formatSajuToManseryeok(analysis, birthInfo);
  } catch (err) {
    const upstream = err instanceof SajuApiError ? err.status : undefined;
    return NextResponse.json(
      {
        ok: false as const,
        stage: "api-error" as const,
        error: "두리가 만세력을 펼치다 길을 잃었어요. 잠시 후 다시 시도해 주세요.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: upstream && upstream >= 400 && upstream < 600 ? upstream : 502 },
    );
  }
  const elapsedApi = Date.now() - t0;

  // 2) LLM
  const { system, user } = buildSajuPrompt({
    productSlug: slug,
    productName,
    myeongsik,
    manseryeokText,
    birthDate: `${birthInfo.birthYear}-${birthInfo.birthMonth.padStart(2, "0")}-${birthInfo.birthDay.padStart(2, "0")}`,
    birthTime: birthInfo.birthHour
      ? `${birthInfo.birthHour.padStart(2, "0")}:${(birthInfo.birthMinute ?? "00").padStart(2, "0")}`
      : null,
    timeUnknown: !birthInfo.birthHour,
    gender: birthInfo.gender,
    concerns,
  });
  const userWithSchema = user + SCHEMA_INSTRUCTION;

  const t1 = Date.now();
  let llm: Awaited<ReturnType<typeof generateInterpretation>>;
  try {
    llm = await generateInterpretation({ system, user: userWithSchema });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false as const,
        stage: "llm-error" as const,
        error: "별빛이 흐려져서 풀이를 짜기 어려웠어요. 한 번만 더 부탁드려요.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
  const elapsedLlm = Date.now() - t1;

  // 3) JSON 파싱 (실패 시 폴백)
  const sections = extractAndParseJSON(llm.text);
  if (sections) {
    return NextResponse.json({
      ok: true as const,
      sections,
      myeongsik,
      meta: {
        provider: llm.provider,
        model: llm.model,
        elapsedApi,
        elapsedLlm,
      },
    });
  }

  // 폴백 — JSON 깨졌어도 사용자에겐 raw text를 coreReading에라도 노출
  return NextResponse.json({
    ok: true as const,
    sections: {
      greeting: "",
      saju: "",
      coreReading: llm.text,
      advice: "",
      closing: "",
    },
    myeongsik,
    meta: {
      provider: llm.provider,
      model: llm.model,
      elapsedApi,
      elapsedLlm,
      parseError: true,
    },
  });
}
