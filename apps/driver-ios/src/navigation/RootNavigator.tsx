import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import TodayScreen from '../screens/TodayScreen';
import RouteScreen from '../screens/RouteScreen';
import StudentsScreen from '../screens/StudentsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { TodayRouteProvider } from '../contexts/TodayRouteContext';

const Tab = createBottomTabNavigator();

export default function RootNavigator() {
  const { t } = useTranslation('driver');

  return (
    <TodayRouteProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#2563EB',
            tabBarInactiveTintColor: '#94A3B8',
          }}
        >
          <Tab.Screen name="Today" component={TodayScreen} options={{ title: t('tabs.today') }} />
          <Tab.Screen name="Route" component={RouteScreen} options={{ title: t('tabs.route') }} />
          <Tab.Screen name="Students" component={StudentsScreen} options={{ title: t('tabs.students') }} />
          <Tab.Screen name="History" component={HistoryScreen} options={{ title: t('tabs.history') }} />
          <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tabs.profile') }} />
        </Tab.Navigator>
      </NavigationContainer>
    </TodayRouteProvider>
  );
}
