"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { canGoBack, trackBackHistory } from "@/lib/back-history";

export function BackHistory() {
  useEffect(() => trackBackHistory(), []);
  return null;
}

export default function BackLink({ fallback = "/", className, onBack }: {
  fallback?: string;
  className?: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  return <Link href={fallback} className={className} onClick={(event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    onBack?.();
    if (canGoBack()) {
      event.preventDefault();
      router.back();
    }
  }}><span aria-hidden="true">← </span>Back</Link>;
}
