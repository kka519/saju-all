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
  concerns: string[];
  created_at: string;
};

type SajuResultRow = {
  id: string;
  order_id: string;
  myeongsik: Json;
  astrolabe?: Json | null;       // 0005 마이그레이션 — 그동안 타입에서 누락돼 있던 것 보완
  full_analysis?: Json | null;   // 0006 마이그레이션
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
          concerns?: string[];
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
