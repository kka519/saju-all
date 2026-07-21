// Supabase 스키마와 동기화된 타입. supabase gen types로 자동 생성하는 것을 권장하지만,
// 보일러플레이트 1차 빌드는 수동 정의로 시작합니다. 스키마 변경 시 함께 업데이트하세요.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatus = "pending" | "paid" | "failed";
export type CalendarKind = "solar" | "lunar";
export type GenderKind = "male" | "female";
export type ReportStatus = "pending" | "generating" | "done" | "failed"; // 0007 마이그레이션

type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  is_admin: boolean;
  // 0013 마이그레이션 — 로그인 사용자의 "내 생년월일" 저장(무료 운세 재입력 방지).
  birth_date: string | null;
  birth_time: string | null;
  time_unknown: boolean;
  gender: GenderKind | null;
  calendar: CalendarKind | null;
  is_leap_month: boolean;
  created_at: string;
};

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  original_price?: number | null; // 0007 마이그레이션
  badge_label?: string | null;    // 0007 마이그레이션
  value_line?: string | null;     // 0008 마이그레이션
  display_order: number;
  is_active: boolean;
  created_at: string;
};

type OrderRow = {
  id: string;
  order_id: string;
  user_id: string | null;
  guest_email: string | null;
  product_id: string;
  amount: number;
  status: OrderStatus;
  toss_payment_key: string | null;
  paid_at: string | null;
  created_at: string;
};

type SajuInputRow = {
  id: string;
  order_id: string;
  name: string | null;
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  gender: GenderKind;
  calendar: CalendarKind;
  is_leap_month: boolean; // 0011 마이그레이션
  concerns: string[];
  // 0010 마이그레이션 — couple-match 전용, 그 외 상품은 전부 null.
  partner_name?: string | null;
  partner_birth_date?: string | null;
  partner_birth_time?: string | null;
  partner_time_unknown?: boolean | null;
  partner_gender?: GenderKind | null;
  partner_calendar?: CalendarKind | null;
  partner_is_leap_month?: boolean | null; // 0011 마이그레이션
  created_at: string;
};

type SajuResultRow = {
  id: string;
  order_id: string;
  myeongsik: Json;
  astrolabe?: Json | null;       // 0005 마이그레이션 — 그동안 타입에서 누락돼 있던 것 보완
  full_analysis?: Json | null;   // 0006 마이그레이션
  today_fortune?: Json | null;   // 0009 마이그레이션 — today-fortune 6블록 구조화 결과
  partner_full_analysis?: Json | null; // 0010 마이그레이션 — couple-match 상대방 raw 분석
  partner_myeongsik?: Json | null;     // 0010 마이그레이션 — couple-match 상대방 명식
  interpretation_md: string;
  llm_provider: string;
  llm_model: string;
  created_at: string;
};

type ReviewRow = {
  id: string;
  user_id: string;
  order_id: string;
  product_id: string;
  rating: number;
  content: string;
  is_public: boolean;
  created_at: string;
};

type SajuApiCallRow = {
  id: string;
  called_at: string;
  success: boolean;
  source: string | null;
};

// 0007 마이그레이션
type LifeAnalystReportRow = {
  id: string;
  order_id: string;
  status: ReportStatus;
  stage: string | null;
  progress_pct: number;
  report_json: Json | null;
  sections_part1: Json | null;
  sections_part2: Json | null;
  sections_part3: Json | null;
  sections_part4: Json | null;
  pdf_path: string | null;
  pdf_page_count: number | null;
  attempt_count: number;
  error_message: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  created_at: string;
  updated_at: string;
};

// 0013 마이그레이션 — 무료 운세 하루 1회 제한 사용 기록.
// 0014 — 잠금 티저 실컨텐츠(sections) + LLM 호출 관측(attempt_count/provider/model) 추가.
type FreeFortuneUsageRow = {
  id: string;
  day: string;
  identity_key: string;
  ip: string | null;
  created_at: string;
  sections: Json | null;
  attempt_count: number | null;
  provider: string | null;
  model: string | null;
};

