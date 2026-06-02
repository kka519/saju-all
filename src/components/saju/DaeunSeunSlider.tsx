"use client";

// =====================================================
// 5-B.2b — 대운 · 연운 가로 슬라이드
// =====================================================
// 명식 카드 아래에 배치. 각 칸: 상단 나이/연도+십성, 중단 천간·지지 (오행 틴트), 하단 12운성.
// 현재 칸(isCurrent)은 starlight ring 강조 (명식 일주와 같은 톤).
//
// 슬라이딩 전략 (사용자 결정):
//   - 전체 항목 렌더 (slice/clamp X) — 흐름 전체 보존
//   - 가로 overflow-x-auto, 사용자가 좌우 드래그/스크롤로 윈도우 이동
//   - 초기 진입 시 현재 칸을 scroller 가운데로 자동 정렬 (scrollLeft 만, 세로 영향 0)
//   - 정렬은 첫 페인트 후 — requestAnimationFrame 으로 한 번 감싸 offsetLeft 확정 보장
//   - daeun isCurrent 0개(범위 밖 나이) → index 0 fallback. seun 은 항상 currentSeun 0번.
//
// 오행 틴트 (캐시 안전성 핵심):
//   - 명식 카드와 100% 동일 Tailwind 클래스 (`bg-oheng-{색}/45`, `border-oheng-{색}/50`) 재사용.
//   - 새 알파 변형 도입 0 — 명식 렌더 때 이미 Tailwind 가 생성한 utility 만 참조 (캐시 안전).
//   - 런타임 문자열 보간 금지. 풀스트링 Record 에 박음 (Tailwind JIT 정적 인식).
//
// mock 폴백:
//   - daeun/seun 빈 배열이면 해당 섹션 자리에 "데이터 준비 중" placeholder.
//   - 둘 다 빈 경우(/dev/saju mock) 두 placeholder 노출, 레이아웃 깨지지 않음.

import { useEffect, useRef } from "react";
import type { MyeongsikViewModel } from "@/lib/saju/build-myeongsik-view";
import type { Oheng } from "@/lib/saju/derived";

// 명식 카드와 동일 Tailwind 클래스 — 풀스트링 Record (JIT 정적 인식).
const OHENG_TINT: Record<Oheng, string> = {
  목: "bg-oheng-mok/45",
  화: "bg-oheng-hwa/45",
  토: "bg-oheng-to/45",
  금: "bg-oheng-geum/45",
  수: "bg-oheng-su/45",
};

const OHENG_BORDER: Record<Oheng, string> = {
  목: "border-oheng-mok/50",
  화: "border-oheng-hwa/50",
  토: "border-oheng-to/50",
  금: "border-oheng-geum/50",
  수: "border-oheng-su/50",
};

// element 필드 타입은 string|undefined (응답·정규화 양쪽 호환). 런타임은 Oheng|undefined.
function isOheng(s: string | undefined): s is Oheng {
  return s === "목" || s === "화" || s === "토" || s === "금" || s === "수";
}

// ─────────────────────────────────────────────────────
// 천간/지지 미니 카드 (오행 틴트)
// ─────────────────────────────────────────────────────

