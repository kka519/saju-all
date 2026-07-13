// =====================================================
// LLM 응답 텍스트 → JSON object 추출 (공통 유틸)
// =====================================================
// src/app/api/saju/interpret/route.ts 의 extractAndParseJSON 패턴을 일반화.
// LLM이 코드블록 마커를 붙이거나 앞뒤 설명을 붙이는 케이스를 흡수.

export function extractJsonObject(text: string): unknown | null {
  // 1) 그대로 시도
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  // 2) ```json ... ``` 코드블록 안쪽 추출
  const codeFence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeFence?.[1]) {
    try {
      return JSON.parse(codeFence[1].trim());
    } catch {
      /* fall through */
    }
  }
  // 3) 가장 바깥 { ... } 영역 추출
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      /* fall through */
    }
  }
  return null;
}
