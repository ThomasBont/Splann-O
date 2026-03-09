import { cn } from "@/lib/utils";

type SplannOLogoProps = {
  className?: string;
  title?: string;
};

export function SplannOLogo({ className, title = "Splann-O" }: SplannOLogoProps) {
  return (
    <svg
      viewBox="0 0 232 58"
      role="img"
      aria-label={title}
      className={cn("h-auto w-[232px] max-w-full overflow-visible text-foreground", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <text
        x="0"
        y="45"
        fill="currentColor"
        fontFamily='ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        fontSize="54"
        fontWeight="650"
        letterSpacing="-2.2"
        lengthAdjust="spacingAndGlyphs"
        textLength="232"
      >
        <tspan>Splann-</tspan>
        <tspan dx="1.5" fill="hsl(var(--primary))" fontSize="61">O</tspan>
      </text>
    </svg>
  );
}
