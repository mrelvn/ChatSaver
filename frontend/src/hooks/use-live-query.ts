"use client";

import { liveQuery } from "dexie";
import { useEffect, useRef, useState, type DependencyList } from "react";

export function useLiveQuery<T>(
  query: () => Promise<T> | T,
  dependencies: DependencyList,
  initialValue: T,
): T {
  const previousDependencies = useRef<DependencyList | undefined>(undefined);
  const generation = useRef(0);
  const dependenciesChanged =
    previousDependencies.current === undefined
    || previousDependencies.current.length !== dependencies.length
    || dependencies.some((dependency, index) =>
      !Object.is(dependency, previousDependencies.current?.[index]),
    );
  if (dependenciesChanged) {
    previousDependencies.current = dependencies;
    generation.current += 1;
  }
  const currentGeneration = generation.current;
  const [result, setResult] = useState<{ generation: number; value: T }>({
    generation: currentGeneration,
    value: initialValue,
  });

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (value) => setResult({ generation: currentGeneration, value }),
      error: (error) => console.error("IndexedDB live query failed", error),
    });
    return () => subscription.unsubscribe();
    // The caller controls when the query is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return result.generation === currentGeneration ? result.value : initialValue;
}
