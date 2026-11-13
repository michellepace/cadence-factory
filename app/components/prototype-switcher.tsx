// PROTOTYPE — throwaway. Floating bottom bar that cycles `?variant=`.
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PrototypeVariant {
  key: string;
  name: string;
}

export function usePrototypeVariant(variants: PrototypeVariant[]) {
  const [searchParams] = useSearchParams();
  const key = searchParams.get("variant") ?? variants[0].key;
  return variants.find((v) => v.key === key) ?? variants[0];
}

export function PrototypeSwitcher({
  variants,
  children,
}: {
  variants: PrototypeVariant[];
  children?: React.ReactNode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = usePrototypeVariant(variants);
  const index = variants.indexOf(current);

  function go(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length];
    const params = new URLSearchParams(searchParams);
    params.set("variant", next.key);
    setSearchParams(params, { replace: true, preventScrollReset: true });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full bg-fuchsia-700 px-2 py-1.5 text-sm text-white shadow-xl ring-2 ring-fuchsia-300">
      <button
        onClick={() => go(-1)}
        className="rounded-full p-1 hover:bg-white/20"
        title="Previous variant (←)"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-48 text-center font-medium">
        {current.key} ({current.name})
      </span>
      <button
        onClick={() => go(1)}
        className="rounded-full p-1 hover:bg-white/20"
        title="Next variant (→)"
      >
        <ChevronRight className="size-4" />
      </button>
      {children && (
        <div className="ml-1 flex items-center gap-1 border-l border-white/30 pl-2">
          {children}
        </div>
      )}
    </div>
  );
}
