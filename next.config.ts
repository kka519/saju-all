import { fileURLToPath } from "node:url";
import path from "node:path";
import type { NextConfig } from "next";

// next.config.ts 는 ESM 으로 로드됨 (export default). ESM 컨텍스트엔 __dirname 이
// 없으므로 import.meta.url → fileURLToPath → dirname 표준 패턴으로 프로젝트 루트 산출.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  reactStrictMode: true,
  // 워크스페이스 root 고정 — 홈의 외톨이 lockfile (~/package-lock.json 등) 영향 차단.
  // 미설정 시 Next 가 lockfile 탐색으로 root 추론 → ~/ 까지 traversal → file tracing/
  // watch 경계 오인 → webpack module manifest 부패 (HMR 캐시 GC 폭증) 가능.
  // 본 옵션으로 tracing/watch 범위를 프로젝트 폴더로 한정.
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default config;