// 0012 마이그레이션 — "커플 궁합 리포트"(20페이지 PDF). life_analyst_reports 와 동일
// 계약(status/stage/progress_pct)이지만 파트가 5개(페이지맵 기준)라 별도 테이블.
type CoupleReportRow = {
  id: string;
  order_id: string;
  status: ReportStatus;
  stage: string | null;
  progress_pct: number;
  report_json: Json | null;
  sections_part1: Json | null;
  sections_part2: Json | null;
  sections_part3: Json | null;
  sections_part4: Json | null;
  sections_part5: Json | null;
  pdf_path: string | null;
  pdf_page_count: number | null;
  attempt_count: number;
  error_message: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          phone?: string | null;
          is_admin?: boolean;
          birth_date?: string | null;
          birth_time?: string | null;
          time_unknown?: boolean;
          gender?: GenderKind | null;
          calendar?: CalendarKind | null;
          is_leap_month?: boolean;
          created_at?: string;
        };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description: string;
          price: number;
          original_price?: number | null;
          badge_label?: string | null;
          value_line?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<ProductRow>;
        Relationships: [];
      };
      orders: {
        Row: OrderRow;
        Insert: {
          id?: string;
          order_id: string;
          user_id?: string | null;
          guest_email?: string | null;
          product_id: string;
          amount: number;
          status?: OrderStatus;
          toss_payment_key?: string | null;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: Partial<OrderRow>;
        Relationships: [];
      };
      saju_inputs: {
        Row: SajuInputRow;
        Insert: {
          id?: string;
          order_id: string;
          name?: string | null;
          birth_date: string;
          birth_time?: string | null;
          time_unknown?: boolean;
          gender: GenderKind;
          calendar?: CalendarKind;
          is_leap_month?: boolean; // 0011 마이그레이션
          concerns?: string[];
          partner_name?: string | null;
          partner_birth_date?: string | null;
          partner_birth_time?: string | null;
          partner_time_unknown?: boolean | null;
          partner_gender?: GenderKind | null;
          partner_calendar?: CalendarKind | null;
          partner_is_leap_month?: boolean | null; // 0011 마이그레이션
          created_at?: string;
        };
        Update: Partial<SajuInputRow>;
        Relationships: [];
      };
      saju_results: {
        Row: SajuResultRow;
        Insert: {
          id?: string;
          order_id: string;
          myeongsik: Json;
          astrolabe?: Json | null;       // 0005 마이그레이션
          full_analysis?: Json | null;   // 0006 마이그레이션
          today_fortune?: Json | null;   // 0009 마이그레이션
          partner_full_analysis?: Json | null; // 0010 마이그레이션
          partner_myeongsik?: Json | null;     // 0010 마이그레이션
          interpretation_md: string;
          llm_provider: string;
          llm_model: string;
          created_at?: string;
        };
        Update: Partial<SajuResultRow>;
        Relationships: [];
      };
      reviews: {
        Row: ReviewRow;
        Insert: {
          id?: string;
          user_id: string;
          order_id: string;
          product_id: string;
          rating: number;
          content: string;
          is_public?: boolean;
          created_at?: string;
        };
        Update: Partial<ReviewRow>;
        Relationships: [];
      };
      saju_api_calls: {
        Row: SajuApiCallRow;
        Insert: {
          id?: string;
          called_at?: string;
          success: boolean;
          source?: string | null;
        };
        Update: Partial<SajuApiCallRow>;
        Relationships: [];
      };
      life_analyst_reports: {
        Row: LifeAnalystReportRow;
        Insert: {
          id?: string;
          order_id: string;
          status?: ReportStatus;
          stage?: string | null;
          progress_pct?: number;
          report_json?: Json | null;
          sections_part1?: Json | null;
          sections_part2?: Json | null;
          sections_part3?: Json | null;
          sections_part4?: Json | null;
          pdf_path?: string | null;
          pdf_page_count?: number | null;
          attempt_count?: number;
          error_message?: string | null;
          llm_provider?: string | null;
          llm_model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<LifeAnalystReportRow>;
        Relationships: [];
      };
      couple_reports: {
        Row: CoupleReportRow;
        Insert: {
          id?: string;
          order_id: string;
          status?: ReportStatus;
          stage?: string | null;
          progress_pct?: number;
          report_json?: Json | null;
          sections_part1?: Json | null;
          sections_part2?: Json | null;
          sections_part3?: Json | null;
          sections_part4?: Json | null;
          sections_part5?: Json | null;
          pdf_path?: string | null;
          pdf_page_count?: number | null;
          attempt_count?: number;
          error_message?: string | null;
          llm_provider?: string | null;
          llm_model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<CoupleReportRow>;
        Relationships: [];
      };
      free_fortune_usage: {
        Row: FreeFortuneUsageRow;
        Insert: {
          id?: string;
          day: string;
          identity_key: string;
          ip?: string | null;
          created_at?: string;
          sections?: Json | null;
          attempt_count?: number | null;
          provider?: string | null;
          model?: string | null;
        };
        Update: Partial<FreeFortuneUsageRow>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      order_status: OrderStatus;
      calendar_kind: CalendarKind;
      gender_kind: GenderKind;
      report_status: ReportStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