function GanjiBlock({
  ch,
  hanja,
  element,
}: {
  ch: string;
  hanja?: string;
  element?: string;
}) {
  const oh = isOheng(element) ? element : undefined;
  const tint = oh ? OHENG_TINT[oh] : "";
  const borderCls = oh
    ? `border ${OHENG_BORDER[oh]}`
    : "border border-night-border/30";
  return (
    <div className={`py-1 rounded ${tint} ${borderCls}`}>
      <span className="text-lg font-semibold text-night-fg leading-none">
        {ch}
        {hanja && (
          <sup className="ml-0.5 text-[10px] font-normal text-night-fg-muted">
            {hanja}
          </sup>
        )}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// 단일 칸 — 대운/연운 공통 카드
// ─────────────────────────────────────────────────────

type RunCardProps = {
  top: string;            // 나이(age_start) 또는 연도(year)
  sipseong?: string;      // 천간 십성 (예: "편재"). undefined 시 "—"
  ganChar: string;        // 천간 한글 1자
  ganHanja?: string;      // 천간 한자
  ganElement?: string;    // 천간 오행
  jiChar: string;         // 지지 한글 1자
  jiHanja?: string;       // 지지 한자
  jiElement?: string;     // 지지 오행
  fortune?: string;       // 12운성 라벨
  isCurrent: boolean;     // 현재 칸 — starlight ring
};

const RunCard = ({
  card,
  refCb,
}: {
  card: RunCardProps;
  refCb: ((el: HTMLDivElement | null) => void) | undefined;
}) => {
  const ring = card.isCurrent ? "ring-2 ring-inset ring-starlight/60" : "";
  return (
    <div
      ref={refCb}
      className={`shrink-0 w-24 rounded-md border border-night-border bg-night-secondary p-2 ${ring}`}
    >
      <div className="text-center">
        <div className="text-sm font-semibold text-night-fg leading-tight">
          {card.top}
        </div>
        <div className="text-[10px] text-night-fg-muted mb-2">
          {card.sipseong ?? "—"}
        </div>
        <div className="space-y-1">
          <GanjiBlock ch={card.ganChar} hanja={card.ganHanja} element={card.ganElement} />
          <GanjiBlock ch={card.jiChar} hanja={card.jiHanja} element={card.jiElement} />
        </div>
        <div className="mt-2 text-[11px] text-night-fg-soft">
          {card.fortune ?? "—"}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────
// 슬라이더 섹션 (대운 / 연운 공통)
// ─────────────────────────────────────────────────────

function SliderSection({
  title,
  items,
  currentIdx,
  scrollerRef,
}: {
  title: string;
  items: RunCardProps[];
  currentIdx: number; // 가운데 정렬 대상 (-1 이면 정렬 안 함)
  scrollerRef: React.RefObject<HTMLDivElement | null>;
}) {
  // ── 드래그-투-스크롤 (마우스/트랙패드 클릭드래그) ──
  // pointer 기반이라 mouse + pen 모두 커버. touch 는 네이티브 swipe 우선 → skip.
  // 상태는 useRef 로 보관 (드래그 중 rerender 방지).
  const dragState = useRef<{
    isDragging: boolean;
    startX: number;
    startScrollLeft: number;
  }>({ isDragging: false, startX: 0, startScrollLeft: 0 });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return; // 모바일 네이티브 스와이프에 양보
    const scroller = scrollerRef.current;
    if (!scroller) return;
    dragState.current.isDragging = true;
    dragState.current.startX = e.clientX;
    dragState.current.startScrollLeft = scroller.scrollLeft;
    try {
      scroller.setPointerCapture(e.pointerId);
    } catch {
      // 일부 브라우저 pointer capture 실패 — 무시 (드래그는 동작)
    }
    scroller.style.cursor = "grabbing";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.isDragging) return;
    if (e.pointerType === "touch") return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const dx = e.clientX - dragState.current.startX;
    scroller.scrollLeft = dragState.current.startScrollLeft - dx;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.isDragging) return;
    dragState.current.isDragging = false;
    const scroller = scrollerRef.current;
    if (scroller) {
      try {
        scroller.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      scroller.style.cursor = "";
    }
  };

  // ── 세로 휠 → 가로 스크롤 변환 ──
  // React 의 onWheel 은 passive listener 라 preventDefault 가 무시될 수 있음.
  // ref + addEventListener 로 { passive: false } 명시 등록.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        scroller.scrollLeft += e.deltaY;
      }
    };
    scroller.addEventListener("wheel", handleWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", handleWheel);
  }, [scrollerRef]);

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-night-fg">{title}</h3>
        <p className="text-[10px] text-night-fg-muted">← 밀어서 더 보기</p>
      </div>
      {/*
        스크롤러: overflow-x-auto + min-w-0 (방어용 — flex 부모 가능성 대비).
        내부 flex: min-w-max — flex 컨테이너 폭을 콘텐츠 합산(intrinsic)으로 강제.
        이 없으면 flex 컨테이너가 block 자식으로서 부모 폭(스크롤러 폭)에 고정 →
        카드 overflow 가 flex 컨테이너 내부에서만 발생하고 스크롤러는 overflow 인식 못함.
        min-w-max 로 flex 컨테이너 폭 = 카드 합산 → 스크롤러 자식 overflow 정상 감지.

        select-none + cursor-grab — 드래그 중 텍스트 선택 차단 + 드래그 가능 시각 신호.
      */}
      <div
        ref={scrollerRef}
        className="overflow-x-auto min-w-0 select-none cursor-grab"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <div className="flex gap-2 pb-1 min-w-max">
          {items.map((card, i) => (
            <RunCard
              key={i}
              card={card}
              refCb={i === currentIdx ? (el) => attachCenterTarget(scrollerRef, el) : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// scroller 의 현재 칸 ref 를 따로 보관하지 않고, refCb 에서 scroller 의 data-* 에 기록.
// (useRef 2개 + cross-section 동기화 보다 단순 — 페인트 후 일괄 정렬은 본체 useEffect.)
function attachCenterTarget(
  scrollerRef: React.RefObject<HTMLDivElement | null>,
  el: HTMLDivElement | null,
) {
  if (scrollerRef.current && el) {
    scrollerRef.current.dataset.centerLeft = String(el.offsetLeft);
    scrollerRef.current.dataset.centerWidth = String(el.offsetWidth);
  }
}

// ─────────────────────────────────────────────────────
// Placeholder
// ─────────────────────────────────────────────────────

function SectionPlaceholder({ title }: { title: string }) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 text-sm font-semibold text-night-fg">{title}</h3>
      <div className="rounded-lg border border-night-border bg-night-secondary py-6 text-center text-xs text-night-fg-muted">
        데이터 준비 중
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────
// 본체
// ─────────────────────────────────────────────────────

export function DaeunSeunSlider({ view }: { view: MyeongsikViewModel }) {
  const daeunScroller = useRef<HTMLDivElement | null>(null);
  const seunScroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 첫 페인트 후 offsetLeft 확정 보장 — requestAnimationFrame 1 tick.
    // scrollLeft 만 조작, 세로 viewport 영향 0.
    const center = (scroller: HTMLDivElement | null) => {
      if (!scroller) return;
      const left = Number(scroller.dataset.centerLeft);
      const width = Number(scroller.dataset.centerWidth);
      if (!Number.isFinite(left) || !Number.isFinite(width)) return;
      scroller.scrollLeft = left - scroller.clientWidth / 2 + width / 2;
    };
    const raf = requestAnimationFrame(() => {
      center(daeunScroller.current);
      center(seunScroller.current);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const daeun = view.daeun ?? [];
  const seun = view.seun ?? [];

  // 대운 카드 매핑 — daeun isCurrent 없으면 index 0 fallback (사용자 결정)
  const daeunHasCurrent = daeun.some((d) => d.isCurrent === true);
  const daeunCards: RunCardProps[] = daeun.map((d) => ({
    top: String(d.age_start),
    sipseong: d.sipseong?.gan,
    ganChar: d.ganji[0] ?? "",
    ganHanja: d.ganji_hanja?.[0],
    ganElement: d.ganElement,
    jiChar: d.ganji[1] ?? "",
    jiHanja: d.ganji_hanja?.[1],
    jiElement: d.jiElement,
    fortune: d.twelveFortune?.fortune,
    isCurrent: d.isCurrent === true,
  }));
  const daeunCurrentIdx = daeunHasCurrent
    ? daeunCards.findIndex((c) => c.isCurrent)
    : daeunCards.length > 0
      ? 0
      : -1;

  // 연운 카드 매핑 — seun.gan/ji 별개 필드 사용 (raw 응답 그대로)
  const seunCards: RunCardProps[] = seun.map((s) => ({
    top: String(s.year),
    sipseong: s.sipseong?.gan,
    ganChar: s.gan,
    ganHanja: s.ganji_hanja?.[0],
    ganElement: s.ganElement,
    jiChar: s.ji,
    jiHanja: s.ganji_hanja?.[1],
    jiElement: s.jiElement,
    fortune: s.twelveFortune?.fortune,
    isCurrent: s.isCurrent === true,
  }));
  const seunCurrentIdx = seunCards.findIndex((c) => c.isCurrent);

  return (
    <div>
      {daeunCards.length > 0 ? (
        <SliderSection
          title="대운 · 10년 흐름"
          items={daeunCards}
          currentIdx={daeunCurrentIdx}
          scrollerRef={daeunScroller}
        />
      ) : (
        <SectionPlaceholder title="대운 · 10년 흐름" />
      )}
      {seunCards.length > 0 ? (
        <SliderSection
          title="연운 · 해마다"
          items={seunCards}
          currentIdx={seunCurrentIdx}
          scrollerRef={seunScroller}
        />
      ) : (
        <SectionPlaceholder title="연운 · 해마다" />
      )}
      <p className="mt-2 text-center text-[11px] text-night-fg-muted">
        테두리 표시 = 지금 지나는 운 ✨
      </p>
    </div>
  );
}
