import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { 
  getLogs, 
  deleteLog, 
  getAppSettings, 
  getCigaretteTypes, 
  CigaretteLog, 
  CigaretteType 
} from '../../utils/storage';

export default function History() {
  const [logs, setLogs] = useState<CigaretteLog[]>([]);
  const [settings, setSettings] = useState({ pricePerCigarette: 18, currency: '₹' });
  const [cigaretteTypes, setCigaretteTypes] = useState<CigaretteType[]>([]);
  
  // Analytics State
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [monthlyCost, setMonthlyCost] = useState(0);
  const [yearlyCount, setYearlyCount] = useState(0);
  const [yearlyCost, setYearlyCost] = useState(0);
  const [avgDaily, setAvgDaily] = useState(0);

  // Calculator State
  const [calcCigsPerDay, setCalcCigsPerDay] = useState(1);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('default');
  const [customCalcPrice, setCustomCalcPrice] = useState<string>('18');

  const loadData = async () => {
    try {
      const allLogs = await getLogs();
      const appSettings = await getAppSettings();
      const types = await getCigaretteTypes();
      
      setLogs(allLogs);
      setSettings(appSettings);
      setCigaretteTypes(types);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

      // Monthly Stats
      const mLogs = allLogs.filter(log => log.timestamp >= startOfMonth);
      setMonthlyCount(mLogs.length);
      setMonthlyCost(mLogs.reduce((sum, log) => sum + log.price, 0));

      // Yearly Stats
      const yLogs = allLogs.filter(log => log.timestamp >= startOfYear);
      setYearlyCount(yLogs.length);
      setYearlyCost(yLogs.reduce((sum, log) => sum + log.price, 0));

      // Daily Average calculation
      if (allLogs.length > 0) {
        // Find date range
        const timestamps = allLogs.map(l => l.timestamp);
        const minTime = Math.min(...timestamps);
        const maxTime = Date.now();
        const diffDays = Math.max(1, Math.ceil((maxTime - minTime) / (1000 * 60 * 60 * 24)));
        setAvgDaily(parseFloat((allLogs.length / diffDays).toFixed(1)));
      } else {
        setAvgDaily(0);
      }
    } catch (e) {
      console.error('Error loading history:', e);
    }
  };

  const getSelectedPrice = () => {
    if (selectedBrandId === 'default') {
      return settings.pricePerCigarette;
    }
    if (selectedBrandId === 'custom') {
      return parseFloat(customCalcPrice) || 0;
    }
    const brand = cigaretteTypes.find(c => c.id === selectedBrandId);
    if (brand) {
      return brand.price > 0 ? brand.price : settings.pricePerCigarette;
    }
    return settings.pricePerCigarette;
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleDeleteLog = (id: string, timestamp: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const dateStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    Alert.alert(
      'Delete Log',
      `Are you sure you want to remove the cigarette logged at ${dateStr}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteLog(id);
            setLogs(updated);
            loadData(); // Re-calculate statistics
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      {/* Scrollable top area for analytics */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>CONSUMPTION INSIGHTS</Text>
            <Text style={styles.headerTitle}>Analytics</Text>
          </View>
          <Ionicons name="analytics" size={32} color="#10B981" />
        </View>

        {/* STATS OVERVIEW CARDS */}
        <View style={styles.cardRow}>
          <View style={[styles.statCard, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.cardLabel}>THIS MONTH</Text>
            <Text style={styles.cardVal}>{monthlyCount}</Text>
            <Text style={styles.cardSubText}>Cigarettes</Text>
            <Text style={styles.cardCost}>{settings.currency}{monthlyCost.toFixed(0)}</Text>
          </View>

          <View style={[styles.statCard, { flex: 1, marginLeft: 10 }]}>
            <Text style={styles.cardLabel}>THIS YEAR</Text>
            <Text style={styles.cardVal}>{yearlyCount}</Text>
            <Text style={styles.cardSubText}>Cigarettes</Text>
            <Text style={styles.cardCost}>{settings.currency}{yearlyCost.toFixed(0)}</Text>
          </View>
        </View>

        {/* DAILY AVERAGE & GENERAL INFO CARD */}
        <View style={styles.wideCard}>
          <View style={styles.wideCardHeader}>
            <Ionicons name="speedometer" size={22} color="#10B981" />
            <Text style={styles.wideCardTitle}>Daily Habits & Savings</Text>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailVal}>{avgDaily}</Text>
              <Text style={styles.detailLabel}>Avg / Day</Text>
            </View>
            <View style={styles.vLine} />
            <View style={styles.detailItem}>
              <Text style={[styles.detailVal, { color: '#10B981' }]}>
                {settings.currency}{(avgDaily * settings.pricePerCigarette * 30).toFixed(0)}
              </Text>
              <Text style={styles.detailLabel}>Est. Monthly Cost</Text>
            </View>
            <View style={styles.vLine} />
            <View style={styles.detailItem}>
              <Text style={[styles.detailVal, { color: '#10B981' }]}>
                {settings.currency}{(avgDaily * settings.pricePerCigarette * 365).toFixed(0)}
              </Text>
              <Text style={styles.detailLabel}>Est. Yearly Cost</Text>
            </View>
          </View>
        </View>

        {/* Encouraging Quote/Insight */}
        <View style={styles.savingsCard}>
          <Ionicons name="wallet" size={24} color="#10B981" style={{ marginRight: 15 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.savingsTitle}>Think of the Future</Text>
            <Text style={styles.savingsDesc}>
              If you quit completely, you will save approximately{' '}
              <Text style={{ color: '#10B981', fontWeight: '700' }}>
                {settings.currency}{(settings.pricePerCigarette * 10 * 365).toFixed(0)}
              </Text>{' '}
              every year (based on a 10/day average). What would you buy instead?
            </Text>
          </View>
        </View>

        {/* INTERACTIVE COST CALCULATOR */}
        <Text style={styles.sectionTitle}>Cost & Savings Calculator</Text>
        <Text style={styles.sectionSubtitle}>Select intake, select a brand, or input custom price to calculate costs</Text>
        
        <View style={styles.calculatorCard}>
          {/* Cigarettes Per Day Selector */}
          <View style={styles.calcRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.calcLabel}>Daily Intake</Text>
              <Text style={styles.calcSubText}>How many per day?</Text>
            </View>
            <View style={styles.stepperContainer}>
              <TouchableOpacity 
                style={styles.stepperButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCalcCigsPerDay(c => Math.max(1, c - 1));
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{calcCigsPerDay}</Text>
              <TouchableOpacity 
                style={styles.stepperButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCalcCigsPerDay(c => c + 1);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dividerLight} />

          {/* Brand/Price Selector */}
          <Text style={styles.calcLabel}>Select Brand or Price</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandsScroll}>
            {/* Default Option */}
            <TouchableOpacity
              style={[
                styles.brandSelectCard,
                selectedBrandId === 'default' && styles.brandSelectCardActive,
                { borderColor: '#10B98130' }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedBrandId('default');
              }}
            >
              <View style={[styles.brandIconBg, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="settings-outline" size={16} color="#10B981" />
              </View>
              <Text style={styles.brandSelectName}>Default</Text>
              <Text style={styles.brandSelectPrice}>{settings.currency}{settings.pricePerCigarette}</Text>
            </TouchableOpacity>

            {/* Custom Option */}
            <TouchableOpacity
              style={[
                styles.brandSelectCard,
                selectedBrandId === 'custom' && styles.brandSelectCardActive,
                { borderColor: '#F59E0B30' }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedBrandId('custom');
              }}
            >
              <View style={[styles.brandIconBg, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="pencil-outline" size={16} color="#F59E0B" />
              </View>
              <Text style={styles.brandSelectName}>Custom</Text>
              <Text style={styles.brandSelectPrice}>
                {selectedBrandId === 'custom' ? `${settings.currency}${getSelectedPrice()}` : 'Enter Price'}
              </Text>
            </TouchableOpacity>

            {/* Loaded Brands */}
            {cigaretteTypes.map(c => {
              const priceVal = c.price > 0 ? c.price : settings.pricePerCigarette;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.brandSelectCard,
                    selectedBrandId === c.id && styles.brandSelectCardActive,
                    { borderColor: c.color + '30' }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedBrandId(c.id);
                  }}
                >
                  <View style={[styles.brandIconBg, { backgroundColor: c.color + '15' }]}>
                    <Ionicons name={c.icon as any} size={16} color={c.color} />
                  </View>
                  <Text style={styles.brandSelectName} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.brandSelectPrice}>{settings.currency}{priceVal}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Custom Price Input (conditional) */}
          {selectedBrandId === 'custom' && (
            <View style={styles.customPriceContainer}>
              <Text style={styles.customPriceLabel}>Enter Custom Price per Cigarette ({settings.currency})</Text>
              <TextInput
                style={styles.customPriceInput}
                value={customCalcPrice}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9.]/g, '');
                  setCustomCalcPrice(cleaned);
                }}
                keyboardType="numeric"
                placeholder="e.g. 20"
                placeholderTextColor="#64748B"
              />
            </View>
          )}

          <View style={styles.dividerLight} />

          {/* Results display */}
          <View style={styles.calcResultsContainer}>
            <View style={styles.calcResultBox}>
              <Text style={styles.calcResultLabel}>MONTHLY COST</Text>
              <Text style={styles.calcResultVal}>
                {settings.currency}{(calcCigsPerDay * getSelectedPrice() * 30).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Text>
              <Text style={styles.calcResultPeriod}>30 Days</Text>
            </View>
            <View style={styles.calcResultDivider} />
            <View style={styles.calcResultBox}>
              <Text style={styles.calcResultLabel}>YEARLY COST</Text>
              <Text style={[styles.calcResultVal, { color: '#EF4444' }]}>
                {settings.currency}{(calcCigsPerDay * getSelectedPrice() * 365).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Text>
              <Text style={styles.calcResultPeriod}>365 Days</Text>
            </View>
          </View>
        </View>

        {/* QUICK REFERENCE CAROUSEL/LIST */}
        <View style={styles.quickRefCard}>
          <Text style={styles.quickRefTitle}>Quick Cost Projections</Text>
          <Text style={styles.quickRefSubtitle}>Based on selected price of {settings.currency}{getSelectedPrice()}/cig</Text>
          
          <View style={styles.quickRefTable}>
            {[1, 2, 5, 10, 20].map((num) => {
              const mCost = num * getSelectedPrice() * 30;
              const yCost = num * getSelectedPrice() * 365;
              const isUserChoice = num === calcCigsPerDay;
              
              return (
                <View 
                  key={num} 
                  style={[
                    styles.quickRefRow,
                    isUserChoice && styles.quickRefRowActive
                  ]}
                >
                  <View style={styles.quickRefColQty}>
                    <Text style={[styles.quickRefQtyText, isUserChoice && styles.quickRefTextActive]}>
                      {num} {num === 1 ? 'cig' : 'cigs'} / day
                    </Text>
                  </View>
                  <View style={styles.quickRefColCost}>
                    <Text style={styles.quickRefLabelMini}>Monthly</Text>
                    <Text style={[styles.quickRefCostText, isUserChoice && styles.quickRefTextActive]}>
                      {settings.currency}{mCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                  <View style={styles.quickRefColCost}>
                    <Text style={styles.quickRefLabelMini}>Yearly</Text>
                    <Text style={[styles.quickRefCostText, { color: isUserChoice ? '#FFFFFF' : '#EF4444', fontWeight: isUserChoice ? '800' : '600' }]}>
                      {settings.currency}{yCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Activity Logs</Text>
        <Text style={styles.sectionSubtitle}>Recent entries (Tap trash icon to delete/undo)</Text>

        {logs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#475569" />
            <Text style={styles.emptyText}>No cigarettes logged yet.</Text>
            <Text style={styles.emptySubText}>Keep it that way! You are doing great.</Text>
          </View>
        ) : (
          logs.map((item) => (
            <View key={item.id} style={styles.logItem}>
              <View style={styles.logLeft}>
                <View style={styles.logBullet} />
                <View>
                  <Text style={styles.logDate}>{item.name || 'Cigarette'}</Text>
                  <Text style={styles.logTime}>{formatDate(item.timestamp)} • {formatTime(item.timestamp)}</Text>
                </View>
              </View>
              <View style={styles.logRight}>
                <Text style={styles.logPrice}>
                  {settings.currency}{item.price.toFixed(0)}
                </Text>
                <TouchableOpacity 
                  onPress={() => handleDeleteLog(item.id, item.timestamp)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  cardLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  cardVal: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  cardSubText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
  },
  cardCost: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: '700',
  },
  wideCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 20,
  },
  wideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  wideCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailVal: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  detailLabel: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  vLine: {
    width: 1,
    height: 30,
    backgroundColor: '#1E293B',
  },
  savingsCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 30,
  },
  savingsTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  savingsDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
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
    marginBottom: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  logItem: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 10,
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 14,
  },
  logDate: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  logTime: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  logRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logPrice: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 16,
  },
  deleteButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#EF444415',
  },
  // Calculator styles
  calculatorCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 20,
  },
  calcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calcLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  calcSubText: {
    color: '#64748B',
    fontSize: 12,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 16,
    minWidth: 48,
    textAlign: 'center',
  },
  dividerLight: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 16,
  },
  brandsScroll: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 4,
  },
  brandSelectCard: {
    backgroundColor: '#090D16',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 10,
    marginRight: 8,
    width: 85,
    alignItems: 'center',
  },
  brandSelectCardActive: {
    backgroundColor: '#1E293B',
    borderColor: '#10B981',
  },
  brandSelectName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  brandSelectPrice: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  brandIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customPriceContainer: {
    marginTop: 12,
    backgroundColor: '#090D16',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customPriceLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  customPriceInput: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    color: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  calcResultsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#090D16',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  calcResultBox: {
    alignItems: 'center',
    flex: 1,
  },
  calcResultLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  calcResultVal: {
    color: '#10B981',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  calcResultPeriod: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  calcResultDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#1E293B',
  },
  quickRefCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 25,
  },
  quickRefTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  quickRefSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 14,
  },
  quickRefTable: {
    width: '100%',
  },
  quickRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  quickRefRowActive: {
    backgroundColor: '#10B98115',
    borderWidth: 1,
    borderColor: '#10B98130',
  },
  quickRefColQty: {
    flex: 2,
  },
  quickRefColCost: {
    flex: 1.5,
    alignItems: 'flex-end',
  },
  quickRefQtyText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  quickRefCostText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  quickRefTextActive: {
    color: '#10B981',
    fontWeight: '800',
  },
  quickRefLabelMini: {
    color: '#64748B',
    fontSize: 9,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
