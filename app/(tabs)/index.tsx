import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Dimensions, Modal, TextInput, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { 
  getLogs, 
  addLog, 
  getAppSettings, 
  saveAppSettings,
  getVoiceMappings, 
  getCigaretteTypes, 
  addCustomCigaretteType, 
  updateCigaretteTypePrice,
  CigaretteLog, 
  CigaretteType 
} from '../../utils/storage';
import { playCigaretteAlert } from '../../utils/audio';

const { width } = Dimensions.get('window');

interface HealthProgress {
  name: string;
  durationMs: number;
  icon: keyof typeof Ionicons.prototype.state | string;
  description: string;
  color: string;
}

const HEALTH_MILESTONES: HealthProgress[] = [
  {
    name: 'Heart Rate Normalization',
    durationMs: 20 * 60 * 1000, 
    icon: 'heart',
    description: 'Blood pressure and heart rate drop back to normal.',
    color: '#EF4444',
  },
  {
    name: 'Oxygen Level Restoration',
    durationMs: 8 * 60 * 60 * 1000, 
    icon: 'water',
    description: 'Oxygen levels in the blood rise to normal.',
    color: '#3B82F6',
  },
  {
    name: 'Carbon Monoxide Clearance',
    durationMs: 12 * 60 * 60 * 1000, 
    icon: 'leaf',
    description: 'Carbon monoxide level in the blood drops to normal.',
    color: '#F59E0B',
  },
  {
    name: 'Nicotine Detoxification',
    durationMs: 48 * 60 * 60 * 1000, 
    icon: 'shield-checkmark',
    description: 'Damaged nerve endings start regrowing; taste & smell improve.',
    color: '#10B981',
  },
];

const PRESETS_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#FACC15', '#06B6D4'];
const PRESETS_ICONS = ['flame', 'star', 'leaf', 'trophy', 'skull', 'heart', 'alert-circle', 'ribbon'];

