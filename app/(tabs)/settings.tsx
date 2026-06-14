import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { getCurrentPosition } from '@/lib/get-position';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { router } from 'expo-router';
import { useShop } from '@/lib/shop-context';
import { useAuth } from '@/lib/auth-context';
import { fetchMyDisputes, deleteAccount, type Dispute } from '@/lib/api';
import { uploadShopImage } from '@/lib/upload';
import { formatTime12h, to12hParts, from12hParts, type Period } from '@/lib/time';

function disputeBadgeBg(status: string) {
  switch (status) {
    case 'OPEN': return Colors.dark.warningDim;
    case 'IN_REVIEW': return Colors.dark.primaryDim;
    case 'RESOLVED': return Colors.dark.successDim;
    default: return Colors.dark.surfaceElevated;
  }
}
function disputeBadgeColor(status: string) {
  switch (status) {
    case 'OPEN': return Colors.dark.warning;
    case 'IN_REVIEW': return Colors.dark.primary;
    case 'RESOLVED': return Colors.dark.success;
    default: return Colors.dark.textTertiary;
  }
}

function SettingRow({ icon, iconColor, label, children }: {
  icon: string;
  iconColor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={rowStyles.row}>
      <View style={[rowStyles.iconWrap, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={rowStyles.label}>{label}</Text>
      <View style={rowStyles.right}>{children}</View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.surfaceBorder,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.dark.text, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
});

// ── 12-hour time field (hour : minute  AM/PM toggle) ──
function TimeField12h({
  label,
  parts,
  onChange,
  autoFocus,
}: {
  label: string;
  parts: { hour: string; minute: string; period: Period };
  onChange: (p: { hour: string; minute: string; period: Period }) => void;
  autoFocus?: boolean;
}) {
  return (
    <View style={hoursStyles.fieldRow}>
      <Text style={hoursStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={hoursStyles.timeInput}
        value={parts.hour}
        onChangeText={(t) => onChange({ ...parts, hour: t.replace(/\D/g, '').slice(0, 2) })}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="8"
        placeholderTextColor={Colors.dark.textTertiary}
        autoFocus={autoFocus}
      />
      <Text style={hoursStyles.colon}>:</Text>
      <TextInput
        style={hoursStyles.timeInput}
        value={parts.minute}
        onChangeText={(t) => onChange({ ...parts, minute: t.replace(/\D/g, '').slice(0, 2) })}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="00"
        placeholderTextColor={Colors.dark.textTertiary}
      />
      <Pressable
        onPress={() => onChange({ ...parts, period: parts.period === 'AM' ? 'PM' : 'AM' })}
        style={hoursStyles.periodToggle}
      >
        <Text style={hoursStyles.periodText}>{parts.period}</Text>
      </Pressable>
    </View>
  );
}

const hoursStyles = StyleSheet.create({
  editor: { flex: 1, gap: 10 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.dark.textSecondary, width: 48 },
  timeInput: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.dark.text,
    backgroundColor: Colors.dark.surfaceElevated,
    paddingVertical: 8,
    borderRadius: 8,
    width: 48,
    textAlign: 'center',
  },
  colon: { fontFamily: 'Inter_700Bold', fontSize: 16, color: Colors.dark.text },
  periodToggle: {
    backgroundColor: Colors.dark.primaryDim,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 2,
  },
  periodText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.dark.primary, letterSpacing: 0.5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  cancelText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.dark.textSecondary },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.dark.background },
});

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useShop();
  const { signOut, user } = useAuth();
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityValue, setCapacityValue] = useState(String(settings.dailyCapacity));
  const [editingMinOrder, setEditingMinOrder] = useState(false);
  const [minOrderValue, setMinOrderValue] = useState(String(Math.round((settings.minOrder ?? 0) / 100)));
  const [editingRadius, setEditingRadius] = useState(false);
  const [radiusValue, setRadiusValue] = useState(String(settings.serviceRadiusKm));
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(settings.shopName);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [locatingShop, setLocatingShop] = useState(false);
  const [editingHours, setEditingHours] = useState(false);
  // Hours are stored as 24h "HH:MM" but edited/shown as 12-hour AM/PM.
  const [openParts, setOpenParts] = useState(() => to12hParts(settings.openTime));
  const [closeParts, setCloseParts] = useState(() => to12hParts(settings.closeTime));
  const disputesQuery = useQuery<Dispute[]>({
    queryKey: ['my-disputes'],
    queryFn: fetchMyDisputes,
    staleTime: 30_000,
  });

  const handleUpdateLocation = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocatingShop(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'Allow location access to update your shop position.');
        return;
      }
      const pos = await getCurrentPosition();
      await updateSettings({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Location updated', 'Your shop location has been saved. Stand inside the shop for the most accurate position.');
    } catch {
      Alert.alert('Location failed', 'Could not get your location. Make sure GPS is on and try again.');
    } finally {
      setLocatingShop(false);
    }
  };

  const handleToggleOpen = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateSettings({ isOpen: !settings.isOpen });
  };

  const handleToggleAutoReject = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateSettings({ autoReject: !settings.autoReject });
  };

  const handleSaveMinOrder = () => {
    const rupees = parseInt(minOrderValue, 10);
    if (Number.isFinite(rupees) && rupees >= 0 && rupees <= 10000) {
      updateSettings({ minOrder: rupees * 100 });
      setEditingMinOrder(false);
    }
  };

  const handleSaveCapacity = () => {
    const num = parseInt(capacityValue, 10);
    if (num > 0 && num <= 999) {
      updateSettings({ dailyCapacity: num });
      setEditingCapacity(false);
    }
  };

  const handleSaveRadius = () => {
    const num = parseInt(radiusValue, 10);
    if (num >= 1 && num <= 50) {
      updateSettings({ serviceRadiusKm: num });
      setEditingRadius(false);
    }
  };

  const handleSaveName = () => {
    if (nameValue.trim().length > 0) {
      updateSettings({ shopName: nameValue.trim() });
      setEditingName(false);
    }
  };

  const handleSaveHours = () => {
    const open = from12hParts(openParts.hour, openParts.minute, openParts.period);
    const close = from12hParts(closeParts.hour, closeParts.minute, closeParts.period);
    if (!open || !close) {
      Alert.alert('Invalid time', 'Enter an hour 1–12 and minute 00–59 for both.');
      return;
    }
    updateSettings({ openTime: open, closeTime: close });
    setEditingHours(false);
  };

  const handlePickPhoto = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set your shop photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadShopImage(result.assets[0].uri);
      await updateSettings({ imageUrl: url });
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (confirm('Sign out of your account?')) {
        signOut();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]);
    }
  };

  const handleDeleteAccount = () => {
    const run = async () => {
      try {
        await deleteAccount();
        await signOut();
      } catch (e: any) {
        Alert.alert("Couldn't delete", e?.message || 'Please try again.');
      }
    };
    if (Platform.OS === 'web') {
      if (confirm('Permanently delete your account? Orders in progress must be completed or cancelled first. This cannot be undone.')) run();
    } else {
      Alert.alert(
        'Delete account?',
        'This permanently deletes your account and shop data and cannot be undone. Orders in progress must be completed or cancelled first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: run },
        ],
      );
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + webTopInset + 16, paddingBottom: insets.bottom + webBottomInset + 100 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.sectionLabel}>SHOP INFO</Text>
        <View style={styles.card}>
          <View style={rowStyles.row}>
            <View style={[rowStyles.iconWrap, { backgroundColor: Colors.dark.primaryDim }]}>
              <Ionicons name="storefront" size={18} color={Colors.dark.primary} />
            </View>
            {editingName ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={nameValue}
                  onChangeText={setNameValue}
                  autoFocus
                  onSubmitEditing={handleSaveName}
                  returnKeyType="done"
                />
                <Pressable onPress={handleSaveName}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.dark.primary} />
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={[rowStyles.label, { flex: 1 }]}>{settings.shopName}</Text>
                <Pressable onPress={() => setEditingName(true)}>
                  <Ionicons name="pencil" size={18} color={Colors.dark.textSecondary} />
                </Pressable>
              </>
            )}
          </View>

          <SettingRow icon="power" iconColor={settings.isOpen ? Colors.dark.success : Colors.dark.error} label="Shop Status">
            <Text style={[styles.statusLabel, { color: settings.isOpen ? Colors.dark.success : Colors.dark.error }]}>
              {settings.isOpen ? 'Open' : 'Closed'}
            </Text>
            <Switch
              value={settings.isOpen}
              onValueChange={handleToggleOpen}
              trackColor={{ false: Colors.dark.surfaceBorder, true: Colors.dark.primaryDim }}
              thumbColor={settings.isOpen ? Colors.dark.primary : Colors.dark.textTertiary}
            />
          </SettingRow>
        </View>

        <Text style={styles.sectionLabel}>HOURS</Text>
        <View style={styles.card}>
          <View style={rowStyles.row}>
            <View style={[rowStyles.iconWrap, { backgroundColor: Colors.dark.infoDim }]}>
              <Ionicons name="time" size={18} color={Colors.dark.info} />
            </View>
            {editingHours ? (
              <View style={hoursStyles.editor}>
                <TimeField12h label="Open" parts={openParts} onChange={setOpenParts} autoFocus />
                <TimeField12h label="Close" parts={closeParts} onChange={setCloseParts} />
                <View style={hoursStyles.actions}>
                  <Pressable onPress={() => setEditingHours(false)}>
                    <Text style={hoursStyles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleSaveHours} style={hoursStyles.saveBtn}>
                    <Ionicons name="checkmark" size={16} color={Colors.dark.background} />
                    <Text style={hoursStyles.saveText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Text style={rowStyles.label}>Open hours</Text>
                <Text style={styles.capacityValue}>{formatTime12h(settings.openTime)} – {formatTime12h(settings.closeTime)}</Text>
                <Pressable onPress={() => { setOpenParts(to12hParts(settings.openTime)); setCloseParts(to12hParts(settings.closeTime)); setEditingHours(true); }} style={{ marginLeft: 8 }}>
                  <Ionicons name="pencil" size={18} color={Colors.dark.textSecondary} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        <Text style={styles.sectionLabel}>STOREFRONT PHOTO</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.photoWrap, pressed && { opacity: 0.85 }]}
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
          >
            {settings.imageUrl ? (
              <Image source={{ uri: settings.imageUrl }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={32} color={Colors.dark.textTertiary} />
                <Text style={styles.photoPlaceholderText}>Add a shop photo</Text>
              </View>
            )}
            <View style={styles.photoOverlay}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="camera" size={16} color="#fff" />
                  <Text style={styles.photoOverlayText}>
                    {settings.imageUrl ? 'Change photo' : 'Upload'}
                  </Text>
                </>
              )}
            </View>
          </Pressable>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={18} color={Colors.dark.info} />
          <Text style={styles.infoText}>
            This photo appears on your shop card when customers browse. A clear storefront or signage photo builds trust and gets more orders.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>CAPACITY</Text>
        <View style={styles.card}>
          <View style={rowStyles.row}>
            <View style={[rowStyles.iconWrap, { backgroundColor: Colors.dark.infoDim }]}>
              <MaterialCommunityIcons name="counter" size={18} color={Colors.dark.info} />
            </View>
            {editingCapacity ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={capacityValue}
                  onChangeText={setCapacityValue}
                  keyboardType="number-pad"
                  autoFocus
                  onSubmitEditing={handleSaveCapacity}
                  returnKeyType="done"
                  maxLength={3}
                />
                <Pressable onPress={handleSaveCapacity}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.dark.primary} />
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={rowStyles.label}>Daily Capacity</Text>
                <Text style={styles.capacityValue}>{settings.dailyCapacity}</Text>
                <Pressable onPress={() => { setCapacityValue(String(settings.dailyCapacity)); setEditingCapacity(true); }} style={{ marginLeft: 8 }}>
                  <Ionicons name="pencil" size={18} color={Colors.dark.textSecondary} />
                </Pressable>
              </>
            )}
          </View>

          <View style={rowStyles.row}>
            <View style={[rowStyles.iconWrap, { backgroundColor: Colors.dark.primaryDim }]}>
              <Ionicons name="cash-outline" size={18} color={Colors.dark.primary} />
            </View>
            {editingMinOrder ? (
              <View style={styles.editRow}>
                <Text style={{ color: Colors.dark.textSecondary }}>₹</Text>
                <TextInput
                  style={styles.editInput}
                  value={minOrderValue}
                  onChangeText={setMinOrderValue}
                  keyboardType="number-pad"
                  autoFocus
                  onSubmitEditing={handleSaveMinOrder}
                  returnKeyType="done"
                  maxLength={5}
                />
                <Pressable onPress={handleSaveMinOrder}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.dark.primary} />
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={rowStyles.label}>Minimum order</Text>
                <Text style={styles.capacityValue}>
                  {settings.minOrder > 0 ? `₹${Math.round(settings.minOrder / 100)}` : 'None'}
                </Text>
                <Pressable onPress={() => { setMinOrderValue(String(Math.round((settings.minOrder ?? 0) / 100))); setEditingMinOrder(true); }} style={{ marginLeft: 8 }}>
                  <Ionicons name="pencil" size={18} color={Colors.dark.textSecondary} />
                </Pressable>
              </>
            )}
          </View>

          <SettingRow icon="shield-checkmark" iconColor={Colors.dark.warning} label="Auto-Reject Orders">
            <Switch
              value={settings.autoReject}
              onValueChange={handleToggleAutoReject}
              trackColor={{ false: Colors.dark.surfaceBorder, true: Colors.dark.warningDim }}
              thumbColor={settings.autoReject ? Colors.dark.warning : Colors.dark.textTertiary}
            />
          </SettingRow>
        </View>

        <Text style={styles.sectionLabel}>SERVICE AREA</Text>
        <View style={styles.card}>
          <View style={rowStyles.row}>
            <View style={[rowStyles.iconWrap, { backgroundColor: Colors.dark.primaryDim }]}>
              <Ionicons name="navigate" size={18} color={Colors.dark.primary} />
            </View>
            {editingRadius ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={radiusValue}
                  onChangeText={setRadiusValue}
                  keyboardType="number-pad"
                  autoFocus
                  onSubmitEditing={handleSaveRadius}
                  returnKeyType="done"
                  maxLength={2}
                />
                <Pressable onPress={handleSaveRadius}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.dark.primary} />
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={rowStyles.label}>Delivery Radius</Text>
                <Text style={styles.capacityValue}>{settings.serviceRadiusKm} km</Text>
                <Pressable onPress={() => { setRadiusValue(String(settings.serviceRadiusKm)); setEditingRadius(true); }} style={{ marginLeft: 8 }}>
                  <Ionicons name="pencil" size={18} color={Colors.dark.textSecondary} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={18} color={Colors.dark.info} />
          <Text style={styles.infoText}>
            Customers more than {settings.serviceRadiusKm} km away won't see your shop or be able to order. Larger radius = wider reach but higher delivery fees for distant customers.
          </Text>
        </View>

        {settings.autoReject && (
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color={Colors.dark.info} />
            <Text style={styles.infoText}>
              When active orders reach {settings.dailyCapacity}, new orders will be automatically rejected with a message to the customer.
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>SHOP LOCATION</Text>
        <View style={styles.card}>
          <View style={rowStyles.row}>
            <View style={[rowStyles.iconWrap, { backgroundColor: Colors.dark.primaryDim }]}>
              <Ionicons name="location" size={18} color={Colors.dark.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={rowStyles.label}>Map location</Text>
              <Text style={styles.emailHint}>
                {settings.lat != null && settings.lng != null
                  ? `${settings.lat.toFixed(4)}, ${settings.lng.toFixed(4)}`
                  : 'Not set'}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.locationBtn, pressed && { opacity: 0.85 }]}
              onPress={handleUpdateLocation}
              disabled={locatingShop}
            >
              {locatingShop ? (
                <ActivityIndicator size="small" color={Colors.dark.primary} />
              ) : (
                <Text style={styles.locationBtnText}>Update</Text>
              )}
            </Pressable>
          </View>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={18} color={Colors.dark.info} />
          <Text style={styles.infoText}>
            This is the point customers and riders navigate to. Stand inside your shop and tap Update to set it accurately.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>PAYOUTS & DOCUMENTS</Text>
        <View style={styles.card}>
          <Pressable style={rowStyles.row} onPress={() => router.push('/business' as any)}>
            <View style={[rowStyles.iconWrap, { backgroundColor: Colors.dark.primaryDim }]}>
              <Ionicons name="card" size={18} color={Colors.dark.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={rowStyles.label}>Payout & business documents</Text>
              <Text style={styles.emailHint}>
                {settings.earnings ? `${'₹'}${(settings.earnings.balance / 100).toFixed(0)} payable` : 'Bank/UPI + KYC'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.dark.textTertiary} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <View style={rowStyles.row}>
            <View style={[rowStyles.iconWrap, { backgroundColor: Colors.dark.purpleDim }]}>
              <Ionicons name="person" size={18} color={Colors.dark.purple} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={rowStyles.label}>{user?.email || 'Shop Owner'}</Text>
              <Text style={styles.emailHint}>Shop owner account</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>MY DISPUTES</Text>
        <View style={styles.card}>
          {disputesQuery.isLoading ? (
            <View style={styles.disputeEmpty}>
              <Text style={styles.disputeEmptyText}>Loading…</Text>
            </View>
          ) : !disputesQuery.data?.length ? (
            <View style={styles.disputeEmpty}>
              <Text style={styles.disputeEmptyText}>No disputes filed</Text>
            </View>
          ) : (
            disputesQuery.data.map((d) => (
              <View key={d.id} style={styles.disputeCard}>
                <View style={styles.disputeRow}>
                  <Text style={styles.disputeCategory}>{d.category}</Text>
                  <View style={[styles.disputeBadge, { backgroundColor: disputeBadgeBg(d.status) }]}>
                    <Text style={[styles.disputeBadgeText, { color: disputeBadgeColor(d.status) }]}>{d.status.replace('_', ' ')}</Text>
                  </View>
                </View>
                <Text style={styles.disputeOrder} numberOfLines={1}>Order #{String(d.orderId).slice(0, 8)}</Text>
                {d.description ? <Text style={styles.disputeDesc} numberOfLines={2}>{d.description}</Text> : null}
                <Text style={styles.disputeDate}>{new Date(d.createdAt).toLocaleDateString()}</Text>
              </View>
            ))
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.dark.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <Pressable style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>Delete account</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  scroll: { paddingHorizontal: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.dark.text, marginBottom: 24 },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.dark.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 8,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    marginBottom: 16,
  },
  editRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  editInput: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.dark.text,
    backgroundColor: Colors.dark.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  statusLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, marginRight: 10 },
  photoWrap: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.surfaceElevated,
  },
  photoPlaceholderText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.dark.textTertiary },
  photoOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  photoOverlayText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#fff' },
  capacityValue: { fontFamily: 'Inter_700Bold', fontSize: 18, color: Colors.dark.text },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.dark.infoDim,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  infoText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.dark.info, flex: 1, lineHeight: 20 },
  emailHint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.dark.textTertiary },
  locationBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.primaryDim,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    minWidth: 72,
    alignItems: 'center',
  },
  locationBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.dark.primary },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.errorDim,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.2)',
  },
  signOutText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.dark.error },
  deleteBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  deleteText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.dark.textTertiary, textDecorationLine: 'underline' },
  disputeEmpty: { padding: 16 },
  disputeEmptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.dark.textTertiary },
  disputeCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.surfaceBorder,
  },
  disputeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  disputeCategory: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.dark.text },
  disputeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  disputeBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, textTransform: 'uppercase' as const },
  disputeOrder: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.dark.textSecondary, marginBottom: 2 },
  disputeDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.dark.textSecondary, marginBottom: 2 },
  disputeDate: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.dark.textTertiary },
});
