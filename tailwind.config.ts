import type { Config } from "tailwindcss";
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))", "card-foreground": "hsl(var(--card-foreground))",
        muted: "hsl(var(--muted))", "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))", input: "hsl(var(--input))", ring: "hsl(var(--ring))",
        primary: "hsl(var(--primary))", "primary-foreground": "hsl(var(--primary-foreground))",
        accent: "hsl(var(--accent))", "accent-foreground": "hsl(var(--accent-foreground))",
      },
      fontFamily: { sans: ["var(--font-sans)", "Inter", "sans-serif"], display: ["var(--font-display)", "Inter", "sans-serif"] },
      boxShadow: { soft: "0 2px 8px rgba(18,32,56,.035), 0 16px 40px rgba(18,32,56,.035)", lift: "0 8px 34px rgba(18,32,56,.10)" },
    },
  },
  plugins: [],
} satisfies Config;
