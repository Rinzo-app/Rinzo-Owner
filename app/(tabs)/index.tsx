import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useShop, OrderStatus } from '@/lib/shop-context';

function CapacityMeter({ current, max, percent }: { current: number; max: number; percent: number }) {
  const getColor = () => {
    if (percent >= 90) return Colors.dark.error;
    if (percent >= 70) return Colors.dark.warning;
    return Colors.dark.primary;
  };

  return (
    <View style={capStyles.container}>
      <View style={capStyles.header}>
        <Text style={capStyles.label}>Daily Capacity</Text>
        <Text style={[capStyles.count, { color: getColor() }]}>
          {current}/{max}
        </Text>
      </View>
      <View style={capStyles.barBg}>
        <View style={[capStyles.barFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: getColor() }]} />
      </View>
      {percent >= 90 && (
        <View style={capStyles.warningRow}>
          <Ionicons name="warning" size={14} color={Colors.dark.warning} />
          <Text style={capStyles.warningText}>
            {percent >= 100 ? 'At full capacity' : 'Nearing capacity'}
          </Text>
        </View>
      )}
    </View>
  );
}

const capStyles = StyleSheet.create({
  container: { gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.dark.textSecondary },
  count: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  barBg: { height: 8, backgroundColor: Colors.dark.surfaceBorder, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warningText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.dark.warning },
});

function StatCard({ icon, iconColor, bgColor, label, value }: {
  icon: string;
  iconColor: string;
  bgColor: string;
  label: string;
  value: number;
}) {
  return (
    <View style={statStyles.card}>
      <View style={[statStyles.iconWrap, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.dark.text },
  label: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.dark.textSecondary },
});

function RecentOrderItem({ order }: { order: any }) {
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

  const config = statusConfig[order.status as OrderStatus];
  const timeAgo = getTimeAgo(order.createdAt);

  return (
    <Pressable
      style={({ pressed }) => [
        recentStyles.item,
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
      ]}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/order/[id]', params: { id: order.id } });
      }}
    >
      <View style={[recentStyles.statusDot, { backgroundColor: config.bg }]}>
        <Ionicons name={config.icon as any} size={18} color={config.color} />
      </View>
      <View style={recentStyles.info}>
        <Text style={recentStyles.name}>{order.customerName}</Text>
        <Text style={recentStyles.meta}>
          {order.items.length} item{order.items.length !== 1 ? 's' : ''} {'\u00B7'} {timeAgo}
        </Text>
      </View>
      <View style={recentStyles.right}>
        <Text style={recentStyles.amount}>{'\u20B9'}{order.totalAmount}</Text>
        <View style={[recentStyles.statusBadge, { backgroundColor: config.bg }]}>
          <Text style={[recentStyles.statusText, { color: config.color }]}>
            {order.status.replace('_', ' ')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const recentStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.surfaceBorder,
  },
  statusDot: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 3 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.dark.text },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.dark.textSecondary },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.dark.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
});

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { orders, settings, activeOrderCount, capacityPercent, isAtCapacity } = useShop();

  const newOrders = orders.filter(o => o.status === 'NEW').length;
  const inWash = orders.filter(o => o.status === 'IN_WASH').length;
  const ready = orders.filter(o => o.status === 'READY').length;
  const recentOrders = orders.slice(0, 5);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 84 : 0;

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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.shopName}>{settings.shopName}</Text>
          </View>
          <View style={[styles.statusPill, settings.isOpen ? styles.statusOpen : styles.statusClosed]}>
            <View style={[styles.statusDotSmall, { backgroundColor: settings.isOpen ? Colors.dark.success : Colors.dark.error }]} />
            <Text style={[styles.statusPillText, { color: settings.isOpen ? Colors.dark.success : Colors.dark.error }]}>
              {settings.isOpen ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>

        <LinearGradient
          colors={['rgba(0, 212, 170, 0.12)', 'rgba(0, 212, 170, 0.04)']}
          style={styles.capacityCard}
        >
          <CapacityMeter current={activeOrderCount} max={settings.dailyCapacity} percent={capacityPercent} />
          {settings.autoReject && isAtCapacity && (
            <View style={styles.autoRejectBanner}>
              <MaterialCommunityIcons name="shield-check" size={16} color={Colors.dark.warning} />
              <Text style={styles.autoRejectText}>Auto-reject is active</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.statsRow}>
          <StatCard icon="time" iconColor={Colors.status.NEW.color} bgColor={Colors.status.NEW.bg} label="New" value={newOrders} />
          <StatCard icon="water" iconColor={Colors.status.IN_WASH.color} bgColor={Colors.status.IN_WASH.bg} label="In Wash" value={inWash} />
          <StatCard icon="checkmark-done-circle" iconColor={Colors.status.READY.color} bgColor={Colors.status.READY.bg} label="Ready" value={ready} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <Pressable onPress={() => router.push('/(tabs)/orders')}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        <View style={styles.recentCard}>
          {recentOrders.length > 0 ? (
            recentOrders.map(order => (
              <RecentOrderItem key={order.id} order={order} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={Colors.dark.textTertiary} />
              <Text style={styles.emptyText}>No orders yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  scroll: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.dark.textSecondary },
  shopName: { fontFamily: 'Inter_700Bold', fontSize: 26, color: Colors.dark.text, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusOpen: { backgroundColor: Colors.dark.successDim, borderColor: 'rgba(16, 185, 129, 0.3)' },
  statusClosed: { backgroundColor: Colors.dark.errorDim, borderColor: 'rgba(255, 71, 87, 0.3)' },
  statusDotSmall: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  capacityCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.15)',
  },
  autoRejectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: Colors.dark.warningDim,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  autoRejectText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.dark.warning },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.dark.text },
  seeAll: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.dark.primary },
  recentCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.dark.textTertiary },
});
