// Registers the background location TaskManager task at module scope — must
// be imported before anything else so it survives an app relaunch mid-route.
import './src/lib/location/gpsTracker';

import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { initI18n, loadInitialLanguage } from './src/lib/i18n';
import LoginScreen from './src/screens/LoginScreen';
import RootNavigator from './src/navigation/RootNavigator';

function Root() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (status === 'inactive') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ textAlign: 'center', color: '#64748B' }}>
          Your account has been deactivated. Contact your transport administrator.
        </Text>
      </View>
    );
  }

  return status === 'signed_in' ? <RootNavigator /> : <LoginScreen />;
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const lang = await loadInitialLanguage();
      initI18n(lang);
      setReady(true);
    })();
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
