import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { 
  Platform, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  DeviceEventEmitter, 
  Switch 
} from 'react-native';
import { getAppSettings, saveAppSettings } from '../../utils/storage';

export default function TabsLayout() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [userName, setUserName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Form States for Login
  const [inputName, setInputName] = useState('');
  const [enableAdminMode, setEnableAdminMode] = useState(false);
  const [inputPin, setInputPin] = useState('');

  const loadSettings = async () => {
    try {
      const settings = await getAppSettings();
      setUserName(settings.userName || '');
      setIsAdmin(settings.isAdmin || false);
    } catch (e) {
      console.error('Error loading layout settings:', e);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    loadSettings();

    // Listen to login/logout changes
    const subscription = DeviceEventEmitter.addListener('user-auth-change', () => {
      loadSettings();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleLogin = async () => {
    const trimmedName = inputName.trim();
    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter your name to start your journey.');
      return;
    }

    let adminFlag = false;
    if (enableAdminMode) {
      if (inputPin !== '1234') {
        Alert.alert('Invalid PIN', 'The Admin security PIN is incorrect.');
        return;
      }
      adminFlag = true;
    }

    try {
      await saveAppSettings({
        userName: trimmedName,
        isAdmin: adminFlag,
      });
      // Reset form states
      setInputName('');
      setEnableAdminMode(false);
      setInputPin('');
      
      // Update global layout states and notify app
      DeviceEventEmitter.emit('user-auth-change');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save settings.');
    }
  };

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  // Render Login UI if no username is registered
  if (!userName) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBg}>
              <Ionicons name="leaf" size={40} color="#10B981" />
            </View>
            <Text style={styles.logoText}>Breathe Free</Text>
            <Text style={styles.logoSubtitle}>Your journey to quit starts here</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Enter Your Name</Text>
            <TextInput
              style={styles.textInput}
              value={inputName}
              onChangeText={setInputName}
              placeholder="e.g. John Doe"
              placeholderTextColor="#64748B"
              autoFocus={true}
            />
          </View>

          {/* Admin Toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Enable Voice Admin Mode</Text>
              <Text style={styles.toggleDesc}>For testing/recording warnings</Text>
            </View>
            <Switch
              value={enableAdminMode}
              onValueChange={setEnableAdminMode}
              trackColor={{ false: '#1E293B', true: '#10B981' }}
              thumbColor={enableAdminMode ? '#FFFFFF' : '#94A3B8'}
            />
          </View>

          {/* Secure Admin PIN Input */}
          {enableAdminMode && (
            <View style={[styles.inputGroup, { marginTop: 10 }]}>
              <Text style={styles.inputLabel}>Admin Security PIN</Text>
              <TextInput
                style={styles.textInput}
                value={inputPin}
                onChangeText={setInputPin}
                placeholder="Hint: 1234"
                placeholderTextColor="#64748B"
                secureTextEntry={true}
                keyboardType="numeric"
              />
            </View>
          )}

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} activeOpacity={0.8}>
            <Text style={styles.loginButtonText}>Start My Journey</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render Tabs once user is authenticated
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#10B981', // Emerald green
        tabBarInactiveTintColor: '#94A3B8', // Slate gray
        tabBarStyle: {
          backgroundColor: '#0F172A', // Deep slate navy
          borderTopColor: '#1E293B',
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Tracker',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'leaf' : 'leaf-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Statistics',
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: isAdmin ? undefined : null, // dynamically hide tab if user is not admin
          title: 'Voice Admin',
          tabBarLabel: 'Voice Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'mic' : 'mic-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#090D16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginContainer: {
    flex: 1,
    backgroundColor: '#090D16',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loginCard: {
    backgroundColor: '#0F172A',
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B98115',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  logoSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#090D16',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  toggleLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleDesc: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  loginButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
