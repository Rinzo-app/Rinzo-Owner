import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useShop } from '@/lib/shop-context';
import { patchShopSettings, submitShopDocuments } from '@/lib/api';
import { uploadShopDoc } from '@/lib/upload';

const money = (paise: number) => '₹' + (paise / 100).toFixed(0);

function docStatusMeta(s: string) {
  switch (s) {
    case 'VERIFIED': return { label: 'Verified', color: '#4ADE80' };
    case 'SUBMITTED': return { label: 'Under review', color: Colors.dark.warning };
    case 'REJECTED': return { label: 'Action needed', color: Colors.dark.error };
    default: return { label: 'Not submitted', color: Colors.dark.textSecondary };
  }
}

export default function BusinessScreen() {
  const insets = useSafeAreaInsets();
  const { settings, refreshData } = useShop();

  // ── Payout form ──
  const [method, setMethod] = useState<'BANK' | 'UPI'>(settings.payoutMethod ?? 'BANK');
  const [accName, setAccName] = useState(settings.bankAccountName ?? '');
  const [accNo, setAccNo] = useState(settings.bankAccountNumber ?? '');
  const [ifsc, setIfsc] = useState(settings.bankIfsc ?? '');
  const [upi, setUpi] = useState(settings.upiId ?? '');
  const [savingPayout, setSavingPayout] = useState(false);

  // ── Documents form ──
  const [pan, setPan] = useState(settings.panNumber ?? '');
  const [gst, setGst] = useState(settings.gstNumber ?? '');
  const [panImg, setPanImg] = useState<string | null>(settings.panImageUrl ?? null);
  const [licImg, setLicImg] = useState<string | null>(settings.licenseImageUrl ?? null);
  const [panLocal, setPanLocal] = useState<string | null>(null);
  const [licLocal, setLicLocal] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submittingDocs, setSubmittingDocs] = useState(false);

  const docMeta = docStatusMeta(settings.documentsStatus);
  const docsLocked = settings.documentsStatus === 'SUBMITTED' || settings.documentsStatus === 'VERIFIED';

  const savePayout = async () => {
    setSavingPayout(true);
    try {
      if (method === 'BANK') {
        await patchShopSettings({ payoutMethod: 'BANK', bankAccountName: accName.trim(), bankAccountNumber: accNo.trim(), bankIfsc: ifsc.trim().toUpperCase() });
      } else {
        await patchShopSettings({ payoutMethod: 'UPI', upiId: upi.trim() });
      }
      await refreshData();
      Alert.alert('Saved', 'Your payout details are saved.');
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message || 'Please try again.');
    } finally {
      setSavingPayout(false);
    }
  };

  const pickDoc = async (kind: 'pan' | 'license') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to upload.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true });
    if (res.canceled || !res.assets[0]) return;
    if (kind === 'pan') setPanLocal(res.assets[0].uri); else setLicLocal(res.assets[0].uri);
  };

  const submitDocs = async () => {
    setSubmittingDocs(true);
    try {
      const payload: any = {};
      if (pan.trim()) payload.panNumber = pan.trim().toUpperCase();
      if (gst.trim()) payload.gstNumber = gst.trim().toUpperCase();
      if (panLocal) { setUploading('pan'); payload.panImageUrl = await uploadShopDoc('pan', panLocal); }
      if (licLocal) { setUploading('license'); payload.licenseImageUrl = await uploadShopDoc('license', licLocal); }
      setUploading(null);
      if (Object.keys(payload).length === 0) { Alert.alert('Nothing to submit', 'Add a PAN/GST number or a document photo.'); return; }
      await submitShopDocuments(payload);
      await refreshData();
      setPanLocal(null); setLicLocal(null);
      Alert.alert('Submitted', 'Your business documents are under review.');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    } finally {
      setSubmittingDocs(false);
      setUploading(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={Colors.dark.text} /></Pressable>
        <Text style={styles.title}>Payout & Documents</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Balance */}
      {settings.earnings && (
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available to be paid out</Text>
          <Text style={styles.balanceValue}>{money(settings.earnings.balance)}</Text>
          <Text style={styles.balanceSub}>Earned {money(settings.earnings.earned)} · Paid {money(settings.earnings.paidOut)}</Text>
        </View>
      )}

      {/* Payout details */}
      <Text style={styles.section}>PAYOUT METHOD</Text>
      <View style={styles.toggleRow}>
        {(['BANK', 'UPI'] as const).map((m) => (
          <Pressable key={m} style={[styles.toggle, method === m && styles.toggleActive]} onPress={() => setMethod(m)}>
            <Text style={[styles.toggleText, method === m && styles.toggleTextActive]}>{m === 'BANK' ? 'Bank account' : 'UPI'}</Text>
          </Pressable>
        ))}
      </View>

      {method === 'BANK' ? (
        <>
          <Field label="Account holder name" value={accName} onChange={setAccName} />
          <Field label="Account number" value={accNo} onChange={setAccNo} keyboard="number-pad" />
          <Field label="IFSC code" value={ifsc} onChange={setIfsc} auto="characters" />
        </>
      ) : (
        <Field label="UPI ID" value={upi} onChange={setUpi} placeholder="name@bank" />
      )}

      <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]} onPress={savePayout} disabled={savingPayout}>
        {savingPayout ? <ActivityIndicator color="#0A0A0F" /> : <Text style={styles.primaryBtnText}>Save payout details</Text>}
      </Pressable>

      {/* Business documents */}
      <View style={styles.docHeader}>
        <Text style={[styles.section, { marginBottom: 0 }]}>BUSINESS DOCUMENTS</Text>
        <Text style={[styles.docStatus, { color: docMeta.color }]}>{docMeta.label}</Text>
      </View>

      {settings.documentsStatus === 'REJECTED' && settings.documentsRejectionReason && (
        <View style={styles.rejectBox}><Text style={styles.rejectText}>{settings.documentsRejectionReason}</Text></View>
      )}

      <Field label="PAN number" value={pan} onChange={setPan} auto="characters" placeholder="ABCDE1234F" editable={!docsLocked} />
      <Field label="GST number (optional)" value={gst} onChange={setGst} auto="characters" editable={!docsLocked} />

      <DocPicker label="PAN card photo" uri={panLocal || panImg} onPick={() => pickDoc('pan')} busy={uploading === 'pan'} disabled={docsLocked} />
      <DocPicker label="Shop licence / registration" uri={licLocal || licImg} onPick={() => pickDoc('license')} busy={uploading === 'license'} disabled={docsLocked} />

      {!docsLocked && (
        <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]} onPress={submitDocs} disabled={submittingDocs}>
          {submittingDocs ? <ActivityIndicator color="#0A0A0F" /> : <Text style={styles.primaryBtnText}>{settings.documentsStatus === 'REJECTED' ? 'Resubmit documents' : 'Submit for review'}</Text>}
        </Pressable>
      )}
      <Text style={styles.note}>Used to verify your business and enable payouts. Reviewed by Rinzo.</Text>
    </ScrollView>
  );
}

