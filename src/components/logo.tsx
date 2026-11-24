import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm",
        className
      )}
      aria-hidden="true"
    >
      <CheckCheck className="size-[58%]" strokeWidth={2.5} />
    </div>
  );
}
