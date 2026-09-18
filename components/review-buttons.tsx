import type { ReviewRating } from "@/types/progress";
import { cn } from "@/lib/utils";

const ratings: { value: ReviewRating; label: string; en: string; key: string; hint: string; className: string }[] = [
  { value: "again", label: "忘记", en: "Again", key: "1", hint: "约 1 分钟", className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" },
  { value: "hard", label: "困难", en: "Hard", key: "2", hint: "约 6 分钟", className: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
  { value: "good", label: "记住", en: "Good", key: "3", hint: "约 10 分钟", className: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" },
  { value: "easy", label: "很熟", en: "Easy", key: "4", hint: "约 8 天", className: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" }
];

export function ReviewButtons({ onRate, disabled = false }: { onRate: (rating: ReviewRating) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ratings.map((rating) => (
        <button
          key={rating.value}
          type="button"
          disabled={disabled}
          onClick={() => onRate(rating.value)}
          className={cn("rounded-xl border px-3 py-3 text-left transition-colors disabled:opacity-50", rating.className)}
        >
          <span className="flex items-center justify-between text-sm font-bold"><span>{rating.label}<span className="ml-1 text-[11px] font-medium opacity-60">{rating.en}</span></span><kbd className="rounded border border-current/20 px-1.5 py-0.5 text-[11px] opacity-60">{rating.key}</kbd></span>
          <span className="mt-1 block text-xs opacity-70">{rating.hint}</span>
        </button>
      ))}
    </div>
  );
}