export default function Dashboard() {
  // Logs & settings state
  const [logs, setLogs] = useState<CigaretteLog[]>([]);
  const [settings, setSettings] = useState({ pricePerCigarette: 18, currency: '₹', userName: '', isAdmin: false });
  const [cigaretteTypes, setCigaretteTypes] = useState<CigaretteType[]>([]);
  
  // Daily analytics
  const [todayCount, setTodayCount] = useState(0);
  const [todayCost, setTodayCost] = useState(0);
  const [timeSinceLast, setTimeSinceLast] = useState<number | null>(null);
  const [timeString, setTimeString] = useState('Clean!');

  // Custom Brand Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customIcon, setCustomIcon] = useState('flame');
  const [customColor, setCustomColor] = useState('#EF4444');

  // Dynamic log price states
  const [logPriceModalVisible, setLogPriceModalVisible] = useState(false);
  const [selectedCigForLog, setSelectedCigForLog] = useState<CigaretteType | null>(null);
  const [logPriceInput, setLogPriceInput] = useState('');
  const [logQuantity, setLogQuantity] = useState(1);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out and change profiles?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await saveAppSettings({
                userName: '',
                isAdmin: false,
              });
              DeviceEventEmitter.emit('user-auth-change');
            } catch (e) {
              console.error(e);
            }
          }
        }
      ]
    );
  };

  const handleCardTap = (cig: CigaretteType) => {
    setSelectedCigForLog(cig);
    const lastLog = logs.find(l => l.name === cig.name);
    const prefillPrice = lastLog 
      ? lastLog.price.toString() 
      : (cig.price > 0 ? cig.price.toString() : '');
    setLogPriceInput(prefillPrice);
    setLogQuantity(1); // Reset quantity to 1
    setLogPriceModalVisible(true);
  };

  const loadData = async () => {
    try {
      const allLogs = await getLogs();
      const appSettings = await getAppSettings();
      const types = await getCigaretteTypes();
      
      setLogs(allLogs);
      setSettings(appSettings);
      setCigaretteTypes(types);

      // Filter today's logs
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayLogs = allLogs.filter(log => log.timestamp >= startOfToday.getTime());

      setTodayCount(todayLogs.length);
      setTodayCost(todayLogs.reduce((sum, log) => sum + log.price, 0));

      if (allLogs.length > 0) {
        const sorted = [...allLogs].sort((a, b) => b.timestamp - a.timestamp);
        const lastLogTime = sorted[0].timestamp;
        const diff = Date.now() - lastLogTime;
        setTimeSinceLast(diff);
      } else {
        setTimeSinceLast(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      if (timeSinceLast !== null) {
        setTimeSinceLast(prev => (prev !== null ? prev + 1000 : null));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [timeSinceLast]);

  // Translate elapsed ms to string
  useEffect(() => {
    if (timeSinceLast === null) {
      setTimeString('Smoke-Free!');
      return;
    }

    const totalSeconds = Math.floor(timeSinceLast / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let str = '';
    if (hours > 0) str += `${hours}h `;
    if (minutes > 0 || hours > 0) str += `${minutes}m `;
    str += `${seconds}s`;
    setTimeString(str);
  }, [timeSinceLast]);

  const handleLogSmoke = async (name: string, price: number, quantity: number = 1) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      // Save logs multiple times in a loop if quantity > 1
      for (let i = 0; i < quantity; i++) {
        await addLog(name, price);
      }
      
      const voiceMappings = await getVoiceMappings();
      
      // Calculate updated count for today's logs by fetching fresh logs list
      const allLogs = await getLogs();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const newTodayCount = allLogs.filter(log => log.timestamp >= startOfToday.getTime()).length;

      // Play Malayalam warning voice alert for the final count
      await playCigaretteAlert(newTodayCount, voiceMappings, settings.userName);

      loadData();
    } catch (e) {
      console.error('Error logging smoke:', e);
      Alert.alert('Error', 'Failed to log cigarette');
    }
  };

  const handleAddCustomBrand = async () => {
    const price = parseFloat(customPrice);
    if (!customName.trim()) {
      Alert.alert('Invalid Name', 'Please enter a brand name.');
      return;
    }
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid positive number for price.');
      return;
    }

    try {
      const updatedTypes = await addCustomCigaretteType(
        customName.trim(),
        price,
        customIcon,
        customColor
      );
      setCigaretteTypes(updatedTypes);
      
      // Reset form states
      setCustomName('');
      setCustomPrice('');
      setCustomIcon('flame');
      setCustomColor('#EF4444');
      setModalVisible(false);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to add custom brand.');
    }
  };

  const getProgress = (milestoneDuration: number) => {
    if (timeSinceLast === null) return 100;
    const pct = (timeSinceLast / milestoneDuration) * 100;
    return Math.min(100, Math.max(0, parseFloat(pct.toFixed(1))));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>HELLO, {settings.userName ? settings.userName.toUpperCase() : 'USER'}</Text>
          <Text style={styles.headerTitle}>Breathe Free</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Main Stat Ring Card */}
      <View style={styles.statCard}>
        <Text style={styles.timerLabel}>TIME SINCE LAST CIGARETTE</Text>
        <Text style={styles.timerValue}>{timeString}</Text>
        
        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{todayCount}</Text>
            <Text style={styles.statLabel}>Smoked Today</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{settings.currency}{todayCost.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Spent Today</Text>
          </View>
        </View>
      </View>

      {/* Brand choice grid header */}
      <Text style={styles.sectionTitle}>Log a Smoke</Text>
      <Text style={styles.sectionSubtitle}>Tap a brand below to log. (Warning: triggers voice)</Text>

      {/* Grid wrapper */}
      <View style={styles.brandGrid}>
        {cigaretteTypes.map((cig) => (
          <TouchableOpacity
            key={cig.id}
            style={[styles.cigCard, { borderColor: cig.color + '40' }]}
            activeOpacity={0.8}
            onPress={() => handleCardTap(cig)}
          >
            <View style={[styles.cigIconBg, { backgroundColor: cig.color + '15' }]}>
              <Ionicons name={cig.icon as any} size={20} color={cig.color} />
            </View>
            <Text style={styles.cigName} numberOfLines={1}>{cig.name}</Text>
            <Text style={[styles.cigPrice, { color: '#10B981', fontWeight: '700' }]}>Log</Text>
          </TouchableOpacity>
        ))}

        {/* Add custom card */}
        <TouchableOpacity
          style={[styles.cigCard, styles.addCigCard]}
          activeOpacity={0.8}
          onPress={() => setModalVisible(true)}
        >
          <View style={styles.addCigIconBg}>
            <Ionicons name="add" size={24} color="#10B981" />
          </View>
          <Text style={[styles.cigName, { color: '#10B981' }]}>Add Brand</Text>
          <Text style={styles.cigPrice}>Custom</Text>
        </TouchableOpacity>
      </View>

      {/* Motivational message depending on today's count */}
      <View style={styles.motivationCard}>
        {todayCount === 0 ? (
          <>
            <Ionicons name="ribbon" size={24} color="#10B981" />
            <Text style={styles.motivationText}>
              {`Amazing, ${settings.userName || 'friend'}! You haven't smoked today. Keep breathing that pure air.`}
            </Text>
          </>
        ) : todayCount < 3 ? (
          <>
            <Ionicons name="trending-down" size={24} color="#F59E0B" />
            <Text style={styles.motivationText}>
              {`${settings.userName || 'Hey'}, you smoked ${todayCount} cigarette${todayCount > 1 ? 's' : ''} today. Take a deep breath. You can stop right now.`}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
            <Text style={styles.motivationText}>
              {`${settings.userName || 'Hey'}, ${todayCount} cigarettes today. Your body is asking you to stop. Listen to the Malayalam warning and put it out!`}
            </Text>
          </>
        )}
      </View>

      {/* Health Milestones */}
      <Text style={styles.sectionTitle}>Body Regeneration Progress</Text>
      <Text style={styles.sectionSubtitle}>Watch your body heal in real-time since your last smoke</Text>

      {HEALTH_MILESTONES.map((milestone, idx) => {
        const progress = getProgress(milestone.durationMs);
        return (
          <View key={idx} style={styles.milestoneCard}>
            <View style={styles.milestoneHeader}>
              <View style={[styles.iconContainer, { backgroundColor: milestone.color + '20' }]}>
                <Ionicons name={milestone.icon as any} size={20} color={milestone.color} />
              </View>
              <View style={styles.milestoneTitleContainer}>
                <Text style={styles.milestoneName}>{milestone.name}</Text>
                <Text style={styles.milestoneDesc}>{milestone.description}</Text>
              </View>
              <Text style={[styles.milestonePct, { color: progress === 100 ? '#10B981' : milestone.color }]}>
                {progress}%
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${progress}%`, 
                    backgroundColor: progress === 100 ? '#10B981' : milestone.color 
                  }
                ]} 
              />
            </View>
          </View>
        );
      })}

      {/* ADD CUSTOM BRAND MODAL */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Custom Brand</Text>
            <Text style={styles.modalSubtitle}>Create a brand with its price, color and icon.</Text>

            {/* Form */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Brand Name</Text>
              <TextInput
                style={styles.formInput}
                value={customName}
                onChangeText={setCustomName}
                placeholder="e.g. Wills Classic"
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Price Per Cigarette ({settings.currency})</Text>
              <TextInput
                style={styles.formInput}
                value={customPrice}
                onChangeText={setCustomPrice}
                keyboardType="numeric"
                placeholder="20"
                placeholderTextColor="#475569"
              />
            </View>

            {/* Icon selection */}
            <Text style={styles.formLabel}>Select Brand Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsRow}>
              {PRESETS_ICONS.map((iconName) => (
                <TouchableOpacity
                  key={iconName}
                  style={[
                    styles.iconPreset,
                    customIcon === iconName && styles.iconPresetSelected,
                  ]}
                  onPress={() => setCustomIcon(iconName)}
                >
                  <Ionicons name={iconName as any} size={20} color={customIcon === iconName ? '#10B981' : '#94A3B8'} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Color Selection */}
            <Text style={styles.formLabel}>Select Brand Tag Color</Text>
            <View style={styles.colorPresetsGrid}>
              {PRESETS_COLORS.map((colorVal) => (
                <TouchableOpacity
                  key={colorVal}
                  style={[
                    styles.colorPreset,
                    { backgroundColor: colorVal },
                    customColor === colorVal && styles.colorPresetSelected,
                  ]}
                  onPress={() => setCustomColor(colorVal)}
                />
              ))}
            </View>

            {/* Modal actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalDiscard]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnDiscardText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalSave]} 
                onPress={handleAddCustomBrand}
              >
                <Text style={styles.modalBtnSaveText}>Add Brand</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DYNAMIC PRICE DIALOG MODAL ON LOGGING */}
      <Modal
        visible={logPriceModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Log {selectedCigForLog?.name}
            </Text>
            <Text style={styles.modalSubtitle}>
              Please enter the price for this cigarette.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Price ({settings.currency})</Text>
              <TextInput
                style={styles.formInput}
                value={logPriceInput}
                onChangeText={setLogPriceInput}
                keyboardType="numeric"
                placeholder="e.g. 18"
                placeholderTextColor="#475569"
                autoFocus={true}
              />
            </View>

            <View style={styles.stepperGroup}>
              <Text style={styles.formLabel}>Quantity</Text>
              <View style={styles.stepperContainer}>
                <TouchableOpacity 
                  style={styles.stepperButton}
                  onPress={() => setLogQuantity(q => Math.max(1, q - 1))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{logQuantity}</Text>
                <TouchableOpacity 
                  style={styles.stepperButton}
                  onPress={() => setLogQuantity(q => q + 1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalDiscard]} 
                onPress={() => {
                  setLogPriceModalVisible(false);
                  setSelectedCigForLog(null);
                }}
              >
                <Text style={styles.modalBtnDiscardText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalSave]} 
                onPress={async () => {
                  const price = parseFloat(logPriceInput);
                  if (isNaN(price) || price <= 0) {
                    Alert.alert('Invalid Price', 'Please enter a valid positive number for price.');
                    return;
                  }
                  if (selectedCigForLog) {
                    setLogPriceModalVisible(false);
                    
                    // Persistently update the brand's price if the user inputted a new/changed price
                    if (price !== selectedCigForLog.price) {
                      await updateCigaretteTypePrice(selectedCigForLog.id, price);
                    }
                    
                    await handleLogSmoke(selectedCigForLog.name, price, logQuantity);
                    setSelectedCigForLog(null);
                  }
                }}
              >
                <Text style={styles.modalBtnSaveText}>Log Smoke</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16', 
  },
  content: {
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
  statCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  timerLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  timerValue: {
    color: '#10B981', 
    fontSize: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    width: '100%',
    marginVertical: 20,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: '#1E293B',
    height: '100%',
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
  },
  // Brand grid styles
  brandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  cigCard: {
    backgroundColor: '#0F172A',
    width: (width - 54) / 3, // Fits exactly 3 columns with padding
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCigCard: {
    borderColor: '#10B98140',
    borderStyle: 'dashed',
    backgroundColor: '#10B98108',
  },
  cigIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  addCigIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B98115',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cigName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  cigPrice: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  motivationCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 30,
  },
  motivationText: {
    color: '#E5E7EB',
    fontSize: 13,
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  milestoneCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneTitleContainer: {
    flex: 1,
    marginLeft: 12,
    paddingRight: 8,
  },
  milestoneName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  milestoneDesc: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  milestonePct: {
    fontSize: 16,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Modal layout
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
    marginTop: 4,
    textAlign: 'center',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  iconPreset: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconPresetSelected: {
    borderColor: '#10B981',
    backgroundColor: '#10B98115',
  },
  colorPresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  colorPreset: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    marginBottom: 10,
  },
  colorPresetSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  modalActionRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 10,
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
  stepperGroup: {
    marginBottom: 20,
    alignItems: 'center',
    width: '100%',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 6,
  },
  stepperButton: {
    backgroundColor: '#334155',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginHorizontal: 24,
    minWidth: 20,
    textAlign: 'center',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF444430',
  },
});
