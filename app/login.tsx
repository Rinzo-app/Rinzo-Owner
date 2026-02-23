import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, error, clearError, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setLocalLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch {
    } finally {
      setLocalLoading(false);
    }
  };

  const isSubmitting = localLoading || isLoading;
  const canSubmit = email.trim().length > 0 && password.trim().length > 0 && !isSubmitting;

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, { paddingTop: insets.top + webTopInset + 60, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) }]}>
        <View style={styles.brandSection}>
          <LinearGradient
            colors={['rgba(0, 212, 170, 0.2)', 'rgba(0, 212, 170, 0.05)']}
            style={styles.iconContainer}
          >
            <Ionicons name="water" size={40} color={Colors.dark.primary} />
          </LinearGradient>
          <Text style={styles.brandName}>Rinzo</Text>
          <Text style={styles.brandTagline}>Shop Owner Portal</Text>
        </View>

        <View style={styles.formSection}>
          {error && (
            <Pressable style={styles.errorBanner} onPress={clearError}>
              <Ionicons name="alert-circle" size={18} color={Colors.dark.error} />
              <Text style={styles.errorText}>{error}</Text>
              <Ionicons name="close" size={16} color={Colors.dark.textSecondary} />
            </Pressable>
          )}

          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color={Colors.dark.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.dark.textTertiary}
              value={email}
              onChangeText={(t) => { setEmail(t); clearError(); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.dark.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={Colors.dark.textTertiary}
              value={password}
              onChangeText={(t) => { setPassword(t); clearError(); }}
              secureTextEntry={!showPassword}
              editable={!isSubmitting}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={Colors.dark.textSecondary}
              />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.signInButton,
              !canSubmit && styles.signInButtonDisabled,
              pressed && canSubmit && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleSignIn}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#0A0A0F" size="small" />
            ) : (
              <Text style={styles.signInText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footerSection}>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>SHOP OWNER ACCESS ONLY</Text>
            <View style={styles.dividerLine} />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.2)',
  },
  brandName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    color: Colors.dark.text,
    letterSpacing: -1,
  },
  brandTagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  formSection: {
    gap: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.errorDim,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.2)',
  },
  errorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.dark.error,
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.dark.text,
    paddingVertical: 16,
  },
  signInButton: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  signInButtonDisabled: {
    opacity: 0.4,
  },
  signInText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#0A0A0F',
  },
  footerSection: {
    marginTop: 40,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.surfaceBorder,
  },
  dividerText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.dark.textTertiary,
    letterSpacing: 1.5,
  },
});