function Field({ label, value, onChange, keyboard, auto, placeholder, editable = true }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && { opacity: 0.5 }]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize={auto ?? 'none'}
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={Colors.dark.textTertiary}
        editable={editable}
      />
    </View>
  );
}

function DocPicker({ label, uri, onPick, busy, disabled }: any) {
  return (
    <Pressable style={styles.docPicker} onPress={onPick} disabled={disabled || busy}>
      {busy ? <ActivityIndicator size="small" color={Colors.dark.primary} /> : uri ? (
        <><Image source={{ uri }} style={styles.docThumb} /><Text style={styles.docPickText}>{disabled ? label : 'Change'}</Text></>
      ) : (
        <><Ionicons name="cloud-upload-outline" size={22} color={Colors.dark.textTertiary} /><Text style={styles.docPickText}>{label}</Text></>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 18, color: Colors.dark.text },
  balanceCard: { backgroundColor: 'rgba(0,212,170,0.08)', borderWidth: 1, borderColor: 'rgba(0,212,170,0.3)', borderRadius: 14, padding: 16, marginBottom: 20 },
  balanceLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.dark.textSecondary },
  balanceValue: { fontFamily: 'Inter_700Bold', fontSize: 28, color: '#4ADE80', marginTop: 2 },
  balanceSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.dark.textTertiary, marginTop: 4 },
  section: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.dark.textTertiary, letterSpacing: 1, marginBottom: 10, marginTop: 8 },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toggle: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.surfaceBorder, alignItems: 'center' },
  toggleActive: { borderColor: Colors.dark.primary, backgroundColor: Colors.dark.primaryDim },
  toggleText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.dark.textSecondary },
  toggleTextActive: { color: Colors.dark.primary },
  field: { marginBottom: 12 },
  fieldLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.dark.textSecondary, marginBottom: 6 },
  input: { fontFamily: 'Inter_400Regular', fontSize: 16, color: Colors.dark.text, backgroundColor: Colors.dark.surface, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.surfaceBorder },
  primaryBtn: { backgroundColor: Colors.dark.primary, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 8, marginBottom: 24 },
  primaryBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#0A0A0F' },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 10 },
  docStatus: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  rejectBox: { backgroundColor: 'rgba(255,71,87,0.08)', borderWidth: 1, borderColor: 'rgba(255,71,87,0.3)', borderRadius: 10, padding: 12, marginBottom: 12 },
  rejectText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.dark.error },
  docPicker: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.dark.surface, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.surfaceBorder, marginBottom: 12 },
  docThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.dark.surfaceElevated },
  docPickText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.dark.textSecondary },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.dark.textTertiary, lineHeight: 17 },
});
