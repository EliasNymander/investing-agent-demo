import React, { createContext, useContext } from 'react';
import { useLastUpdated } from './useLastUpdated.js';

const TimestampContext = createContext(null);

export function TimestampProvider({ fetchedAt, children }) {
  const value = useLastUpdated(fetchedAt);
  return <TimestampContext.Provider value={value}>{children}</TimestampContext.Provider>;
}

export function useTimestamp() {
  return useContext(TimestampContext);
}
