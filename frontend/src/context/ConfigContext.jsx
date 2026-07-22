import React, { createContext, useContext, useState, useEffect } from 'react';
import { demoFetch } from '../api/demoFetch.js';

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    demoFetch('/api/config')
      .then((r) => r.json())
      .then((res) => {
        setConfig(res.data);
        setLoading(false);
      })
      .catch(() => {
        setConfig({ setupComplete: false });
        setLoading(false);
      });
  }, []);

  const completeSetup = (newConfig) => setConfig(newConfig);

  return (
    <ConfigContext.Provider value={{ config, loading, completeSetup }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}
