import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Modal, Dimensions, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
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

export default function AdminSettings() {
  // Voice mappings state
  const [voiceMappings, setVoiceMappings] = useState<Record<number, string>>({});
  const [currentlyPlayingSlot, setCurrentlyPlayingSlot] = useState<number | null>(null);

  // Modal states for custom cigarette warnings
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newSlotCount, setNewSlotCount] = useState('');

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

  const handlePickAudioFile = async (slotCount: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const pickedAsset = result.assets[0];
      const sourceUri = pickedAsset.uri;

      // Generate a unique file name in document directory
      const extension = pickedAsset.name.split('.').pop() || 'mp3';
      const fileName = `warning_${slotCount}_uploaded_${Date.now()}.${extension}`;
      const targetUri = `${FileSystem.documentDirectory}${fileName}`;

      // Copy file to target local directory
      await FileSystem.copyAsync({
        from: sourceUri,
        to: targetUri,
      });

      // Delete old mapping file if exists
      const oldUri = voiceMappings[slotCount];
      if (oldUri) {
        try {
          await FileSystem.deleteAsync(oldUri, { idempotent: true });
        } catch (err) {
          console.warn('Failed to delete old file:', err);
        }
      }

      // Save mapping in storage
      const updated = await saveVoiceMapping(slotCount, targetUri);
      setVoiceMappings(updated);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `Audio file "${pickedAsset.name}" successfully set for warning!`);
    } catch (e) {
      console.error('Error picking audio file:', e);
      Alert.alert('Error', 'Failed to pick or copy the audio file.');
    }
  };

  const handleActionChoice = (slotCount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Set Custom Warning Sound',
      `Choose how you want to set the Malayalam voice warning for Cigarette #${slotCount}:`,
      [
        {
          text: 'Record via Microphone',
          onPress: () => handleOpenRecorder(slotCount),
        },
        {
          text: 'Upload Audio File (MP3/M4A)',
          onPress: () => handlePickAudioFile(slotCount),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
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
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Malayalam Warning Voices</Text>
          <TouchableOpacity onPress={() => setAddModalVisible(true)} style={styles.addButton}>
            <Ionicons name="add-circle-outline" size={16} color="#10B981" style={{ marginRight: 4 }} />
            <Text style={styles.addText}>Add Warning</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSubtitle}>
          Record/upload warnings for specific cigarette thresholds, or set a general default fallback alert.
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

        {(() => {
          // Dynamic warning list: only show counts that have active recordings in voiceMappings
          const activeSlots = Object.keys(voiceMappings)
            .map(Number)
            .sort((a, b) => a - b);

          if (activeSlots.length === 0) {
            return (
              <View style={styles.emptyContainer}>
                <Ionicons name="volume-mute-outline" size={48} color="#475569" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>No Warning Voices</Text>
                <Text style={styles.emptyText}>
                  Tap "Add Warning" at the top to record or upload a Malayalam warning voice.
                </Text>
              </View>
            );
          }

          return activeSlots.map((count) => {
            const recordingUri = voiceMappings[count];
            const isPlaying = currentlyPlayingSlot === count;

            const title = count === 0 ? 'Default Fallback Alert' : `Cigarette Alert #${count}`;
            const subtitle = count === 0
              ? 'Fallback alert played for general cigarette thresholds'
              : `Alert note played when user consumes cigarette #${count} of the day`;

            return (
              <View key={count} style={styles.voiceCard}>
                <View style={styles.voiceCardHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.voiceCardTitle}>{title}</Text>
                      <View style={styles.badgeRecorded}>
                        <Text style={styles.badgeRecordedText}>Recorded</Text>
                      </View>
                    </View>
                    <Text style={styles.voiceCardSubtitle}>{subtitle}</Text>
                  </View>
                </View>

                <View style={styles.dividerLight} />

                <View style={styles.actionButtons}>
                  {recordingUri && (
                    <>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.playBtn, isPlaying && styles.playingBtn]} 
                        onPress={() => handlePlayVoice(count, recordingUri)}
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
                        onPress={() => handleDeleteVoice(count)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        <Text style={[styles.actionBtnText, { color: '#EF4444', marginLeft: 6 }]}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          });
        })()}
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

      {/* ADD CUSTOM WARNING MODAL */}
      <Modal
        visible={addModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Custom Warning</Text>
            <Text style={styles.modalSubtitle}>Enter the cigarette log number you want to trigger a warning for.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Cigarette Count Threshold</Text>
              <TextInput
                style={styles.formInput}
                value={newSlotCount}
                onChangeText={(val) => setNewSlotCount(val.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="e.g. 20"
                placeholderTextColor="#475569"
                autoFocus={true}
              />
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalDiscard]} 
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.modalBtnDiscardText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalSave]} 
                onPress={() => {
                  const countVal = parseInt(newSlotCount);
                  if (isNaN(countVal) || countVal <= 0) {
                    Alert.alert('Invalid Count', 'Please enter a valid cigarette count (greater than 0).');
                    return;
                  }
                  setAddModalVisible(false);
                  // Open action choice selector to record/upload sound for this slot
                  setTimeout(() => {
                    handleActionChoice(countVal);
                  }, 300);
                }}
              >
                <Text style={styles.modalBtnSaveText}>Next</Text>
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
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
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
    marginBottom: 16,
    lineHeight: 16,
  },
  permissionAlert: {
    flexDirection: 'row',
    backgroundColor: '#FBBF2410',
    borderColor: '#FBBF2430',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  permissionAlertTitle: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '700',
  },
  permissionAlertDesc: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  permissionButton: {
    marginTop: 8,
    backgroundColor: '#FBBF24',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  permissionButtonText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
  voiceCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  voiceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  voiceCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
    marginBottom: 4,
  },
  voiceCardSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  badgeRecorded: {
    backgroundColor: '#10B98115',
    borderColor: '#10B98130',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  badgeRecordedText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  badgeTts: {
    backgroundColor: '#3B82F615',
    borderColor: '#3B82F630',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  badgeTtsText: {
    color: '#3B82F6',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dividerLight: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginLeft: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  playBtn: {
    backgroundColor: '#10B98115',
    borderColor: '#10B98130',
  },
  playingBtn: {
    backgroundColor: '#EF444415',
    borderColor: '#EF444430',
  },
  deleteBtn: {
    backgroundColor: '#EF444410',
    borderColor: '#EF444420',
  },
  recordBtn: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  recordBtnSecondary: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
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
    lineHeight: 16,
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
    lineHeight: 14,
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
    alignSelf: 'center',
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98115',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B98130',
  },
  addText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 16,
    width: '100%',
  },
  formLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
});
