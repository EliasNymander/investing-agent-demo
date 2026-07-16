import { useState, useEffect, useRef } from 'react';

// Returns { label, staleness } where staleness = 'fresh' | 'warn' | 'stale'
// Updates every 30s so relative time stays current without hammering renders.
export function useLastUpdated(fetchedAt) {
  const [label, setLabel] = useState('Updated just now');
  const [staleness, setStaleness] = useState('fresh');
  const timerRef = useRef(null);

  useEffect(() => {
    if (!fetchedAt) return;

    function compute() {
      const ageMs  = Date.now() - fetchedAt;
      const ageSec = Math.floor(ageMs / 1000);
      const ageMin = Math.floor(ageSec / 60);
      const ageHr  = Math.floor(ageMin / 60);

      let text;
      if (ageSec < 10)       text = 'Updated just now';
      else if (ageSec < 60)  text = `Updated ${ageSec}s ago`;
      else if (ageMin < 60)  text = `Updated ${ageMin} min ago`;
      else if (ageHr < 24)   text = `Updated ${ageHr} hour${ageHr > 1 ? 's' : ''} ago`;
      else                    text = 'Updated over a day ago';

      const freshness =
        ageMin >= 120 ? 'stale' :
        ageMin >= 30  ? 'warn'  : 'fresh';

      setLabel(text);
      setStaleness(freshness);
    }

    compute();
    timerRef.current = setInterval(compute, 30_000);
    return () => clearInterval(timerRef.current);
  }, [fetchedAt]);

  return { label, staleness };
}
