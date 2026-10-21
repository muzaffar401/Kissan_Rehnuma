import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { cropService } from '../services/cropService';
import { animalService } from '../services/animalService';
import { tokenStorage } from '../services/tokenStorage';
import type { PhotoKind, WorkflowAction, WorkflowState } from '../services/voiceWorkflow';

interface Props {
  state: WorkflowState | null;
  connected: boolean;
  sendAction: (action: WorkflowAction) => Promise<WorkflowState>;
  onRendered: (version: number) => void;
}

export default function InCallHelp({ state, connected, sendAction, onRendered }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pendingScan, setPendingScan] = useState<{ scan_id: string; kind: PhotoKind; photo_version: number } | null>(null);
  const [typingDetails, setTypingDetails] = useState(false);
  const [district, setDistrict] = useState('');
  const [description, setDescription] = useState('');
  const mounted = useRef(true);
  const currentState = useRef(state);
  currentState.current = state;
  const previousKind = useRef(state?.kind);

  useLayoutEffect(() => {
    if (state) onRendered(state.version);
  }, [state?.version, onRendered]);

  useEffect(() => {
    mounted.current = true;
    tokenStorage.getUserCity().then(city => { if (mounted.current && city) setDistrict(city); });
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (previousKind.current !== state?.kind || state?.phase === 'photo') {
      setImage(null);
      setPendingScan(null);
      setTypingDetails(false);
    }
    previousKind.current = state?.kind;
  }, [state?.kind, state?.phase]);

  const run = async (work: () => Promise<void>) => {
    if (busyRef.current || !connected) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try { await work(); }
    catch { if (mounted.current) setError(t('voiceHelp.error')); }
    finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const pick = (camera: boolean) => run(async () => {
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      setError(t('voiceHelp.cameraPermission'));
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && mounted.current) { setImage(result.assets[0]); setPendingScan(null); }
  });

  const analyze = () => run(async () => {
    if (!image || !state) return;
    const kind = state.kind;
    let scan = pendingScan;
    setAnalyzing(true);
    try {
      if (!scan) {
        const service = kind === 'crop' ? cropService : animalService;
        const result = await service.detectDisease(
          image.uri, image.fileName || 'photo.jpg', image.mimeType || 'image/jpeg', i18n.language,
        );
        scan = { scan_id: result.scan_id, kind, photo_version: state.version };
        if (!mounted.current || currentState.current?.phase !== 'photo' || currentState.current?.kind !== kind) return;
        setPendingScan(scan);
      }
      // RPC gets only a scan reference; the agent fetches the authenticated service result.
      await sendAction({ action: 'scan', ...scan });
      if (mounted.current) setPendingScan(null);
    } finally {
      if (mounted.current) setAnalyzing(false);
    }
  });

  const button = (label: string, onPress: () => void, disabled = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || busy || !connected}
      onPress={onPress} style={[styles.button, { backgroundColor: colors.primary, opacity: disabled || busy || !connected ? 0.5 : 1 }]}>
      <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  const assessment = state?.assessment;
  const assessmentReady = assessment?.status === 'completed';
  if (!state || state.phase === 'idle') return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {state.phase === 'photo' ? analyzing ? <>
        <ActivityIndicator color={colors.primary} />
        <Text accessibilityLiveRegion="polite" style={[styles.title, { color: colors.onSurface }]}>{t('voiceHelp.analyzing')}</Text>
        <Text style={{ color: colors.onSurfaceVariant }}>{t('voiceHelp.stayOnCall')}</Text>
      </> : image ? <>
          <Text style={[styles.title, { color: colors.onSurface }]}>{t('voiceHelp.preview')}</Text>
          <Image source={{ uri: image.uri }} style={styles.image} accessibilityLabel={t('voiceHelp.photo')} />
          {button(t(pendingScan ? 'voiceHelp.shareResult' : 'voiceHelp.sendPhoto'), () => { void analyze(); })}
          {button(t('voiceHelp.changePhoto'), () => { void pick(false); })}
      </> : <>
        <Text style={[styles.title, { color: colors.onSurface }]}>{t(state.kind === 'crop' ? 'voiceHelp.cropPhotoTitle' : 'voiceHelp.animalPhotoTitle')}</Text>
        <Text style={{ color: colors.onSurfaceVariant }}>{t('voiceHelp.photoHint')}</Text>
        {button(t('voiceHelp.camera'), () => { void pick(true); })}
        {button(t('voiceHelp.upload'), () => { void pick(false); })}
        {button(t('voiceHelp.noPhoto'), () => { void run(async () => { await sendAction({ action: 'skip_photo' }); }); })}
      </> : null}
      {(state.phase === 'assessment' || state.phase === 'details') && assessment ? <View style={styles.section}>
          {image ? <Image source={{ uri: image.uri }} style={styles.resultImage} accessibilityLabel={t('voiceHelp.photo')} /> : null}
          <Text style={[styles.title, { color: colors.onSurface }]}>{t('voiceHelp.assessment')}</Text>
          <Text style={{ color: colors.onSurface }}>{assessmentReady ? assessment.disease_name : t('voiceHelp.retake')}</Text>
          <Text style={{ color: colors.onSurfaceVariant }}>{t('voiceHelp.unconfirmed')}</Text>
          {state.phase === 'assessment' ? button(t('voiceHelp.expert'), () => { void run(async () => { await sendAction({ action: 'select', request_type: 'expert' }); }); }) : null}
          {!assessmentReady ? button(t('voiceHelp.changePhoto'), () => { void run(async () => { await sendAction({ action: 'photo', kind: state.kind }); }); }) : null}
      </View> : null}
      {state.phase === 'details' && state.help_type ? <View style={styles.section}>
          <Text style={{ color: colors.onSurfaceVariant }}>{t('voiceHelp.voiceDetails')}</Text>
          {typingDetails ? <>
            <TextInput accessibilityLabel={t('voiceHelp.district')} placeholder={t('voiceHelp.district')}
              placeholderTextColor={colors.onSurfaceVariant} value={district} onChangeText={setDistrict} maxLength={100}
              style={[styles.input, { borderColor: colors.onSurfaceVariant, color: colors.onSurface }]} />
            <TextInput accessibilityLabel={t('voiceHelp.description')} placeholder={t('voiceHelp.description')}
              placeholderTextColor={colors.onSurfaceVariant} value={description} onChangeText={setDescription} multiline maxLength={2000}
              style={[styles.input, { borderColor: colors.onSurfaceVariant, color: colors.onSurface }]} />
            {button(t('voiceHelp.review'), () => { void run(async () => {
              await sendAction({ action: 'prepare', draft: { request_type: state.help_type!, district: district.trim(), description: description.trim() } });
            }); }, district.trim().length < 2 || description.trim().length < 10)}
          </> : button(t('voiceHelp.typeInstead'), () => setTypingDetails(true))}
      </View> : null}
      {state.phase === 'confirmation' && state.draft ? <View style={styles.section}>
        <Text style={[styles.title, { color: colors.onSurface }]}>{t('voiceHelp.review')}</Text>
        <Text style={{ color: colors.onSurface }}>{t(`voiceHelp.${state.draft.request_type}`)} · {state.draft.district}</Text>
        <Text style={{ color: colors.onSurface }}>{state.draft.description}</Text>
        <Text style={{ color: colors.onSurfaceVariant }}>{t('voiceHelp.reviewDestination')}</Text>
        <Text style={{ color: colors.onSurfaceVariant }}>{t('voiceHelp.confirmHint')}</Text>
        {button(t('voiceHelp.confirm'), () => { void run(async () => { await sendAction({ action: 'confirm', draft_id: state.draft!.id }); }); })}
        {button(t('voiceHelp.cancel'), () => { void run(async () => { await sendAction({ action: 'cancel', draft_id: state.draft!.id }); }); })}
      </View> : null}
      {state.phase === 'submitted' && state.receipt ? <View style={styles.section}>
        <Text style={[styles.title, { color: colors.onSurface }]}>{t('voiceHelp.recorded')}</Text>
        <Text selectable style={{ color: colors.onSurface }}>{state.receipt.reference_number}</Text>
        <Text style={{ color: colors.onSurface }}>{t(`voiceHelp.status.${state.receipt.status}`)}</Text>
        <Text style={{ color: colors.onSurfaceVariant }}>{t('voiceHelp.tracking')}</Text>
      </View> : null}
      {busy && !analyzing ? <ActivityIndicator accessibilityLabel={t('voiceHelp.working')} color={colors.primary} /> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text> : null}
      {state.phase === 'submitted' || error ? button(t('voiceHelp.refresh'), () => { void run(async () => { await sendAction({ action: 'sync' }); }); }) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 600, padding: 18, borderRadius: 20, gap: 12, marginVertical: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 10, minHeight: 48, padding: 12, textAlignVertical: 'top' },
  section: { gap: 10 },
  image: { width: '100%', height: 160, borderRadius: 12, resizeMode: 'contain' },
  resultImage: { width: '100%', height: 96, borderRadius: 12, resizeMode: 'contain' },
});
