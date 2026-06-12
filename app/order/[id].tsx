import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { OrderStatus } from '@/lib/shop-context';
import { fetchOrder, acceptOrder, rejectOrder, markReady, weighOrder, createDispute, DISPUTE_CATEGORIES } from '@/lib/api';

const STATUS_FLOW: OrderStatus[] = ['NEW', 'ACCEPTED', 'IN_WASH', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const STATUS_CONFIG: Record<OrderStatus, { color: string; bg: string; icon: string; label: string }> = {
  NEW: { color: Colors.status.NEW.color, bg: Colors.status.NEW.bg, icon: 'time', label: 'New Order' },
  ACCEPTED: { color: Colors.status.ACCEPTED.color, bg: Colors.status.ACCEPTED.bg, icon: 'checkmark-circle', label: 'Accepted' },
  IN_WASH: { color: Colors.status.IN_WASH.color, bg: Colors.status.IN_WASH.bg, icon: 'water', label: 'In Wash' },
  READY: { color: Colors.status.READY.color, bg: Colors.status.READY.bg, icon: 'checkmark-done-circle', label: 'Ready' },
  OUT_FOR_DELIVERY: { color: Colors.status.OUT_FOR_DELIVERY.color, bg: Colors.status.OUT_FOR_DELIVERY.bg, icon: 'bicycle', label: 'Out for Delivery' },
  DELIVERED: { color: Colors.status.DELIVERED.color, bg: Colors.status.DELIVERED.bg, icon: 'bag-check', label: 'Delivered' },
  REJECTED: { color: Colors.status.REJECTED.color, bg: Colors.status.REJECTED.bg, icon: 'close-circle', label: 'Rejected' },
  CANCELLED: { color: Colors.status.CANCELLED.color, bg: Colors.status.CANCELLED.bg, icon: 'ban', label: 'Cancelled' },
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
  const queryClient = useQueryClient();

  // ── Dispute form state ───────────────────────────────
  const [showDispute, setShowDispute] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeError, setDisputeError] = useState('');

  // ── Weighing state ───────────────────────────────────
  const [showWeigh, setShowWeigh] = useState(false);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [weighError, setWeighError] = useState('');

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptOrder(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectOrder(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
  });

  const readyMutation = useMutation({
    mutationFn: () => markReady(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any) => {
      Alert.alert('Cannot mark ready', err?.message || 'Please try again.');
    },
  });

  const weighMutation = useMutation({
    mutationFn: (items: Array<{ itemId: string; actualQuantity: number }>) =>
      weighOrder(id!, items),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
      setShowWeigh(false);
      setWeighError('');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (updated.adjustmentStatus === 'PENDING') {
        Alert.alert(
          'Customer approval needed',
          `The new total (₹${updated.proposedTotalAmount}) is more than 20% above the estimate. The customer has been asked to approve it — you can mark the order ready once they do.`,
        );
      } else {
        Alert.alert('Price updated', `Final total: ₹${updated.totalAmount}`);
      }
    },
    onError: (err: any) => {
      setWeighError(err?.message || 'Failed to save weights. Please try again.');
    },
  });

  const openWeigh = () => {
    const initial: Record<string, string> = {};
    for (const item of order?.items ?? []) {
      if (item.id) {
        initial[item.id] = String(item.actualQuantity ?? item.quantity);
      }
    }
    setWeights(initial);
    setWeighError('');
    setShowWeigh(true);
  };

  const submitWeights = () => {
    const items: Array<{ itemId: string; actualQuantity: number }> = [];
    for (const [itemId, raw] of Object.entries(weights)) {
      const qty = parseFloat(raw);
      if (!Number.isFinite(qty) || qty <= 0) {
        setWeighError('Every item needs a weight greater than 0.');
        return;
      }
      items.push({ itemId, actualQuantity: qty });
    }
    if (items.length === 0) {
      setWeighError('Nothing to weigh.');
      return;
    }
    weighMutation.mutate(items);
  };

  const disputeMutation = useMutation({
    mutationFn: () =>
      createDispute({
        orderId: id!,
        category: disputeCategory,
        description: disputeDescription.trim(),
      }),
    onSuccess: () => {
      setShowDispute(false);
      setDisputeCategory('');
      setDisputeDescription('');
      setDisputeError('');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Dispute Submitted', 'We\'ll review your issue and get back to you shortly.');
    },
    onError: (err: any) => {
      setDisputeError(err.message || 'Failed to submit. Please try again.');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const isMutating = acceptMutation.isPending || rejectMutation.isPending || readyMutation.isPending;

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  if (!order || isError) {
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

  const handleAccept = () => {
    Alert.alert('Accept Order', 'Are you sure you want to accept this order?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: () => acceptMutation.mutate() },
    ]);
  };

  const handleMarkReady = () => {
    Alert.alert('Mark Ready', 'Has this order finished processing and is ready for delivery?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Ready', onPress: () => readyMutation.mutate() },
    ]);
  };

  const REJECTION_REASONS = [
    { value: 'CAPACITY_FULL', label: 'Capacity Full' },
    { value: 'CLOSED_TEMPORARILY', label: 'Closed Temporarily' },
    { value: 'SERVICE_UNAVAILABLE', label: 'Service Unavailable' },
    { value: 'EMERGENCY', label: 'Emergency' },
  ];

  const handleReject = () => {
    Alert.alert(
      'Reject Order',
      'Select a reason for rejection:',
      [
        ...REJECTION_REASONS.map((r) => ({
          text: r.label,
          onPress: () => rejectMutation.mutate(r.value),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
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
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
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
          {order.items.map((item, i) => {
            const qty = item.actualQuantity ?? item.quantity;
            const weighed = item.actualQuantity != null;
            return (
              <View key={i} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.serviceName}</Text>
                  <Text style={styles.itemQty}>
                    x{qty}{weighed ? ' (weighed)' : ' (est.)'}
                  </Text>
                </View>
                <Text style={styles.itemPrice}>{'\u20B9'}{Math.round(qty * item.price)}</Text>
              </View>
            );
          })}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{'\u20B9'}{order.totalAmount}</Text>
          </View>
          {order.adjustmentStatus === 'PENDING' && order.proposedTotalAmount != null && (
            <View style={styles.adjustPendingBox}>
              <Ionicons name="hourglass-outline" size={16} color={Colors.dark.warning} />
              <Text style={styles.adjustPendingText}>
                Waiting for the customer to approve the new total of {'\u20B9'}{order.proposedTotalAmount}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Progress</Text>
          <StatusTimeline currentStatus={order.status as OrderStatus} />
        </View>
      </ScrollView>

      {/* Bottom area — primary order actions stacked above Report Issue.
          One container in normal flow: the action bar used to be
          absolutely positioned and the report bar painted over it,
          hiding Accept/Reject entirely. */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + webBottomInset + 16 }]}>
        {order.status === 'NEW' && (
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.rejectBtn, pressed && { opacity: 0.8 }]}
              onPress={handleReject}
              disabled={isMutating}
            >
              {rejectMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.dark.error} />
              ) : (
                <Ionicons name="close" size={20} color={Colors.dark.error} />
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.nextStatusBtn,
                { backgroundColor: STATUS_CONFIG.ACCEPTED.color },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                isMutating && { opacity: 0.6 },
              ]}
              onPress={handleAccept}
              disabled={isMutating}
            >
              {acceptMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.nextStatusText}>Accept Order</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {order.status === 'IN_WASH' && (
          <>
            <Pressable
              style={({ pressed }) => [styles.weighBtn, pressed && { opacity: 0.85 }]}
              onPress={openWeigh}
              disabled={weighMutation.isPending}
            >
              <Ionicons name="scale-outline" size={18} color={Colors.dark.primary} />
              <Text style={styles.weighBtnText}>
                {order.adjustmentStatus === 'NONE' ? 'Weigh & Update Price' : 'Re-weigh'}
              </Text>
            </Pressable>
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.nextStatusBtn,
                  { backgroundColor: STATUS_CONFIG.READY.color },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  (readyMutation.isPending || order.adjustmentStatus === 'PENDING') && { opacity: 0.6 },
                ]}
                onPress={handleMarkReady}
                disabled={readyMutation.isPending}
              >
                {readyMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done-circle" size={20} color="#fff" />
                    <Text style={styles.nextStatusText}>
                      {order.adjustmentStatus === 'PENDING' ? 'Awaiting price approval' : 'Mark Ready'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}

        {order.status !== 'REJECTED' && order.status !== 'CANCELLED' && (
          <Pressable
            style={({ pressed }) => [styles.reportIssueBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setShowDispute(true)}
          >
            <Ionicons name="warning-outline" size={18} color={Colors.dark.warning} />
            <Text style={styles.reportIssueBtnText}>Report Issue</Text>
          </Pressable>
        )}
      </View>

      {/* ── Dispute Modal ─────────────────────────────── */}
      <Modal
        visible={showDispute}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDispute(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Issue</Text>
              <Pressable onPress={() => setShowDispute(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={Colors.dark.text} />
              </Pressable>
            </View>

            {!!disputeError && (
              <View style={styles.disputeErrorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.dark.error} />
                <Text style={styles.disputeErrorText}>{disputeError}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoriesGrid}>
              {DISPUTE_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryChip,
                    disputeCategory === cat && styles.categoryChipSelected,
                  ]}
                  onPress={() => {
                    setDisputeCategory(cat);
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                  }}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      disputeCategory === cat && styles.categoryChipTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Description</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe the issue in detail..."
              placeholderTextColor={Colors.dark.textTertiary}
              value={disputeDescription}
              onChangeText={setDisputeDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!disputeMutation.isPending}
            />

            <Pressable
              style={({ pressed }) => [
                styles.submitDisputeBtn,
                pressed && { opacity: 0.85 },
                disputeMutation.isPending && { opacity: 0.6 },
              ]}
              onPress={() => {
                if (!disputeCategory) {
                  setDisputeError('Please select a category');
                  return;
                }
                if (!disputeDescription.trim()) {
                  setDisputeError('Please provide a description');
                  return;
                }
                setDisputeError('');
                disputeMutation.mutate();
              }}
              disabled={disputeMutation.isPending}
            >
              {disputeMutation.isPending ? (
                <ActivityIndicator size="small" color="#0A0A0F" />
              ) : (
                <Text style={styles.submitDisputeBtnText}>Submit Dispute</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Weighing Modal ─────────────────────────────── */}
      <Modal
        visible={showWeigh}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWeigh(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Actual Weight</Text>
              <Pressable onPress={() => setShowWeigh(false)} hitSlop={12} disabled={weighMutation.isPending}>
                <Ionicons name="close" size={22} color={Colors.dark.text} />
              </Pressable>
            </View>

            <Text style={styles.weighHint}>
              Enter the measured quantity for each item (kg can be fractional, e.g. 2.5).
              Small changes apply instantly; increases over 20% ask the customer to approve.
            </Text>

            {!!weighError && (
              <View style={styles.disputeErrorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.dark.error} />
                <Text style={styles.disputeErrorText}>{weighError}</Text>
              </View>
            )}

            {order.items.map((item, i) =>
              item.id ? (
                <View key={item.id} style={styles.weighRow}>
                  <View style={styles.weighRowInfo}>
                    <Text style={styles.itemName}>{item.serviceName}</Text>
                    <Text style={styles.itemQty}>estimated x{item.quantity} · {'₹'}{item.price} each</Text>
                  </View>
                  <TextInput
                    style={styles.weighInput}
                    keyboardType="decimal-pad"
                    value={weights[item.id] ?? ''}
                    onChangeText={(t) => setWeights((w) => ({ ...w, [item.id!]: t.replace(',', '.') }))}
                    editable={!weighMutation.isPending}
                    placeholder="0.0"
                    placeholderTextColor={Colors.dark.textTertiary}
                  />
                </View>
              ) : null,
            )}

            <Pressable
              style={({ pressed }) => [
                styles.submitDisputeBtn,
                pressed && { opacity: 0.85 },
                weighMutation.isPending && { opacity: 0.6 },
              ]}
              onPress={submitWeights}
              disabled={weighMutation.isPending}
            >
              {weighMutation.isPending ? (
                <ActivityIndicator size="small" color="#0A0A0F" />
              ) : (
                <Text style={styles.submitDisputeBtnText}>Save Weights</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
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
  bottomArea: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.surfaceBorder,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
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
  reportIssueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.warningDim,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 176, 32, 0.3)',
  },
  reportIssueBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.dark.warning },
  weighBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    marginBottom: 10,
  },
  weighBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.dark.primary },
  weighHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  weighRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.surfaceBorder,
  },
  weighRowInfo: { flex: 1 },
  weighInput: {
    width: 96,
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  adjustPendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  adjustPendingText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.dark.warning,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: Colors.dark.text },
  disputeErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.errorDim,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.2)',
  },
  disputeErrorText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.dark.error, flex: 1 },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  categoryChipSelected: {
    backgroundColor: Colors.dark.primaryDim,
    borderColor: Colors.dark.primary,
  },
  categoryChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  categoryChipTextSelected: {
    color: Colors.dark.primary,
  },
  textArea: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.dark.text,
    minHeight: 100,
  },
  submitDisputeBtn: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitDisputeBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#0A0A0F',
  },
});
