import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <Link
        href="/"
        className="font-display text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
      >
        InterviewBrain
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
