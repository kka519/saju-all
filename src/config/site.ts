// =====================================================
// 사이트 메타 / 사업자 정보
// =====================================================

export const siteConfig = {
  name: "팔팔사주",
  tagline: "880원의 위로, 매일 만나는 두리",
  description: "직설적인 사주는 이제 그만. 13년 명리학 정확성에 두리의 따뜻한 해석을 더해, 오늘부터 마음 편하게 만나봐요.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "palpalsaju@gmail.com",
};

// 통신판매업 / 사업자 정보 — 법적 페이지 및 푸터에 노출됩니다.
export const businessInfo = {
  companyName: "케이에이치(KH)",
  representative: "최광훈",
  businessNumber: "284-27-00978",
  mailOrderNumber: "제2021-서울영등포-3100호",
  address: "서울시 영등포구 영등포로 109, 영등포유통상가 지하 1층 다열 6호",
  phone: "010-8077-9884",
  phoneNote: "문자만", // 비우면 푸터에서 부가표시 없이 노출
  email: "palpalsaju@gmail.com",
  privacyOfficer: "최광훈",
  // 호스팅 / 주요 처리 위탁 업체 — 개인정보처리방침에 노출
  hostingProvider: "Vercel Inc.",
  // 시행일 — 약관 / 개인정보처리방침 / 환불정책에 공통 노출
  effectiveDate: "2026-01-01",
};
