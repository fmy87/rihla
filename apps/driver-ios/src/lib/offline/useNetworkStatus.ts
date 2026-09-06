import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * `isConnected` reflects the device's own network reachability (NetInfo).
 * This is a proxy for "can reach Supabase" — good enough for UI purposes —
 * not a guarantee; actual sync calls still handle their own failures
 * independently (see gpsQueue/actionQueue flush functions), so a false
 * "online" reading here never causes data loss, only a slightly optimistic
 * banner.
 */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected !== false);
    });
    return () => unsubscribe();
  }, []);

  return isConnected;
}
