import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function HistoryScreen() {
  const { t } = useTranslation('driver');

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('historyComingSoon')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  text: { color: '#94A3B8', fontSize: 15, textAlign: 'center' },
});
