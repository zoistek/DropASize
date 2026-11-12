import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, BackHandler, Linking, PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import appHtml from './web/appHtml';
import * as SplashScreen from 'expo-splash-screen';
import { readDailySteps } from './native/healthSteps';
import Purchases from 'react-native-purchases';
import { createTestBilling } from './native/revenueCat';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-media-library';
import { saveGalleryImage } from './native/saveImage';
const testBilling = createTestBilling(Purchases, { allowTestStore: __DEV__ });

SplashScreen.preventAutoHideAsync().catch(() => {});

// The app's own address inside the phone. It never loads from the internet;
// it just gives the page a stable home so its saved data stays put.
const BASE_URL = 'https://app.nourishthrive.local/';
const BG = '#F4F6F2';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function isOwnPage(url) {
  return !url || url === 'about:blank' || url.startsWith(BASE_URL) || url.startsWith('data:') || url.startsWith('blob:');
}

// Reminders the page asks for (like "1 hour to go" on a fast) are scheduled on the phone,
// so they arrive even when the app is closed.
async function ensurePermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders', importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

// Photos come from Android's system photo picker: no gallery or camera permission needed.
async function pickPhoto(id, web) {
  const send = (dataUrl) => web && web.injectJavaScript(`window.ntPicked&&window.ntPicked(${JSON.stringify(id)},${JSON.stringify(dataUrl)});true;`);
  try {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets || !res.assets[0]) return send(null);
    const a = res.assets[0];
    const ctx = ImageManipulator.manipulate(a.uri);
    if ((a.width || 0) > 1600) ctx.resize({ width: 1600 });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
    send('data:image/jpeg;base64,' + out.base64);
  } catch {
    send(null);
  }
}

// Google won't sign in inside a web view, so open it in a secure browser tab
// and pass the login back to the page when Google returns to dropasize://auth.
async function googleSignIn(url, web) {
  let hash = '';
  try {
    if (typeof url === 'string' && url.startsWith('https://jzctsfvowmuowfxaiayy.supabase.co/auth/v1/authorize')) {
      const res = await WebBrowser.openAuthSessionAsync(url, 'dropasize://auth');
      if (res.type === 'success' && res.url) {
        const i = res.url.indexOf('#');
        hash = i >= 0 ? res.url.slice(i + 1) : '';
      }
    }
  } catch {}
  if (web) web.injectJavaScript(`window.ntOAuth&&window.ntOAuth(${JSON.stringify(hash)});true;`);
}

// Health Connect (Android only): read daily step totals, nothing else.
// Loaded lazily: the native module is missing in Expo Go and on iPhone.
function hcLib() {
  if (Platform.OS !== 'android') return null;
  try { return require('react-native-health-connect'); } catch { return null; }
}
const STEPS = [{ accessType: 'read', recordType: 'Steps' }];

async function hcStatus() {
  const HC = hcLib();
  if (!HC) return 'none';
  try {
    const s = await HC.getSdkStatus();
    return s === HC.SdkAvailabilityStatus.SDK_AVAILABLE ? 'ok'
      : s === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ? 'update' : 'none';
  } catch { return 'none'; }
}

async function healthConnect(action, web) {
  const send = (r) => web && web.injectJavaScript(`window.ntHCResult&&window.ntHCResult(${JSON.stringify(r)});true;`);
  const status = await hcStatus();
  if (action === 'status') return send({ action, status });
  if (action === 'install') {
    Linking.openURL('market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding').catch(() => {});
    return send({ action, status });
  }
  if (status !== 'ok') return send({ action, status, error: 'unavailable' });
  const HC = hcLib();
  try {
    await HC.initialize();
    if (action === 'settings') { HC.openHealthConnectSettings(); return send({ action, status }); }
    // Revoking only takes full effect after the app restarts; the page stops syncing straight away.
    if (action === 'disconnect') { await HC.revokeAllPermissions().catch(() => {}); return send({ action, status }); }
    if (action === 'connect') await HC.requestPermission(STEPS);
    if (action === 'connect' || action === 'sync') return send({ action, status, ...(await readDailySteps(HC)) });
  } catch (e) {
    send({ action, status, error: String((e && e.message) || e).slice(0, 200) });
  }
}

