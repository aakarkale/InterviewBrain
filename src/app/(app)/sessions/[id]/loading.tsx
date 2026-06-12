import { Skeleton } from "@/components/ui/skeleton";

// Tailored to the interview layout (back link, title, chat panel, composer) so
// the route doesn't flash the generic dashboard card skeleton.
export default function SessionLoading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-4 w-24" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
      <Skeleton className="h-[clamp(420px,60vh,680px)] w-full rounded-xl" />
      <div className="flex items-end gap-2">
        <Skeleton className="h-12 flex-1 rounded-md" />
        <Skeleton className="size-9 rounded-md" />
      </div>
    </div>
  );
}
