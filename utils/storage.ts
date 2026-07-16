import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CigaretteType {
  id: string;
  name: string;
  price: number;
  icon: string;  // Ionicons name
  color: string; // Theme color
  isDefault?: boolean;
}

export interface CigaretteLog {
  id: string;
  timestamp: number; // ms since epoch
  price: number;
  name: string;      // Name of cigarette brand
}

export interface VoiceMapping {
  count: number; // cigarette count (e.g. 1, 2, 3, etc.)
  uri: string;   // URI of recorded audio
}

export interface AppSettings {
  pricePerCigarette: number;
  currency: string;
  dailyGoal: number; // Goal for number of cigarettes (default 0 for quitting)
  userName: string;
  isAdmin: boolean;
}

const KEYS = {
  LOGS: 'CIGARETTE_LOGS',
  VOICES: 'VOICE_MAPPINGS',
  SETTINGS: 'APP_SETTINGS',
  TYPES: 'CIGARETTE_TYPES',
};

const DEFAULT_SETTINGS: AppSettings = {
  pricePerCigarette: 18, 
  currency: '₹',
  dailyGoal: 0,
  userName: '',
  isAdmin: false,
};

// Default brands with price = 0 initially
export const DEFAULT_CIGARETTES: CigaretteType[] = [
  { id: 'kings', name: 'Kings', price: 0, icon: 'ribbon', color: '#EF4444', isDefault: true },
  { id: 'lights', name: 'Lights', price: 0, icon: 'sunny', color: '#60A5FA', isDefault: true },
  { id: 'mixpod', name: 'Mixpod', price: 0, icon: 'apps', color: '#A78BFA', isDefault: true },
  { id: 'marlboro', name: 'Marlboro', price: 0, icon: 'flame', color: '#F87171', isDefault: true },
  { id: '555', name: '555', price: 0, icon: 'keypad', color: '#FBBF24', isDefault: true },
  { id: 'dunhill', name: 'Dunhill', price: 0, icon: 'shield-checkmark', color: '#34D399', isDefault: true },
  { id: 'players', name: 'Players', price: 0, icon: 'people', color: '#F472B6', isDefault: true },
  { id: 'gold', name: 'Gold', price: 0, icon: 'trophy', color: '#FACC15', isDefault: true },
];

// --- Cigarette Types / Brands Management ---
export async function getCigaretteTypes(): Promise<CigaretteType[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.TYPES);
    if (data) {
      return JSON.parse(data);
    }
    // Seed default brands on first launch
    await AsyncStorage.setItem(KEYS.TYPES, JSON.stringify(DEFAULT_CIGARETTES));
    return DEFAULT_CIGARETTES;
  } catch (error) {
    console.error('Error fetching cigarette types:', error);
    return DEFAULT_CIGARETTES;
  }
}

export async function addCustomCigaretteType(
  name: string, 
  price: number, 
  icon: string, 
  color: string
): Promise<CigaretteType[]> {
  const newType: CigaretteType = {
    id: 'custom_' + Math.random().toString(36).substring(2, 9),
    name,
    price,
    icon,
    color,
    isDefault: false,
  };
  try {
    const currentTypes = await getCigaretteTypes();
    const updatedTypes = [...currentTypes, newType];
    await AsyncStorage.setItem(KEYS.TYPES, JSON.stringify(updatedTypes));
    return updatedTypes;
  } catch (error) {
    console.error('Error adding custom cigarette type:', error);
    throw error;
  }
}

export async function deleteCustomCigaretteType(id: string): Promise<CigaretteType[]> {
  try {
    const currentTypes = await getCigaretteTypes();
    const updatedTypes = currentTypes.filter(t => t.id !== id);
    await AsyncStorage.setItem(KEYS.TYPES, JSON.stringify(updatedTypes));
    return updatedTypes;
  } catch (error) {
    console.error('Error deleting custom cigarette type:', error);
    return DEFAULT_CIGARETTES;
  }
}

export async function updateCigaretteTypePrice(id: string, price: number): Promise<CigaretteType[]> {
  try {
    const currentTypes = await getCigaretteTypes();
    const updatedTypes = currentTypes.map(t => {
      if (t.id === id) {
        return { ...t, price };
      }
      return t;
    });
    await AsyncStorage.setItem(KEYS.TYPES, JSON.stringify(updatedTypes));
    return updatedTypes;
  } catch (error) {
    console.error('Error updating cigarette price:', error);
    throw error;
  }
}

// --- Logs Management ---
export async function getLogs(): Promise<CigaretteLog[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.LOGS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error fetching logs:', error);
    return [];
  }
}

export async function addLog(name: string, price: number): Promise<CigaretteLog> {
  const newLog: CigaretteLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
    price: price,
    name: name,
  };
  try {
    const currentLogs = await getLogs();
    const updatedLogs = [newLog, ...currentLogs];
    await AsyncStorage.setItem(KEYS.LOGS, JSON.stringify(updatedLogs));
    return newLog;
  } catch (error) {
    console.error('Error adding log:', error);
    throw error;
  }
}

export async function deleteLog(id: string): Promise<CigaretteLog[]> {
  try {
    const currentLogs = await getLogs();
    const updatedLogs = currentLogs.filter(log => log.id !== id);
    await AsyncStorage.setItem(KEYS.LOGS, JSON.stringify(updatedLogs));
    return updatedLogs;
  } catch (error) {
    console.error('Error deleting log:', error);
    return [];
  }
}

export async function clearAllLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.LOGS);
  } catch (error) {
    console.error('Error clearing logs:', error);
  }
}

// --- Voice Mappings Management ---
export async function getVoiceMappings(): Promise<Record<number, string>> {
  try {
    const data = await AsyncStorage.getItem(KEYS.VOICES);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error fetching voice mappings:', error);
    return {};
  }
}

export async function saveVoiceMapping(count: number, uri: string): Promise<Record<number, string>> {
  try {
    const currentMappings = await getVoiceMappings();
    currentMappings[count] = uri;
    await AsyncStorage.setItem(KEYS.VOICES, JSON.stringify(currentMappings));
    return currentMappings;
  } catch (error) {
    console.error('Error saving voice mapping:', error);
    throw error;
  }
}

export async function deleteVoiceMapping(count: number): Promise<Record<number, string>> {
  try {
    const currentMappings = await getVoiceMappings();
    delete currentMappings[count];
    await AsyncStorage.setItem(KEYS.VOICES, JSON.stringify(currentMappings));
    return currentMappings;
  } catch (error) {
    console.error('Error deleting voice mapping:', error);
    return {};
  }
}

// --- Settings Management ---
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const data = await AsyncStorage.getItem(KEYS.SETTINGS);
    if (data) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error fetching app settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  try {
    const currentSettings = await getAppSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updatedSettings));
    return updatedSettings;
  } catch (error) {
    console.error('Error saving app settings:', error);
    throw error;
  }
}
