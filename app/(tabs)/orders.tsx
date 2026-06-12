import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { formatMoney } from '@/lib/money';
import { useShop, Order, OrderStatus } from '@/lib/shop-context';

const STATUS_FILTERS: { label: string; value: OrderStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'New', value: 'NEW' },
  { label: 'Accepted', value: 'ACCEPTED' },
  { label: 'In Wash', value: 'IN_WASH' },
  { label: 'Ready', value: 'READY' },
  { label: 'Delivered', value: 'DELIVERED' },
];

function FilterChip({ label, active, onPress, count }: { label: string; active: boolean; onPress: () => void; count?: number }) {
  return (
    <Pressable
      style={[chipStyles.chip, active && chipStyles.chipActive]}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync();
        onPress();
      }}
    >
      <Text style={[chipStyles.text, active && chipStyles.textActive]}>{label}</Text>
      {count !== undefined && count > 0 && (
        <View style={[chipStyles.badge, active && chipStyles.badgeActive]}>
          <Text style={[chipStyles.badgeText, active && chipStyles.badgeTextActive]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  chipActive: { backgroundColor: Colors.dark.primaryDim, borderColor: Colors.dark.primary },
  text: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.dark.textSecondary },
  textActive: { color: Colors.dark.primary },
  badge: { backgroundColor: Colors.dark.surfaceBorder, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, minWidth: 20, alignItems: 'center' },
  badgeActive: { backgroundColor: 'rgba(0, 212, 170, 0.3)' },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: Colors.dark.textSecondary },
  badgeTextActive: { color: Colors.dark.primary },
});

function OrderCard({ order }: { order: Order }) {
  const statusConfig: Record<OrderStatus, { color: string; bg: string; icon: string }> = {
    NEW: { color: Colors.status.NEW.color, bg: Colors.status.NEW.bg, icon: 'time' },
    ACCEPTED: { color: Colors.status.ACCEPTED.color, bg: Colors.status.ACCEPTED.bg, icon: 'checkmark-circle' },
    IN_WASH: { color: Colors.status.IN_WASH.color, bg: Colors.status.IN_WASH.bg, icon: 'water' },
    READY: { color: Colors.status.READY.color, bg: Colors.status.READY.bg, icon: 'checkmark-done-circle' },
    OUT_FOR_DELIVERY: { color: Colors.status.OUT_FOR_DELIVERY.color, bg: Colors.status.OUT_FOR_DELIVERY.bg, icon: 'bicycle' },
    DELIVERED: { color: Colors.status.DELIVERED.color, bg: Colors.status.DELIVERED.bg, icon: 'bag-check' },
    REJECTED: { color: Colors.status.REJECTED.color, bg: Colors.status.REJECTED.bg, icon: 'close-circle' },
    CANCELLED: { color: Colors.status.CANCELLED.color, bg: Colors.status.CANCELLED.bg, icon: 'ban' },
  };
  const config = statusConfig[order.status];

  const date = new Date(order.createdAt);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <Pressable
      style={({ pressed }) => [
        cardStyles.card,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/order/[id]', params: { id: order.id } });
      }}
    >
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.statusIcon, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon as any} size={20} color={config.color} />
        </View>
        <View style={cardStyles.topInfo}>
          <Text style={cardStyles.customerName}>{order.customerName}</Text>
          <Text style={cardStyles.dateText}>{dateStr} {'\u00B7'} {timeStr}</Text>
        </View>
        <View style={[cardStyles.statusBadge, { backgroundColor: config.bg }]}>
          <Text style={[cardStyles.statusText, { color: config.color }]}>
            {order.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={cardStyles.itemsRow}>
        {order.items.map((item, i) => (
          <Text key={i} style={cardStyles.itemText}>
            {item.quantity}x {item.serviceName}
          </Text>
        ))}
      </View>

      <View style={cardStyles.bottomRow}>
        <View style={cardStyles.phoneRow}>
          <Ionicons name="call-outline" size={14} color={Colors.dark.textTertiary} />
          <Text style={cardStyles.phoneText}>{order.customerPhone}</Text>
        </View>
        <Text style={cardStyles.amount}>{formatMoney(order.totalAmount)}</Text>
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  statusIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  topInfo: { flex: 1, gap: 2 },
  customerName: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.dark.text },
  dateText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.dark.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  itemText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.dark.textSecondary, backgroundColor: Colors.dark.surfaceElevated, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.dark.surfaceBorder, paddingTop: 12 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.dark.textTertiary },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 18, color: Colors.dark.text },
});

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { orders } = useShop();
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'ALL'>('ALL');

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'ALL') return orders;
    return orders.filter(o => o.status === activeFilter);
  }, [orders, activeFilter]);

  const getCount = (status: OrderStatus | 'ALL') => {
    if (status === 'ALL') return orders.length;
    return orders.filter(o => o.status === status).length;
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 84 : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 16 }]}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>{orders.length} total</Text>
      </View>

      <View style={styles.filtersWrap}>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          renderItem={({ item }) => (
            <FilterChip
              label={item.label}
              active={activeFilter === item.value}
              onPress={() => setActiveFilter(item.value)}
              count={getCount(item.value)}
            />
          )}
          keyExtractor={item => item.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
        />
      </View>

      <FlatList
        data={filteredOrders}
        renderItem={({ item }) => <OrderCard order={item} />}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + webBottomInset + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={Colors.dark.textTertiary} />
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter !== 'ALL' ? `No ${activeFilter.replace('_', ' ').toLowerCase()} orders` : 'Orders will appear here'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.dark.text },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.dark.textSecondary, marginTop: 2 },
  filtersWrap: { marginBottom: 16 },
  filtersContent: { paddingHorizontal: 20 },
  listContent: { paddingHorizontal: 20 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.dark.text },
  emptySubtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.dark.textSecondary },
});