async function handleMessage(raw, web, reload) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }
  if (!msg || typeof msg.id !== 'string') return;
  if (msg.type === 'save-image') {
    let result={id:msg.id};
    try { await saveGalleryImage(msg,{FileSystem,Asset,Platform,PermissionsAndroid}); }
    catch(error) { result.error=error.message||'Couldn’t save this image.'; }
    if(web)web.injectJavaScript(`window.ntSavedImage&&window.ntSavedImage(${JSON.stringify(result)});true;`);
    return;
  }
  if (msg.type === 'revenuecat') {
    let result;
    try { result = { id: msg.id, ...(await testBilling(msg)) }; }
    catch (error) { result = { id: msg.id, userId: msg.userId, cancelled: !!error.userCancelled, error: error.userCancelled ? 'Purchase cancelled.' : String(error.message || 'Subscriptions are unavailable. Please try again.') }; }
    if (web) web.injectJavaScript(`window.ntBillingResult&&window.ntBillingResult(${JSON.stringify(result)});true;`);
    return;
  }
  if (msg.type === 'reload') { reload(); return; }
  if (msg.type === 'pick') { await pickPhoto(msg.id, web); return; }
  if (msg.type === 'google') { await googleSignIn(msg.url, web); return; }
  if (msg.type === 'hc') { await healthConnect(String(msg.action), web); return; }
  if (msg.type === 'cancel') {
    await Notifications.cancelScheduledNotificationAsync(msg.id).catch(() => {});
    return;
  }
  if (msg.type === 'notify') {
    const at = Number(msg.at);
    if (!at || at <= Date.now()) return;
    if (!(await ensurePermission())) return;
    await Notifications.cancelScheduledNotificationAsync(msg.id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: msg.id,
      content: { title: String(msg.title || 'DropASize').slice(0, 80), body: String(msg.body || '').slice(0, 240) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: 'reminders' },
    });
  }
}

export default function App() {
  const webRef = useRef(null);
  const [webKey, setWebKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);
  const reload = () => { canGoBack.current = false; setLoading(true); setWebKey(k => k + 1); };
  const canGoBack = useRef(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  // Back in the foreground: let the page re-sync Health Connect steps if it is connected.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && webRef.current) webRef.current.injectJavaScript('window.ntHCForeground&&window.ntHCForeground();true;');
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']} onLayout={() => { SplashScreen.hideAsync().catch(() => {}); }}>
        <StatusBar style="dark" />
        <WebView
          key={webKey}
          ref={webRef}
          onLoadEnd={() => { setLoading(false); SplashScreen.hideAsync().catch(() => {}); }}
          style={styles.web}
          originWhitelist={['*']}
          source={{ html: appHtml, baseUrl: BASE_URL }}
          javaScriptEnabled
          injectedJavaScriptBeforeContentLoaded={'window.NT_GALLERY_SAVE=true;true;'}
          domStorageEnabled
          allowFileAccess
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          overScrollMode="never"
          onMessage={(e) => { handleMessage(e.nativeEvent.data, webRef.current, reload).catch(() => {}); }}
          onNavigationStateChange={(s) => { canGoBack.current = s.canGoBack; }}
          onShouldStartLoadWithRequest={(req) => {
            if (isOwnPage(req.url)) return true;
            // Shop links, email links and so on open in the phone's own apps.
            Linking.openURL(req.url).catch(() => {});
            return false;
          }}
        />
        {loading && <View style={styles.loading} accessibilityLabel="Loading DropASize">
          <Animated.Image source={require('./assets/icon.png')} style={{ width: 180, height: 180, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.04] }) }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }} />
          <Text style={styles.loadingText}>Preparing your day…</Text>
        </View>}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#0E351D', fontSize: 16, fontWeight: '600' },
  screen: { flex: 1, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
});
