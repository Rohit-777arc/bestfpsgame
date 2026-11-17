import { useEffect, useState } from "react";
import { getProgress, subscribeProgress, type Progress } from "@/game/progress";

/** Live player progress. "loading" until the browser reads it. */
export function useProgress(): Progress {
  const [p, setP] = useState<Progress>(() => ({ ...getProgress(), kind: "loading" }));
  useEffect(() => {
    setP(getProgress());
    return subscribeProgress(setP);
  }, []);
  return p;
}
