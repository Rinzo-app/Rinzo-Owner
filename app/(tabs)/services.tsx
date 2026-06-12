import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { formatMoney } from '@/lib/money';
import { useShop, Service } from '@/lib/shop-context';

function ServiceCard({ service, onToggle, onDelete }: {
  service: Service;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[sCardStyles.card, !service.active && sCardStyles.cardInactive]}>
      <View style={sCardStyles.topRow}>
        <View style={sCardStyles.info}>
          <Text style={[sCardStyles.name, !service.active && sCardStyles.textInactive]}>{service.name}</Text>
          <Text style={sCardStyles.unit}>{service.unit}</Text>
        </View>
        <Text style={sCardStyles.price}>{formatMoney(service.price)}</Text>
      </View>

      <View style={sCardStyles.actions}>
        <Pressable
          style={({ pressed }) => [sCardStyles.actionBtn, pressed && { opacity: 0.7 }]}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: '/add-service', params: { editId: service.id } });
          }}
        >
          <Ionicons name="pencil" size={16} color={Colors.dark.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [sCardStyles.actionBtn, pressed && { opacity: 0.7 }]}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle();
          }}
        >
          <Ionicons
            name={service.active ? 'eye' : 'eye-off'}
            size={16}
            color={service.active ? Colors.dark.primary : Colors.dark.textTertiary}
          />
        </Pressable>

        <Pressable
          style={({ pressed }) => [sCardStyles.actionBtn, pressed && { opacity: 0.7 }]}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onDelete();
          }}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.dark.error} />
        </Pressable>
      </View>
    </View>
  );
}

const sCardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  cardInactive: { opacity: 0.5 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  info: { flex: 1, gap: 2 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.dark.text },
  textInactive: { textDecorationLine: 'line-through' as const },
  unit: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.dark.textSecondary },
  price: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.dark.primary },
  actions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.surfaceBorder,
    paddingTop: 12,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const { services, updateService, deleteService } = useShop();

  const handleToggle = (service: Service) => {
    updateService({ ...service, active: !service.active });
  };

  const handleDelete = (service: Service) => {
    if (Platform.OS === 'web') {
      if (confirm(`Delete "${service.name}"?`)) {
        deleteService(service.id);
      }
    } else {
      Alert.alert(
        'Delete Service',
        `Are you sure you want to delete "${service.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteService(service.id) },
        ]
      );
    }
  };

  const activeCount = services.filter(s => s.active).length;
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 84 : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 16 }]}>
        <View>
          <Text style={styles.title}>Services</Text>
          <Text style={styles.subtitle}>{activeCount} active of {services.length}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/add-service');
          }}
        >
          <Ionicons name="add" size={22} color="#0A0A0F" />
        </Pressable>
      </View>

      <FlatList
        data={services}
        renderItem={({ item }) => (
          <ServiceCard
            service={item}
            onToggle={() => handleToggle(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + webBottomInset + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="pricetag-outline" size={48} color={Colors.dark.textTertiary} />
            <Text style={styles.emptyTitle}>No services yet</Text>
            <Text style={styles.emptySubtitle}>Add your laundry services and pricing</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.dark.text },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.dark.textSecondary, marginTop: 2 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: 20 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.dark.text },
  emptySubtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.dark.textSecondary },
});
