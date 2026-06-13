import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useShop } from '@/lib/shop-context';
import { uploadServiceImage } from '@/lib/upload';

const UNITS = ['per kg', 'per piece', 'per load', 'per set'];

export default function AddServiceScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { services, addService, updateService } = useShop();

  const existingService = editId ? services.find(s => s.id === editId) : null;

  const [name, setName] = useState(existingService?.name || '');
  // Prices are stored in paise; the owner types rupees.
  const [price, setPrice] = useState(
    existingService ? String(existingService.price / 100) : '',
  );
  const [unit, setUnit] = useState(existingService?.unit || 'per kg');
  const [active, setActive] = useState(existingService?.active ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(existingService?.imageUrl ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isEditing = !!existingService;
  const canSave =
    name.trim().length > 0 &&
    price.trim().length > 0 &&
    parseFloat(price) > 0 &&
    !uploadingPhoto;

  const handlePickPhoto = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add a service photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingPhoto(true);
    try {
      // Editing → key by service id; creating → a fresh timestamp key.
      const key = existingService?.id ?? `new-${Date.now()}`;
      const url = await uploadServiceImage(key, result.assets[0].uri);
      setImageUrl(url);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const pricePaise = Math.round(parseFloat(price) * 100);

    if (isEditing && existingService) {
      await updateService({
        ...existingService,
        name: name.trim(),
        price: pricePaise,
        unit,
        active,
        imageUrl,
      });
    } else {
      await addService({
        name: name.trim(),
        price: pricePaise,
        unit,
        active,
        imageUrl,
      });
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={Colors.dark.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Service' : 'Add Service'}</Text>
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          hitSlop={10}
        >
          <Ionicons name="checkmark" size={24} color={canSave ? Colors.dark.primary : Colors.dark.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Service Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Wash & Fold"
            placeholderTextColor={Colors.dark.textTertiary}
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Price ({'\u20B9'})</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={Colors.dark.textTertiary}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Unit</Text>
          <View style={styles.unitRow}>
            {UNITS.map(u => (
              <Pressable
                key={u}
                style={[styles.unitChip, unit === u && styles.unitChipActive]}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                  setUnit(u);
                }}
              >
                <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>{u}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Photo (optional)</Text>
          <Pressable
            style={({ pressed }) => [styles.photoPicker, pressed && { opacity: 0.85 }]}
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={Colors.dark.primary} />
            ) : imageUrl ? (
              <>
                <Image source={{ uri: imageUrl }} style={styles.photoThumb} />
                <Text style={styles.photoPickerText}>Change photo</Text>
              </>
            ) : (
              <>
                <Ionicons name="image-outline" size={22} color={Colors.dark.textTertiary} />
                <Text style={styles.photoPickerText}>Add a photo</Text>
              </>
            )}
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            !canSave && styles.saveBtnDisabled,
            pressed && canSave && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>{isEditing ? 'Update Service' : 'Add Service'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.surfaceBorder,
  },
  headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.dark.text },
  form: { padding: 20, gap: 20 },
  field: { gap: 8 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.dark.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
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
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  unitChipActive: { backgroundColor: Colors.dark.primaryDim, borderColor: Colors.dark.primary },
  unitText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.dark.textSecondary },
  unitTextActive: { color: Colors.dark.primary },
  saveBtn: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#0A0A0F' },
  photoPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  photoThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.dark.surfaceElevated },
  photoPickerText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.dark.textSecondary },
});
