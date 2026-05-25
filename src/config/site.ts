// =====================================================
// 사이트 메타 / 사업자 정보
// =====================================================
// 운영 전 본인 정보로 반드시 교체하세요. 아래는 모두 더미 데이터입니다.

export const siteConfig = {
  name: "팔팔사주",
  tagline: "880원의 위로, 매일 만나는 두리",
  description: "직설적인 사주는 이제 그만. 13년 명리학 정확성에 두리의 따뜻한 해석을 더해, 오늘부터 마음 편하게 만나봐요.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "support@example.com",
};

// 통신판매업 / 사업자 정보 — 법적 페이지 및 푸터에 노출됩니다.
// ※ 아래 값은 모두 더미입니다. 운영 전 본인 사업자 정보로 반드시 교체하세요.
export const businessInfo = {
  companyName: "(예시) 회사명",
  representative: "(예시) 홍길동",
  businessNumber: "000-00-00000",
  mailOrderNumber: "0000-지역-0000",
  address: "(예시) 서울특별시 OO구 OO로 OO, OO호",
  phone: "010-0000-0000",
  phoneNote: "문자만", // 비우면 푸터에서 부가표시 없이 노출
  email: "support@example.com",
  privacyOfficer: "(예시) 홍길동",
  // 호스팅 / 주요 처리 위탁 업체 — 개인정보처리방침에 노출
  hostingProvider: "Vercel Inc.",
  // 시행일 — 약관 / 개인정보처리방침 / 환불정책에 공통 노출
  effectiveDate: "2026-01-01",
};
