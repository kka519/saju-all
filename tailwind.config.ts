import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1100px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Ollama palette aliases (see DESIGN.md)
        ink: "#000000",
        canvas: "#ffffff",
        "surface-soft": "#fafafa",
        "surface-dark": "#171717",
        charcoal: "#525252",
        body: "#737373",
        mute: "#a3a3a3",
        hairline: "#e5e5e5",
        "hairline-strong": "#d4d4d4",

        // 팔팔사주 별빛 밤 팔레트 (PRD §8.1 — 다크 + 별빛 포인트)
        "night-primary":   "rgb(var(--color-bg-primary) / <alpha-value>)",
        "night-secondary": "rgb(var(--color-bg-secondary) / <alpha-value>)",
        "night-elevated":  "rgb(var(--color-bg-elevated) / <alpha-value>)",
        "night-fg":        "rgb(var(--color-text-primary) / <alpha-value>)",
        "night-fg-soft":   "rgb(var(--color-text-secondary) / <alpha-value>)",
        "night-fg-muted":  "rgb(var(--color-text-muted) / <alpha-value>)",
        "night-border":    "rgb(var(--color-border-night) / <alpha-value>)",
        starlight:         "rgb(var(--color-accent) / <alpha-value>)",
        "starlight-soft":  "rgb(var(--color-accent-soft) / <alpha-value>)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
      },
      fontFamily: {
        sans: [
          "SF Pro Rounded",
          "-apple-system",
          "BlinkMacSystemFont",
          "ui-sans-serif",
          "system-ui",
          "Apple SD Gothic Neo",
          "Noto Sans KR",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
