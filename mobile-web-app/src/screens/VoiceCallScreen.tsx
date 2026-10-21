/**
 * VoiceCallScreen — LiveKit-powered voice call with the Kissan Rehnuma AI agent.
 *
 * UI inspired by modern calling apps (WhatsApp, FaceTime, AI voice agents):
 * - Large centered avatar with animated voice rings
 * - Clear agent name, status, and call timer
 * - Bottom control bar with mute, speaker, and end-call actions
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
} from '@expo-google-fonts/be-vietnam-pro';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Room,
  RoomEvent,
  createLocalAudioTrack,
} from 'livekit-client';
import type { RemoteTrack, TrackPublication, Participant } from 'livekit-client';
import { useTheme } from '../theme/ThemeContext';
import type { ColorPalette } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { tokenStorage } from '../services/tokenStorage';
import { fetchVoiceToken } from '../services/helplineService';
import { LIVEKIT_URL } from '../services/config';
import InCallHelp from '../components/InCallHelp';
import { parseWorkflowState, WorkflowRenderTracker } from '../services/voiceWorkflow';
import type { WorkflowAction, WorkflowState } from '../services/voiceWorkflow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CallState = 'idle' | 'requesting-token' | 'connecting' | 'connected' | 'error';

interface VoiceCallScreenProps {
  onNavigate?: (screen: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VoiceCallScreen({ onNavigate }: VoiceCallScreenProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const [fontsLoaded] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  // Call state
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [callReconnecting, setCallReconnecting] = useState(false);
  const [workflowSyncFailed, setWorkflowSyncFailed] = useState(false);
  const attemptRef = useRef(0);
  const agentIdentityRef = useRef<string | null>(null);
  const audioElementsRef = useRef<HTMLMediaElement[]>([]);
  const workflowScrollRef = useRef<ScrollView>(null);
  const renderTrackerRef = useRef(new WorkflowRenderTracker());
  const onWorkflowRendered = useCallback((version: number) => {
    workflowScrollRef.current?.scrollTo({ y: 0, animated: false });
    renderTrackerRef.current.rendered(version);
  }, []);

  // Refs for cleanup
  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<ReturnType<typeof createLocalAudioTrack> extends Promise<infer T> ? T : never | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animated voice rings
  const ring1 = useRef(new Animated.Value(0.6)).current;
  const ring2 = useRef(new Animated.Value(0.6)).current;
  const ring3 = useRef(new Animated.Value(0.6)).current;

  // Animated sound bars
  const bars = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.3))
  ).current;

  // ─── Voice ring animation ───
  useEffect(() => {
    let animations: Animated.CompositeAnimation[] = [];

    if (callState === 'connecting') {
      const animateRing = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 2000,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        );

      animations = [
        animateRing(ring1, 0),
        animateRing(ring2, 700),
        animateRing(ring3, 1400),
      ];
      animations.forEach((a) => a.start());
    }

    return () => {
      animations.forEach((a) => a.stop());
    };
  }, [callState, ring1, ring2, ring3]);

  // ─── Sound bars animation ───
  useEffect(() => {
    let anims: Animated.CompositeAnimation[] = [];

    if (callState === 'connected' && agentSpeaking) {
      anims = bars.map((bar, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(bar, {
              toValue: 1,
              duration: 300 + index * 80,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(bar, {
              toValue: 0.3,
              duration: 300 + index * 80,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ),
      );
      anims.forEach((a) => a.start());
    } else {
      bars.forEach((bar) => bar.setValue(0.3));
    }

    return () => {
      anims.forEach((a) => a.stop());
    };
  }, [callState, agentSpeaking, bars]);

  // ─── Call timer ───
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callState]);

  // ─── Load farmer name for personalization ───
  useEffect(() => {
    tokenStorage.getUserName().then((name) => {
      if (name) {
        console.log('[VoiceCall] Loaded farmer name:', name);
        setUserName(name);
      }
    });
  }, []);

  // ─── Cleanup on unmount ───
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const disconnect = useCallback(async () => {
    renderTrackerRef.current.reset();
    attemptRef.current += 1;
    agentIdentityRef.current = null;
    audioElementsRef.current.forEach(element => { element.pause(); element.remove(); });
    audioElementsRef.current = [];
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (localTrackRef.current) {
      try {
        localTrackRef.current.stop();
      } catch {
        // ignore
      }
      localTrackRef.current = null;
    }

    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      try {
        await room.disconnect();
      } catch {
        // ignore
      }
    }

    setCallState('idle');
    setIsMuted(false);
    setIsSpeakerOn(true);
    setAgentSpeaking(false);
    setCallReconnecting(false);
  }, []);

  const acceptWorkflow = useCallback((payload: string) => {
    const next = parseWorkflowState(payload);
    setWorkflowSyncFailed(false);
    setWorkflow(previous => !previous || next.version >= previous.version ? next : previous);
    return next;
  }, []);

  const sendWorkflowAction = useCallback(async (action: WorkflowAction) => {
    const room = roomRef.current;
    const agent = agentIdentityRef.current;
    if (!room || !agent) throw new Error('Assistant is not connected');
    const response = await room.localParticipant.performRpc({
      destinationIdentity: agent, method: 'kissan.action', payload: JSON.stringify(action), responseTimeout: 20000,
    });
    if (roomRef.current !== room) throw new Error('Call ended');
    return acceptWorkflow(response);
  }, [acceptWorkflow]);

  const startCall = async () => {
    const attempt = ++attemptRef.current;
    setCallState('requesting-token');
    setErrorMsg('');
    setWorkflow(null);

    try {
      const { token, identity } = await fetchVoiceToken(i18n.language);
      if (attempt !== attemptRef.current) return;
      console.log('[VoiceCall] Token received, agent dispatched with farmer info and language:', i18n.language);

      setCallState('connecting');

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.localParticipant.registerRpcMethod('kissan.ui', async data => {
        const caller = room.remoteParticipants.get(data.callerIdentity);
        if (!caller?.isAgent || roomRef.current !== room) throw new Error('Untrusted UI event');
        agentIdentityRef.current = caller.identity;
        const next = parseWorkflowState(data.payload);
        const rendered = renderTrackerRef.current.waitFor(next.version);
        acceptWorkflow(data.payload);
        await rendered;
        return JSON.stringify({ received: true, version: next.version });
      });

      const syncAgent = (participant: Participant) => {
        if (!participant.isAgent || roomRef.current !== room) return;
        agentIdentityRef.current = participant.identity;
        void sendWorkflowAction({ action: 'sync' }).catch(() => setWorkflowSyncFailed(true));
      };
      room.on(RoomEvent.ParticipantConnected, syncAgent);
      room.on(RoomEvent.Reconnecting, () => setCallReconnecting(true));
      room.on(RoomEvent.Reconnected, () => {
        setCallReconnecting(false);
        room.remoteParticipants.forEach(syncAgent);
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) {
          void disconnect().then(() => {
            setErrorMsg(t('voiceCall.callFailed'));
            setCallState('error');
          });
        }
      });

      room.on(RoomEvent.TrackSubscribed, (_track: RemoteTrack, publication: TrackPublication, participant: Participant) => {
        if (roomRef.current !== room) return;
        console.log('[VoiceCall] Track subscribed:', publication.source, participant.identity);
        if (publication.kind === 'audio' && _track) {
          if (Platform.OS === 'web') {
            const element = _track.attach();
            audioElementsRef.current.push(element);
            void element.play().catch(() => { /* Browser may require the user's audio gesture. */ });
          }
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, track => {
        if (Platform.OS === 'web') track.detach().forEach(element => {
          element.pause();
          element.remove();
          audioElementsRef.current = audioElementsRef.current.filter(item => item !== element);
        });
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const agentSpeakingNow = speakers.some(
          (p) => p.identity !== identity && p.isSpeaking,
        );
        setAgentSpeaking(agentSpeakingNow);
      });

      await room.connect(LIVEKIT_URL, token);
      if (attempt !== attemptRef.current) { await room.disconnect(); return; }
      room.remoteParticipants.forEach(syncAgent);

      const localTrack = await createLocalAudioTrack();
      if (attempt !== attemptRef.current) { localTrack.stop(); await room.disconnect(); return; }
      localTrackRef.current = localTrack as any;
      await room.localParticipant.publishTrack(localTrack);

      setCallState('connected');
    } catch (err) {
      if (attempt !== attemptRef.current) return;
      await disconnect();
      console.error('[VoiceCall] Connection failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Call failed');
      setCallState('error');
    }
  };

  const endCall = async () => {
    await disconnect();
    onNavigate?.('helpline');
  };

  const toggleMute = async () => {
    try {
      const localTrack = localTrackRef.current as any;
      if (!localTrack) return;

      if (isMuted) {
        await localTrack.unmute();
      } else {
        await localTrack.mute();
      }
      setIsMuted(!isMuted);
    } catch (err) {
      console.error('[VoiceCall] Failed to toggle mute:', err);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    // Actual speaker routing is platform-specific and handled by the OS.
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryContainer }]} edges={['top', 'bottom']}>
        <View />
      </SafeAreaView>
    );
  }

  // ─── Status text ───
  const getStatusText = () => {
    switch (callState) {
      case 'idle':
        return t('voiceCall.tapToStart');
      case 'requesting-token':
        return t('voiceCall.connectingServer');
      case 'connecting':
        return t('voiceCall.joiningRoom');
      case 'connected':
        return agentSpeaking ? t('voiceCall.agentSpeaking') : t('voiceCall.listening');
      case 'error':
        return errorMsg || t('voiceCall.callFailed');
    }
  };

  const isConnecting = callState === 'requesting-token' || callState === 'connecting';
  const hasWorkflowCard = !!workflow && workflow.phase !== 'idle';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryContainer }]} edges={['top', 'bottom']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={endCall}>
          <MaterialCommunityIcons name="chevron-down" size={28} color={colors.onPrimary} />
        </Pressable>
        <Text style={styles.topBarTitle}>{t('voiceCall.title')}</Text>
        {callState === 'connected' ? <Pressable style={styles.iconBtn} accessibilityRole="button"
          accessibilityLabel={t('voiceHelp.connect')} onPress={() => {
            void sendWorkflowAction({ action: 'sync' }).catch(() => setWorkflowSyncFailed(true));
          }}>
          <MaterialCommunityIcons name="refresh" size={22} color={colors.onPrimary} />
        </Pressable> : <View style={styles.iconBtn} />}
      </View>

      {/* Main content */}
      <ScrollView ref={workflowScrollRef} style={{ flex: 1 }}
        contentContainerStyle={[styles.content, hasWorkflowCard && { justifyContent: 'flex-start', paddingTop: 12 }]}
        keyboardShouldPersistTaps="handled">
        {/* Avatar with animated rings */}
        {!hasWorkflowCard ? <View style={styles.avatarWrapper}>
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [{ scale: ring1 }],
                opacity: callState === 'connecting' ? 0.25 : 0,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [{ scale: ring2 }],
                opacity: callState === 'connecting' ? 0.2 : 0,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [{ scale: ring3 }],
                opacity: callState === 'connecting' ? 0.15 : 0,
              },
            ]}
          />
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="headset" size={56} color={colors.onPrimary} />
          </View>
        </View> : null}

        {/* Agent info */}
        <View style={[styles.infoContainer, hasWorkflowCard && { marginBottom: 0, gap: 4 }]}>
          <Text style={[styles.agentName, hasWorkflowCard && { fontSize: 18 }]}>{t('voiceCall.agentName')}</Text>
          {userName ? (
            <Text style={styles.callingAsText}>{t('voiceCall.callingAs', { name: userName })}</Text>
          ) : null}
          <View style={styles.statusRow}>
            {isConnecting && (
              <ActivityIndicator size="small" color={colors.onPrimary} style={styles.spinner} />
            )}
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
          {callState === 'connected' && (
            <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
          )}
          {workflowSyncFailed ? <Text style={styles.statusText}>{t('voiceHelp.syncError')}</Text> : null}
        </View>

        {callState === 'connected' ? <InCallHelp key={attemptRef.current} state={workflow}
          connected={!callReconnecting} sendAction={sendWorkflowAction} onRendered={onWorkflowRendered} /> : null}

        {/* Sound wave visualizer (shown when connected) */}
        {callState === 'connected' && (
          <View style={styles.waveContainer}>
            {bars.map((bar, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.waveBar,
                  {
                    transform: [{ scaleY: bar }],
                    opacity: agentSpeaking ? 1 : 0.4,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom controls */}
      <View style={[styles.controls, callState === 'connected' && { paddingTop: 8, paddingBottom: 12, gap: 8 }]}>
        {callState === 'connected' ? (
          <>
            {/* Row 1: Mute + Speaker */}
            <View style={styles.controlsRow}>
              <Pressable
                style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                onPress={toggleMute}
              >
                <MaterialCommunityIcons
                  name={isMuted ? 'microphone-off' : 'microphone'}
                  size={28}
                  color={isMuted ? colors.primary : colors.onSurfaceVariant}
                />
                <Text style={styles.controlLabel}>{isMuted ? t('voiceCall.unmute') : t('voiceCall.mute')}</Text>
              </Pressable>

              <Pressable
                style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
                onPress={toggleSpeaker}
              >
                <MaterialCommunityIcons
                  name={isSpeakerOn ? 'volume-high' : 'volume-off'}
                  size={28}
                  color={isSpeakerOn ? colors.primary : colors.onSurfaceVariant}
                />
                <Text style={styles.controlLabel}>{t('voiceCall.speaker')}</Text>
              </Pressable>
            </View>

            {/* End call button */}
            <Pressable style={[styles.endCallBtn, { height: 48 }]} onPress={endCall}>
              <MaterialCommunityIcons name="phone-hangup" size={32} color={colors.onPrimary} />
              <Text style={styles.endCallText}>{t('voiceCall.endCall')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={[styles.startCallBtn, callState === 'error' && styles.startCallBtnError]}
              onPress={startCall}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <MaterialCommunityIcons name="phone" size={28} color={colors.onPrimary} />
              )}
              <Text style={styles.startCallText}>
                {callState === 'error' ? t('voiceCall.tryAgain') : t('voiceCall.callNow')}
              </Text>
            </Pressable>
            {callState === 'idle' && (
              <Text style={styles.hintText}>{t('voiceCall.hintText')}</Text>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 56,
  },
  iconBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  topBarTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: colors.onPrimary,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  ring: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.onPrimary,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  infoContainer: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  agentName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    fontWeight: '700',
    color: colors.onPrimary,
    textAlign: 'center',
  },
  callingAsText: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 15,
    fontWeight: '500',
    color: colors.onPrimary,
    opacity: 0.85,
    textAlign: 'center',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spinner: {
    marginRight: 4,
  },
  statusText: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 16,
    fontWeight: '500',
    color: colors.onPrimary,
    opacity: 0.9,
    textAlign: 'center',
  },
  timerText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: colors.onPrimary,
    opacity: 0.85,
    marginTop: 4,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    marginTop: 8,
  },
  waveBar: {
    width: 6,
    height: 32,
    borderRadius: 3,
    backgroundColor: colors.onPrimary,
  },
  controls: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingTop: 16,
    gap: 20,
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  controlBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  controlBtnActive: {
    backgroundColor: colors.secondaryContainer,
  },
  controlLabel: {
    fontFamily: 'BeVietnamPro_500Medium',
    fontSize: 12,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  startCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 64,
    paddingHorizontal: 48,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  startCallBtnError: {
    backgroundColor: colors.error,
  },
  startCallText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  hintText: {
    fontFamily: 'BeVietnamPro_400Regular',
    fontSize: 14,
    fontWeight: '400',
    color: colors.onPrimary,
    opacity: 0.75,
    textAlign: 'center',
    marginTop: 4,
  },
  endCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 64,
    paddingHorizontal: 48,
    borderRadius: 9999,
    backgroundColor: colors.error,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  endCallText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
