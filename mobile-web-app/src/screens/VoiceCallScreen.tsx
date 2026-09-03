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
import { tokenStorage } from '../services/tokenStorage';
import { fetchVoiceToken, generateRoomName } from '../services/helplineService';
import { LIVEKIT_URL } from '../services/config';

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

    if (callState === 'connected') {
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

    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch {
        // ignore
      }
      roomRef.current = null;
    }

    setCallState('idle');
    setIsMuted(false);
    setIsSpeakerOn(true);
    setAgentSpeaking(false);
  }, []);

  const startCall = async () => {
    setCallState('requesting-token');
    setErrorMsg('');

    try {
      const farmerId = await tokenStorage.getUserId();
      let farmerName = await tokenStorage.getUserName();

      // If name is still missing, warn but keep going with a friendly default
      if (!farmerName) {
        console.warn('[VoiceCall] Farmer name not found in storage/JWT');
      }

      const roomName = generateRoomName();
      const identity = farmerId ?? 'anonymous_farmer';

      console.log('[VoiceCall] Starting call:', { farmerId, farmerName, roomName });

      const { token } = await fetchVoiceToken(identity, roomName, farmerId, farmerName ?? null);
      console.log('[VoiceCall] Token received, agent dispatched with farmer info');

      setCallState('connecting');

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (_track: RemoteTrack, publication: TrackPublication, participant: Participant) => {
        console.log('[VoiceCall] Track subscribed:', publication.source, participant.identity);
        if (publication.kind === 'audio' && _track) {
          (_track as any).attach?.();
        }
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const agentSpeakingNow = speakers.some(
          (p) => p.identity !== identity && p.isSpeaking,
        );
        setAgentSpeaking(agentSpeakingNow);
      });

      await room.connect(LIVEKIT_URL, token);

      const localTrack = await createLocalAudioTrack();
      localTrackRef.current = localTrack as any;
      await room.localParticipant.publishTrack(localTrack);

      setCallState('connected');
    } catch (err) {
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryContainer }]} edges={['top', 'bottom']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={endCall}>
          <MaterialCommunityIcons name="chevron-down" size={28} color={colors.onPrimary} />
        </Pressable>
        <Text style={styles.topBarTitle}>{t('voiceCall.title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {/* Avatar with animated rings */}
        <View style={styles.avatarWrapper}>
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [{ scale: ring1 }],
                opacity: callState === 'connected' ? 0.25 : 0,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [{ scale: ring2 }],
                opacity: callState === 'connected' ? 0.2 : 0,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [{ scale: ring3 }],
                opacity: callState === 'connected' ? 0.15 : 0,
              },
            ]}
          />
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="headset" size={56} color={colors.onPrimary} />
          </View>
        </View>

        {/* Agent info */}
        <View style={styles.infoContainer}>
          <Text style={styles.agentName}>{t('voiceCall.agentName')}</Text>
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
        </View>

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
      </View>

      {/* Bottom controls */}
      <View style={styles.controls}>
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
            <Pressable style={styles.endCallBtn} onPress={endCall}>
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
    flex: 1,
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
