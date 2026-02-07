import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useShop, OrderStatus } from '@/lib/shop-context';

const STATUS_FLOW: OrderStatus[] = ['NEW', 'ACCEPTED', 'IN_WASH', 'READY'];

const STATUS_CONFIG: Record<OrderStatus, { color: string; bg: string; icon: string; label: string }> = {
  NEW: { color: Colors.status.NEW.color, bg: Colors.status.NEW.bg, icon: 'time', label: 'New Order' },
  ACCEPTED: { color: Colors.status.ACCEPTED.color, bg: Colors.status.ACCEPTED.bg, icon: 'checkmark-circle', label: 'Accepted' },
  IN_WASH: { color: Colors.status.IN_WASH.color, bg: Colors.status.IN_WASH.bg, icon: 'water', label: 'In Wash' },
  READY: { color: Colors.status.READY.color, bg: Colors.status.READY.bg, icon: 'checkmark-done-circle', label: 'Ready' },
  REJECTED: { color: Colors.status.REJECTED.color, bg: Colors.status.REJECTED.bg, icon: 'close-circle', label: 'Rejected' },
};

function StatusTimeline({ currentStatus }: { currentStatus: OrderStatus }) {
  const currentIndex = STATUS_FLOW.indexOf(currentStatus);

  return (
    <View style={tlStyles.container}>
      {STATUS_FLOW.map((status, i) => {
        const config = STATUS_CONFIG[status];
        const isPast = i <= currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <View key={status} style={tlStyles.stepRow}>
            <View style={tlStyles.stepLeft}>
              <View style={[
                tlStyles.dot,
                isPast && { backgroundColor: config.color },
                !isPast && { backgroundColor: Colors.dark.surfaceBorder },
                isCurrent && { borderWidth: 2, borderColor: config.color, backgroundColor: config.bg },
              ]}>
                {isPast && !isCurrent && (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                )}
                {isCurrent && (
                  <Ionicons name={config.icon as any} size={14} color={config.color} />
                )}
              </View>
              {i < STATUS_FLOW.length - 1 && (
                <View style={[tlStyles.line, isPast && { backgroundColor: config.color }]} />
              )}
            </View>
            <Text style={[
              tlStyles.label,
              isCurrent && { color: config.color, fontFamily: 'Inter_600SemiBold' },
              !isPast && { color: Colors.dark.textTertiary },
            ]}>
              {config.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const tlStyles = StyleSheet.create({
  container: { gap: 0 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepLeft: { alignItems: 'center', width: 28 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, height: 28, backgroundColor: Colors.dark.surfaceBorder, marginVertical: 2 },
  label: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.dark.textSecondary, paddingTop: 4 },
});

export default function OrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, updateOrderStatus } = useShop();

  const order = orders.find(o => o.id === id);

  if (!order) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.dark.textTertiary} />
        <Text style={styles.emptyText}>Order not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(order.status as OrderStatus);
  const nextStatus = currentIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIndex + 1] : null;
  const nextConfig = nextStatus ? STATUS_CONFIG[nextStatus] : null;

  const handleNextStatus = () => {
    if (!nextStatus) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateOrderStatus(order.id, nextStatus);
  };

  const handleReject = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    updateOrderStatus(order.id, 'REJECTED');
  };

  const config = STATUS_CONFIG[order.status as OrderStatus];
  const date = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.dark.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + webBottomInset + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusHeader, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon as any} size={28} color={config.color} />
          <View style={styles.statusHeaderInfo}>
            <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
            <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={18} color={Colors.dark.textSecondary} />
            <Text style={styles.detailText}>{order.customerName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={18} color={Colors.dark.textSecondary} />
            <Text style={styles.detailText}>{order.customerPhone}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.dark.textSecondary} />
            <Text style={styles.detailText}>{dateStr} at {timeStr}</Text>
          </View>
          {order.notes && (
            <View style={styles.detailRow}>
              <Ionicons name="chatbubble-outline" size={18} color={Colors.dark.textSecondary} />
              <Text style={styles.detailText}>{order.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items</Text>
          {order.items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.serviceName}</Text>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>{'\u20B9'}{item.quantity * item.price}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{'\u20B9'}{order.totalAmount}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Progress</Text>
          <StatusTimeline currentStatus={order.status as OrderStatus} />
        </View>
      </ScrollView>

      {order.status !== 'READY' && order.status !== 'REJECTED' && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + webBottomInset + 16 }]}>
          {order.status === 'NEW' && (
            <Pressable
              style={({ pressed }) => [styles.rejectBtn, pressed && { opacity: 0.8 }]}
              onPress={handleReject}
            >
              <Ionicons name="close" size={20} color={Colors.dark.error} />
            </Pressable>
          )}
          {nextStatus && nextConfig && (
            <Pressable
              style={({ pressed }) => [
                styles.nextStatusBtn,
                { backgroundColor: nextConfig.color },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleNextStatus}
            >
              <Ionicons name={nextConfig.icon as any} size={20} color="#fff" />
              <Text style={styles.nextStatusText}>
                {order.status === 'NEW' ? 'Accept Order' : `Mark ${nextConfig.label}`}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.surfaceBorder,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.dark.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.dark.text },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
  },
  statusHeaderInfo: { flex: 1, gap: 2 },
  statusLabel: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  orderId: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.dark.textSecondary },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.dark.textSecondary, marginBottom: 14, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  detailText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.dark.text },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.surfaceBorder,
  },
  itemInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.dark.text },
  itemQty: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.dark.textSecondary, backgroundColor: Colors.dark.surfaceElevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  itemPrice: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.dark.text },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    marginTop: 4,
  },
  totalLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.dark.textSecondary },
  totalAmount: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.dark.primary },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.surfaceBorder,
  },
  rejectBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.dark.errorDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.2)',
  },
  nextStatusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 16,
  },
  nextStatusText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#fff' },
  emptyText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.dark.textSecondary, marginTop: 10 },
  backLink: { marginTop: 16 },
  backLinkText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.dark.primary },
});
