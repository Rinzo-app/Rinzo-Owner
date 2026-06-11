import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { createShop, ApiError } from '@/lib/api';
import { getCurrentPosition } from '@/lib/get-position';

export default function CreateShopScreen() {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.trim().length > 0 &&
    /^(\+91|0)?[6-9]\d{9}$/.test(phone.replace(/[\s-]/g, '')) &&
    address.trim().length > 0 &&
    coords !== null &&
    !submitting;

  const captureLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is needed to set your shop position. Customers find you by distance.');
        return;
      }
      const pos = await getCurrentPosition();
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError('Could not get your location. Make sure GPS is enabled and try again.');
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !coords) return;
    setError(null);
    setSubmitting(true);
    try {
      await createShop({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
      Alert.alert(
        'Shop submitted',
        'Your shop has been created and is awaiting admin approval. You can set up your services in the meantime.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }],
      );
      // Web fallback — Alert is a no-op there
      if (Platform.OS === 'web') router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ERR_SHOP_EXISTS') {
        // Shop already exists — just refresh and continue
        await queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
        router.replace('/(tabs)');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to create shop. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="storefront" size={32} color={Colors.dark.primary} />
        </View>
        <Text style={styles.title}>Set up your shop</Text>
        <Text style={styles.subtitle}>
          Tell us about your laundry. Once an admin approves it, customers nearby will see your shop.
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Shop Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sparkle Laundry"
            placeholderTextColor={Colors.dark.textTertiary}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="Shop contact number"
            placeholderTextColor={Colors.dark.textTertiary}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Street, area, city"
            placeholderTextColor={Colors.dark.textTertiary}
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Shop Location</Text>
          <Pressable
            style={({ pressed }) => [
              styles.locationBtn,
              coords && styles.locationBtnDone,
              pressed && { opacity: 0.85 },
            ]}
            onPress={captureLocation}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator size="small" color={Colors.dark.primary} />
            ) : (
              <Ionicons
                name={coords ? 'checkmark-circle' : 'locate'}
                size={20}
                color={coords ? '#4ADE80' : Colors.dark.primary}
              />
            )}
            <Text style={[styles.locationBtnText, coords ? styles.locationBtnTextDone : null]}>
              {coords
                ? `Location captured (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
                : 'Use my current location'}
            </Text>
          </Pressable>
          <Text style={styles.hint}>
            Stand inside your shop when capturing — this is how customers and riders find you.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#F87171" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            !canSubmit && styles.submitBtnDisabled,
            pressed && canSubmit && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#0A0A0F" />
          ) : (
            <Text style={styles.submitBtnText}>Create Shop</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingTop: 72, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 10, marginBottom: 28 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: Colors.dark.text },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: { gap: 20 },
  field: { gap: 8 },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  input: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.dark.text,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' as const },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  locationBtnDone: { borderColor: '#4ADE80' },
  locationBtnText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.dark.primary, flex: 1 },
  locationBtnTextDone: { color: '#4ADE80' },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.dark.textTertiary, lineHeight: 17 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    borderRadius: 12,
    padding: 12,
  },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#F87171', flex: 1, lineHeight: 18 },
  submitBtn: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#0A0A0F' },
});
