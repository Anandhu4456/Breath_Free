import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Modal, Dimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { 
  useAudioRecorder, 
  useAudioRecorderState, 
  RecordingPresets, 
  createAudioPlayer, 
  getRecordingPermissionsAsync, 
  requestRecordingPermissionsAsync 
} from 'expo-audio';
import { getVoiceMappings, saveVoiceMapping, deleteVoiceMapping } from '../../utils/storage';

const { width } = Dimensions.get('window');

const SCENARIOS = [
  { count: 1, title: '1st Cigarette', subtitle: 'Warning when user logs their first smoke of the day' },
  { count: 2, title: '2nd Cigarette', subtitle: 'Warning for the second log of the day' },
  { count: 3, title: '3rd Cigarette (Direct)', subtitle: 'Urgent warning for the third log (e.g. "myre nirth")' },
  { count: 4, title: '4th Cigarette', subtitle: 'Critical warning for the fourth smoke' },
  { count: 5, title: '5th Cigarette', subtitle: 'High-alert warning for the fifth smoke' },
  { count: 0, title: 'Default Fallback', subtitle: 'Triggered for any count that does not have a specific recording' },
];

export default function AdminSettings() {
  // Voice mappings state
  const [voiceMappings, setVoiceMappings] = useState<Record<number, string>>({});
  const [currentlyPlayingSlot, setCurrentlyPlayingSlot] = useState<number | null>(null);

  // Recording state
  const [activeRecordSlot, setActiveRecordSlot] = useState<number | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);

  // Audio player instance for previews
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);

  // Initialize the audio recorder
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const loadData = useCallback(async () => {
    try {
      const mappings = await getVoiceMappings();
      setVoiceMappings(mappings);

      // Check permission
      const { granted } = await getRecordingPermissionsAsync();
      setPermissionGranted(granted);
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }, []);

  const requestPermission = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    setPermissionGranted(granted);
    if (!granted) {
      Alert.alert('Permission Denied', 'Microphone permissions are required to record warnings.');
    }
  };



  const stopCurrentPlayer = useCallback(() => {
    if (currentPlayer) {
      currentPlayer.release();
      setCurrentPlayer(null);
    }
    setCurrentlyPlayingSlot(null);
  }, [currentPlayer]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {
        // Stop playing audio when leaving screen
        stopCurrentPlayer();
      };
    }, [loadData, stopCurrentPlayer])
  );

  const handlePlayVoice = useCallback((slotCount: number, uri: string) => {
    if (currentlyPlayingSlot === slotCount) {
      stopCurrentPlayer();
      return;
    }

    try {
      stopCurrentPlayer();
      setCurrentlyPlayingSlot(slotCount);

      const player = createAudioPlayer(uri);
      setCurrentPlayer(player);
      
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.playbackState === 'finished') {
          sub.remove();
          stopCurrentPlayer();
        }
      });

      player.play();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to play audio file');
      stopCurrentPlayer();
    }
  }, [currentlyPlayingSlot, stopCurrentPlayer]);

  const handleDeleteVoice = (slotCount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Voice Mapping',
      'Are you sure you want to delete this custom Malayalam voice alert? The app will fall back to native Malayalam Text-To-Speech.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const uri = voiceMappings[slotCount];
            if (uri) {
              try {
                // Delete file from disk
                await FileSystem.deleteAsync(uri, { idempotent: true });
              } catch (err) {
                console.warn('Failed to delete file from disk:', err);
              }
            }
            const updated = await deleteVoiceMapping(slotCount);
            setVoiceMappings(updated);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      ]
    );
  };

  // --- Recording Management ---
  const handleOpenRecorder = async (slotCount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!permissionGranted) {
      const { granted } = await requestRecordingPermissionsAsync();
      setPermissionGranted(granted);
      if (!granted) {
        Alert.alert('Permission Required', 'Please enable microphone access in settings to record audio warnings.');
        return;
      }
    }
    setHasRecorded(false);
    setActiveRecordSlot(slotCount);
  };

  const handleStartRecording = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setHasRecorded(false);
      
      // Stop current playback
      stopCurrentPlayer();

      // Ensure the recorder is prepared before recording (required in expo-audio)
      await audioRecorder.prepareToRecordAsync();

      // Configure recorder to write to cache first, we copy it on save
      await audioRecorder.record();
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Could not start recording. Make sure no other app is using the mic.');
    }
  };

  const handleStopRecording = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await audioRecorder.stop();
      setHasRecorded(true);
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  };

  const handlePreviewRecording = () => {
    if (!audioRecorder.uri) return;
    handlePlayVoice(-1, audioRecorder.uri); // Use slot -1 for temporary preview
  };

  const handleSaveRecording = async () => {
    if (activeRecordSlot === null || !audioRecorder.uri) return;

    try {
      const fileName = `warning_${activeRecordSlot}_${Date.now()}.m4a`;
      const targetUri = `${FileSystem.documentDirectory}${fileName}`;

      // Move file from cache to document directory
      await FileSystem.copyAsync({
        from: audioRecorder.uri,
        to: targetUri,
      });

      // If there was an old file, we can delete it
      const oldUri = voiceMappings[activeRecordSlot];
      if (oldUri) {
        try {
          await FileSystem.deleteAsync(oldUri, { idempotent: true });
        } catch (e) {
          console.warn('Failed to delete old file:', e);
        }
      }

      // Save mapping in storage
      const updated = await saveVoiceMapping(activeRecordSlot, targetUri);
      setVoiceMappings(updated);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Malayalam warning voice registered successfully!');
      
      // Cleanup record states
      setActiveRecordSlot(null);
      setHasRecorded(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to copy and save audio file.');
    }
  };

  const handleDiscardRecording = () => {
    setActiveRecordSlot(null);
    setHasRecorded(false);
  };

  // Utility to format ms duration into mm:ss
  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>ADMIN CONTROL PANEL</Text>
            <Text style={styles.headerTitle}>Voice Settings</Text>
          </View>
          <Ionicons name="cog-outline" size={32} color="#10B981" />
        </View>



        {/* CUSTOM MALAYALAM VOICE LIST */}
        <Text style={styles.sectionTitle}>Malayalam Warning Voices</Text>
        <Text style={styles.sectionSubtitle}>
          Record specific Malayalam warnings (slang, jokes, insults) to play when cigarette thresholds are met.
        </Text>

        {/* Permission Callout if Denied */}
        {!permissionGranted && (
          <View style={styles.permissionAlert}>
            <Ionicons name="mic-off-outline" size={24} color="#F59E0B" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.permissionAlertTitle}>Microphone Access Required</Text>
              <Text style={styles.permissionAlertDesc}>To record custom voice warnings, we need microphone access.</Text>
              <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
                <Text style={styles.permissionButtonText}>Grant Access</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {SCENARIOS.map((item) => {
          const recordingUri = voiceMappings[item.count];
          const hasRecording = !!recordingUri;
          const isPlaying = currentlyPlayingSlot === item.count;

          return (
            <View key={item.count} style={styles.voiceCard}>
              <View style={styles.voiceCardHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.voiceCardTitle}>{item.title}</Text>
                    {hasRecording ? (
                      <View style={styles.badgeRecorded}>
                        <Text style={styles.badgeRecordedText}>Recorded</Text>
                      </View>
                    ) : (
                      <View style={styles.badgeTts}>
                        <Text style={styles.badgeTtsText}>TTS Fallback</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.voiceCardSubtitle}>{item.subtitle}</Text>
                </View>
              </View>

              <View style={styles.dividerLight} />

              <View style={styles.actionButtons}>
                {hasRecording ? (
                  <>
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.playBtn, isPlaying && styles.playingBtn]} 
                      onPress={() => handlePlayVoice(item.count, recordingUri)}
                    >
                      <Ionicons 
                        name={isPlaying ? 'square' : 'play'} 
                        size={16} 
                        color={isPlaying ? '#EF4444' : '#10B981'} 
                      />
                      <Text style={[styles.actionBtnText, { color: isPlaying ? '#EF4444' : '#10B981', marginLeft: 6 }]}>
                        {isPlaying ? 'Stop' : 'Listen'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.deleteBtn]} 
                      onPress={() => handleDeleteVoice(item.count)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      <Text style={[styles.actionBtnText, { color: '#EF4444', marginLeft: 6 }]}>Delete</Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                <TouchableOpacity 
                  style={[styles.actionBtn, styles.recordBtn, hasRecording && styles.recordBtnSecondary]} 
                  onPress={() => handleOpenRecorder(item.count)}
                >
                  <Ionicons name="mic" size={16} color="#FFFFFF" />
                  <Text style={[styles.actionBtnText, { color: '#FFFFFF', marginLeft: 6 }]}>
                    {hasRecording ? 'Re-record' : 'Record Alert'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* RECORDING SYSTEM OVERLAY MODAL */}
      <Modal
        visible={activeRecordSlot !== null}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Record Malayalam Warning
            </Text>
            <Text style={styles.modalSubtitle}>
              {activeRecordSlot !== null && activeRecordSlot === 0 
                ? 'Recording fallback alert for general counts'
                : `Recording warning message for Cigarette #${activeRecordSlot}`
              }
            </Text>

            {/* Timer / Pulse Indicator */}
            <View style={styles.recorderArea}>
              {recorderState.isRecording ? (
                <View style={styles.pulseContainer}>
                  <View style={styles.pulseRing} />
                  <Text style={styles.durationText}>{formatDuration(recorderState.durationMillis)}</Text>
                  <Text style={styles.recordingIndicator}>RECORDING WARNING</Text>
                </View>
              ) : (
                <View style={styles.pulseContainer}>
                  <Text style={styles.durationText}>
                    {hasRecorded ? 'Warning Captured' : 'Ready'}
                  </Text>
                  <Text style={styles.recordingIndicatorSub}>
                    {hasRecorded ? 'Listen to preview or click Save' : 'Tap microphone to start speaking'}
                  </Text>
                </View>
              )}
            </View>

            {/* Mic trigger and Stop trigger */}
            <View style={{ alignItems: 'center', marginVertical: 20 }}>
              {recorderState.isRecording ? (
                <TouchableOpacity 
                  style={styles.micButtonActive}
                  onPress={handleStopRecording}
                >
                  <Ionicons name="square" size={32} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.micButton}
                  onPress={handleStartRecording}
                >
                  <Ionicons name="mic" size={36} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Playback preview controls if audio has been recorded */}
            {hasRecorded && !recorderState.isRecording && (
              <TouchableOpacity 
                style={styles.previewButton}
                onPress={handlePreviewRecording}
              >
                <Ionicons 
                  name={currentlyPlayingSlot === -1 ? 'stop-circle' : 'play-circle'} 
                  size={24} 
                  color="#10B981" 
                />
                <Text style={styles.previewButtonText}>
                  {currentlyPlayingSlot === -1 ? 'Stop Preview' : 'Play Recorded Sound'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Discard & Save Button row */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalDiscard]} 
                onPress={handleDiscardRecording}
              >
                <Text style={styles.modalBtnDiscardText}>Discard</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalSave, !hasRecorded && styles.modalSaveDisabled]} 
                onPress={handleSaveRecording}
                disabled={!hasRecorded}
              >
                <Text style={styles.modalBtnSaveText}>Save Audio</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 25,
  },
  sectionCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionCardDesc: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 16,
  },
  inputGroup: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 15,
  },
  permissionAlert: {
    backgroundColor: '#78350F40',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D9770630',
    flexDirection: 'row',
    marginBottom: 20,
  },
  permissionAlertTitle: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
  },
  permissionAlertDesc: {
    color: '#D97706',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  permissionButton: {
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  voiceCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
  },
  voiceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  voiceCardSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  badgeRecorded: {
    backgroundColor: '#10B98120',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeRecordedText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '700',
  },
  badgeTts: {
    backgroundColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeTtsText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
  },
  dividerLight: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  playBtn: {
    backgroundColor: '#10B98115',
  },
  playingBtn: {
    backgroundColor: '#EF444415',
  },
  deleteBtn: {
    backgroundColor: '#EF444415',
  },
  recordBtn: {
    backgroundColor: '#10B981',
  },
  recordBtnSecondary: {
    backgroundColor: '#3B82F6',
  },
  // Modal Recorder layout
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    width: width * 0.85,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    marginBottom: 20,
  },
  recorderArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    width: '100%',
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#EF444440',
    animationName: 'pulse', // Note: animations in React Native are handled through Reanimated, we use static designs for Modal simplicity
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  recordingIndicator: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 8,
  },
  recordingIndicatorSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  micButton: {
    backgroundColor: '#EF4444',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  micButtonActive: {
    backgroundColor: '#374151',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewButtonText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 8,
  },
  modalActionRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDiscard: {
    backgroundColor: '#1E293B',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalSave: {
    backgroundColor: '#10B981',
    marginLeft: 8,
  },
  modalSaveDisabled: {
    backgroundColor: '#10B98140',
  },
  modalBtnDiscardText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 14,
  },
  modalBtnSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
