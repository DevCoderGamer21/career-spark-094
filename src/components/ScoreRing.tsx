interface Props {
  score: number;
  size?: number;
  label?: string;
}

export function ScoreRing({ score, size = 160, label }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const tone =
    clamped >= 80 ? "text-success" : clamped >= 60 ? "text-primary" : clamped >= 40 ? "text-warning" : "text-destructive";
  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-muted)"
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={tone + " transition-all duration-700"}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={"text-4xl font-display font-bold " + tone}>{clamped}</span>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label ?? "ATS Score"}</span>
      </div>
    </div>
  );
}
