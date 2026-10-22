import { createContext, useContext, useState, useEffect } from 'react';
import { subscribeConnectionStatus } from '../socket/index.js';

const ConnectionContext = createContext({ status: 'offline' });

export function ConnectionProvider({ children }) {
  const [status, setStatus] = useState(navigator.onLine ? 'reconnecting' : 'offline');

  useEffect(() => {
    const handleOnline = () => {
      setStatus('reconnecting');
    };
    const handleOffline = () => {
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = subscribeConnectionStatus((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  return (
    <ConnectionContext.Provider value={{ status }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  return useContext(ConnectionContext);
}
