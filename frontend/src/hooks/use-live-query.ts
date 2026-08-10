"use client";

import { liveQuery } from "dexie";
import { useEffect, useState, type DependencyList } from "react";

export function useLiveQuery<T>(
  query: () => Promise<T> | T,
  dependencies: DependencyList,
  initialValue: T,
): T {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: setValue,
      error: (error) => console.error("IndexedDB live query failed", error),
    });
    return () => subscription.unsubscribe();
    // The caller controls when the query is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return value;
}

