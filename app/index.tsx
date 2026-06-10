import { useEffect } from 'react';
import { router, type Href } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

export default function IndexScreen() {
  const { isAuthenticated, isLoading, userStatus } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (userStatus === 'SUSPENDED') {
      router.replace('/status-blocked' as Href);
      return;
    }

    // PENDING owners must reach the app: they still need to create
    // their shop (tabs redirect to /create-shop when no shop exists),
    // and admin approval happens after that.
    // ACTIVE or status not yet loaded — allow entry
    router.replace('/(tabs)');
  }, [isLoading, isAuthenticated, userStatus]);

  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={Colors.dark.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
});
