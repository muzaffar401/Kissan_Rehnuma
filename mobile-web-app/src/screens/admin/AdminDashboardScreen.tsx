/**
 * Admin Dashboard — kissan-admin UI with dark/light theme.
 * Mobile-first drawer layout with lucide icons, card-based lists, hero stats.
 * Connected to the real admin-service API.
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl,
  Animated, Easing, Image, Modal
} from 'react-native';
import {
  useFonts,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
} from '@expo-google-fonts/be-vietnam-pro';
import {
  LayoutGrid, Users, Leaf, PawPrint, Phone, MessagesSquare, ScrollText,
  Menu, X, LogOut, Search, SlidersHorizontal, ChevronRight, ChevronDown,
  TrendingUp, MessageCircleWarning, UserPlus, Sun, Moon, ChevronLeft,
  Pencil, Trash2, UserCheck, UserX, MoreVertical,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import {
  adminLogout, setOnAuthChange,
  getDashboard, getUsers, getCropScans, getAnimalScans,
  getVoiceSessions, getConversations, getAuditLog,
  getComplaints, getComplaintEvents, updateComplaintStatus, getFarmerDetail,
  updateUser, toggleUserStatus,
} from '../../services/adminService';

// ── Theme-aware color palette ─────────────────────────────────────────────────
function useAdminColors() {
  const { isDark } = useTheme();
  return useMemo(() => isDark ? ({
    crop: '#3E6647', cropLight: '#5A8A65',
    wheat: '#D4A843', wheatLight: '#E4BE5F',
    soil: '#12130F', soilCard: '#1E1F1A', soilLine: '#2E302A',
    clay: '#C95A3A', clayLight: '#3D2520',
    ink: '#E6E2D9', inkMuted: '#9AA093', inkFaint: '#6B7364',
    sky: '#5A9BBE', skyLight: '#1E2E38',
    drawerBg: '#1A2E1E',
  } as const) : ({
    crop: '#26472C', cropLight: '#3E6647',
    wheat: '#C99A2E', wheatLight: '#E4BE5F',
    soil: '#F6F3EC', soilCard: '#FFFFFF', soilLine: '#E6E1D4',
    clay: '#B3492B', clayLight: '#F3E0D8',
    ink: '#1E2A1F', inkMuted: '#6B7364', inkFaint: '#9AA093',
    sky: '#3E6E8E', skyLight: '#DCE9F0',
    drawerBg: '#26472C',
  } as const), [isDark]);
}

type Section = 'dashboard' | 'users' | 'crops' | 'animals' | 'complaints';
type Tint = 'crop' | 'wheat' | 'sky' | 'clay';
type Colors = ReturnType<typeof useAdminColors>;
interface Props { onLogout: () => void; }

const NAV = [
  { name: 'dashboard' as Section,     label: 'Dashboard',      icon: LayoutGrid },
  { name: 'users' as Section,         label: 'Users',           icon: Users },
  { name: 'crops' as Section,         label: 'Crop Scans',      icon: Leaf },
  { name: 'animals' as Section,       label: 'Animal Scans',    icon: PawPrint },
  { name: 'complaints' as Section,    label: 'Complaints',      icon: MessageCircleWarning },
];

function tintSoft(C: Colors): Record<Tint, string> {
  return {
    crop: C.crop + '1A', wheat: C.wheat + '2E',
    sky: C.sky + '1A', clay: C.clay + '1A',
  };
}
function tintIcon(C: Colors): Record<Tint, string> {
  return { crop: C.crop, wheat: C.crop, sky: C.sky, clay: C.clay };
}
function badgeBg(C: Colors): Record<string, string> {
  return { crop: C.crop + '1A', wheat: C.wheat + '2E', clay: C.clay + '1A', sky: C.sky + '1A' };
}
function badgeClr(C: Colors): Record<string, string> {
  return { crop: C.crop, wheat: C.wheat, clay: C.clay, sky: C.sky };
}

const DRAWER_W = 280;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminDashboardScreen({ onLogout }: Props) {
  const { isDark, toggleTheme } = useTheme();
  const C = useAdminColors();
  const [section, setSection] = useState<Section>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerX = useRef(new Animated.Value(-DRAWER_W)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
    BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold,
  });

  useEffect(() => {
    setOnAuthChange(() => onLogout());
    return () => setOnAuthChange(null);
  }, [onLogout]);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(drawerX, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0.45, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(drawerX, { toValue: -DRAWER_W, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  }, []);

  const go = (s: Section) => { setSection(s); closeDrawer(); };
  const ts = tintSoft(C), ti = tintIcon(C);

  if (!fontsLoaded) return <View style={[{ flex: 1, backgroundColor: C.soil }]} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.soil }}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: C.soilCard, borderBottomColor: C.soilLine }]}>
        <Pressable onPress={openDrawer} hitSlop={10} style={styles.headerBtn}>
          <Menu size={22} color={C.ink} />
        </Pressable>
        <Pressable onPress={toggleTheme} hitSlop={10} style={styles.headerBtn}>
          {isDark ? <Sun size={20} color={C.wheat} /> : <Moon size={20} color={C.ink} />}
        </Pressable>
      </View>

      {/* ── Content ── */}
      <View style={{ flex: 1 }}>
        {section === 'dashboard'     && <DashboardSection C={C} onNav={go} />}
        {section === 'users'         && <UsersSection C={C} />}
        {section === 'crops'         && <ScansSection C={C} type="crop" />}
        {section === 'animals'       && <ScansSection C={C} type="animal" />}
        {section === 'complaints'    && <ComplaintsSection C={C} />}
      </View>

      {/* ── Backdrop (animated) ── */}
      {drawerOpen && (
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isDark ? 'rgba(0,0,0,1)' : 'rgba(23,48,25,1)', opacity: backdropOpacity, zIndex: 45 }}>
          <Pressable style={{ flex: 1 }} onPress={closeDrawer} />
        </Animated.View>
      )}

      {/* ── Sidebar drawer (animated) ── */}
      <Animated.View style={[styles.drawer, { backgroundColor: C.drawerBg, transform: [{ translateX: drawerX }] }]}>
        <View style={styles.drawerTop}>
          <View>
            <Text style={styles.drawerH}>Kissan Admin</Text>
            <Text style={styles.drawerSub}>Field operations control</Text>
          </View>
          <Pressable onPress={closeDrawer} hitSlop={10} style={styles.drawerX}>
            <X size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={{ flex: 1, gap: 2, paddingHorizontal: 12 }}>
          {NAV.map((item) => {
            const active = section === item.name;
            const Icon = item.icon;
            return (
              <Pressable key={item.name} onPress={() => go(item.name)}
                style={[styles.navItem, active && styles.navItemActive]}>
                <View style={[styles.navDot, active && { backgroundColor: C.wheatLight }]} />
                <Icon size={19} color={active ? C.wheatLight : 'rgba(255,255,255,0.75)'} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.drawerFoot, { borderTopColor: 'rgba(255,255,255,0.10)' }]}>
          <Pressable onPress={() => { adminLogout(); onLogout(); }} style={styles.navItem}>
            <LogOut size={19} color="rgba(255,255,255,0.75)" />
            <Text style={styles.navLabel}>Sign Out</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardSection({ C, onNav }: { C: Colors; onNav: (s: Section) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await getDashboard()); } catch (e) { console.error(e); }
    setLoading(false); setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={C.crop} /></View>;

  const fmt = (n: number) => n?.toLocaleString() ?? '0';
  const ti = tintIcon(C);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

      {/* Overview */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={[styles.secLabel, { color: C.ink }]}>Overview</Text>

        {/* Hero stat */}
        <View style={[styles.hero, { backgroundColor: C.crop }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.heroLabel}>Total Farmers</Text>
              <Text style={styles.heroVal}>{fmt(data?.total_farmers)}</Text>
            </View>
            <View style={styles.heroIcon}>
              <Users size={22} color={C.wheatLight} />
            </View>
          </View>
          {(data?.today?.new_farmers ?? 0) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <TrendingUp size={14} color={C.wheatLight} />
              <Text style={[styles.heroTrend, { color: C.wheatLight }]}>+{data.today.new_farmers} today</Text>
            </View>
          )}
        </View>

        {/* 2×2 compact stats */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <CompactStat C={C} icon={Leaf} label="Crop Scans" value={fmt(data?.total_crop_scans)} tint="wheat" />
          <CompactStat C={C} icon={PawPrint} label="Animal Scans" value={fmt(data?.total_animal_scans)} tint="sky" />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <CompactStat C={C} icon={MessageCircleWarning} label="Complaints" value={fmt(data?.total_complaints)} tint="clay" />
        </View>
      </View>

      {/* Quick Actions */}
      <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
        <Text style={[styles.secLabel, { color: C.ink }]}>Quick Actions</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
          {[
            { icon: Users, label: 'Farmers', s: 'users' as Section },
            { icon: Leaf, label: 'Crop Scans', s: 'crops' as Section },
            { icon: PawPrint, label: 'Animal Scans', s: 'animals' as Section },
            { icon: MessageCircleWarning, label: 'Complaints', s: 'complaints' as Section },
          ].map((qa) => {
            const QAIcon = qa.icon;
            return (
              <Pressable key={qa.label} onPress={() => onNav(qa.s)} style={styles.qaBtn}>
                <View style={[styles.qaIconWrap, { backgroundColor: C.soilCard }]}>
                  <QAIcon size={20} color={C.crop} />
                </View>
                <Text style={[styles.qaLabel, { color: C.inkMuted }]} numberOfLines={2}>{qa.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>


    </ScrollView>
  );
}

// ── Compact stat ──
function CompactStat({ C, icon: Icon, label, value, tint }: {
  C: Colors; icon: any; label: string; value: string; tint: Tint;
}) {
  const ts = tintSoft(C), ti = tintIcon(C);
  return (
    <View style={[styles.compact, { backgroundColor: C.soilCard }]}>
      <View style={[styles.compactIcon, { backgroundColor: ts[tint] }]}>
        <Icon size={18} color={ti[tint]} />
      </View>
      <Text style={[styles.compactVal, { color: C.ink }]}>{value}</Text>
      <Text style={[styles.compactLbl, { color: C.inkMuted }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ── Activity row ──
function ActivityRow({ C, icon: Icon, tint, title, sub, time }: {
  C: Colors; icon: any; tint: Tint; title: string; sub: string; time: string;
}) {
  const ts = tintSoft(C), ti = tintIcon(C);
  return (
    <View style={[styles.actRow, { borderBottomColor: C.soilLine }]}>
      <View style={[styles.actIcon, { backgroundColor: ts[tint] }]}>
        <Icon size={17} color={ti[tint]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actTitle, { color: C.ink }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.actSub, { color: C.inkMuted }]} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.actTime, { color: C.inkFaint }]}>{time}</Text>
        <ChevronRight size={15} color={C.inkFaint} />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════════

function UsersSection({ C }: { C: Colors }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editUser, setEditUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [toggling, setToggling] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getUsers(0, 100, query)); } catch (e) { console.error(e); }
    setLoading(false);
  }, [query]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const handleDisable = (u: any) => {
    setTargetUser(u);
  };

  const confirmToggle = async () => {
    if (!targetUser) return;
    setToggling(true);
    try {
      await toggleUserStatus(targetUser.id, !targetUser.is_active);
      setTargetUser(null);
      load();
    } catch (e) { console.error(e); }
    setToggling(false);
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (editUser._name !== undefined) payload.name = editUser._name;
      if (editUser._lastname !== undefined) payload.lastname = editUser._lastname;
      if (editUser._email !== undefined) payload.email = editUser._email;
      if (editUser._Mobile_Number !== undefined) payload.Mobile_Number = editUser._Mobile_Number;
      if (editUser._City !== undefined) payload.City = editUser._City;
      if (editUser._country !== undefined) payload.country = editUser._country;
      await updateUser(editUser.id, payload);
      setEditUser(null);
      load();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <PageHeader C={C} title="Users" description="Registered farmers across all districts" />
      <SearchBar C={C} value={query} onChangeText={setQuery} placeholder="Search farmers" />
      {loading ? <LoadingCenter C={C} /> : !data?.items?.length ? (
        <EmptyCenter C={C} text={query ? `No results for "${query}"` : 'No farmers registered yet'} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}>
          {data.items.map((u: any) => {
            const active = u.is_active !== false;
            return (
              <View key={u.id} style={{ marginBottom: 8, zIndex: activeDropdown === u.id ? 100 : 1 }}>
                <ListCard C={C}
                  title={`${u.name} ${u.lastname}`}
                  subtitle={`${u.City ?? ''}${u.City && u.country ? ', ' : ''}${u.country ?? ''}`}
                  badge={{ text: !active ? 'disabled' : u.email_verified ? 'verified' : 'pending', tone: !active ? 'clay' : u.email_verified ? 'crop' : 'wheat' }}
                  fields={[{ label: 'Email', value: u.email ?? '—' }, { label: 'Phone', value: u.Mobile_Number ?? '—' }]}
                  rightAction={
                    <View style={{ zIndex: activeDropdown === u.id ? 100 : 1 }}>
                      <Pressable onPress={() => setActiveDropdown(activeDropdown === u.id ? null : u.id)} style={{ padding: 4, marginLeft: 8 }}>
                        <MoreVertical size={20} color={C.inkFaint} />
                      </Pressable>
                      
                      {activeDropdown === u.id && (
                        <View style={{ 
                          position: 'absolute', right: 0, top: 32, 
                          backgroundColor: C.soilCard, borderRadius: 12, padding: 4, 
                          elevation: 5, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 8, 
                          minWidth: 160, borderWidth: 1, borderColor: C.soilLine 
                        }}>
                          <Pressable onPress={() => { 
                            setActiveDropdown(null); 
                            setEditUser({
                              ...u,
                              _name: u.name, _lastname: u.lastname, _email: u.email,
                              _Mobile_Number: u.Mobile_Number, _City: u.City, _country: u.country,
                            }); 
                          }} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
                            <Pencil size={16} color={C.crop} />
                            <Text style={{ fontFamily: 'BeVietnamPro_500Medium', color: C.ink, fontSize: 14 }}>Edit User</Text>
                          </Pressable>
                          <View style={{ height: 1, backgroundColor: C.soilLine, marginHorizontal: 4 }} />
                          <Pressable onPress={() => { setActiveDropdown(null); handleDisable(u); }} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
                            {active ? <UserX size={16} color={C.clay} /> : <UserCheck size={16} color={C.crop} />}
                            <Text style={{ fontFamily: 'BeVietnamPro_500Medium', color: active ? C.clay : C.crop, fontSize: 14 }}>{active ? 'Disable User' : 'Enable User'}</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  }
                />
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Confirm Disable/Enable Modal */}
      <Modal visible={!!targetUser} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: C.soilCard, borderRadius: 20, padding: 20 }}>
            {(() => {
              const action = targetUser?.is_active ? 'disable' : 'enable';
              return (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, fontWeight: '700', color: C.ink }}>
                      {action === 'disable' ? 'Disable' : 'Enable'} User
                    </Text>
                    <Pressable onPress={() => setTargetUser(null)}><X size={22} color={C.inkMuted} /></Pressable>
                  </View>
                  <Text style={{ fontFamily: 'BeVietnamPro_400Regular', fontSize: 14, color: C.ink, marginBottom: 20 }}>
                    Are you sure you want to {action} {targetUser?.name} {targetUser?.lastname}?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable onPress={() => setTargetUser(null)} style={{ flex: 1, backgroundColor: C.soil, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 15, fontWeight: '600', color: C.ink }}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={confirmToggle} disabled={toggling}
                      style={{ flex: 1, backgroundColor: action === 'disable' ? C.clay : C.crop, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: toggling ? 0.6 : 1 }}>
                      {toggling ? <ActivityIndicator color="#fff" /> : (
                        <Text style={{ fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 15, fontWeight: '600', color: '#fff' }}>
                          {action === 'disable' ? 'Disable' : 'Enable'}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editUser} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: C.soilCard, borderRadius: 20, padding: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, fontWeight: '700', color: C.ink }}>Edit Farmer</Text>
              <Pressable onPress={() => setEditUser(null)}><X size={22} color={C.inkMuted} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { key: '_name', label: 'First Name' },
                { key: '_lastname', label: 'Last Name' },
                { key: '_email', label: 'Email' },
                { key: '_Mobile_Number', label: 'Phone' },
                { key: '_City', label: 'City' },
                { key: '_country', label: 'Country' },
              ].map(({ key, label }) => (
                <View key={key} style={{ marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'BeVietnamPro_500Medium', fontSize: 12, color: C.inkFaint, marginBottom: 4 }}>{label}</Text>
                  <TextInput
                    value={editUser?.[key] ?? ''}
                    onChangeText={(v) => setEditUser({ ...editUser, [key]: v })}
                    style={{
                      backgroundColor: C.soil, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                      fontFamily: 'BeVietnamPro_400Regular', fontSize: 14, color: C.ink,
                      borderWidth: 1, borderColor: C.soilLine,
                    }}
                    placeholderTextColor={C.inkFaint}
                  />
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={handleSave} disabled={saving}
              style={{ marginTop: 16, backgroundColor: C.crop, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: saving ? 0.6 : 1 }}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 15, fontWeight: '600', color: '#fff' }}>Save Changes</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCANS (Crop / Animal)
// ═══════════════════════════════════════════════════════════════════════════════

function ScansSection({ C, type }: { C: Colors; type: 'crop' | 'animal' }) {
  const fetchFn = type === 'crop' ? getCropScans : getAnimalScans;
  const title = type === 'crop' ? 'Crop Scans' : 'Animal Scans';
  const desc = type === 'crop' ? 'AI disease detection results' : 'Livestock health scan results';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fetchFn(0, 100)); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader C={C} title={title} description={desc} />
      <SearchBar C={C} placeholder={type === 'crop' ? 'Search by crop or farmer' : 'Search by animal or farmer'} />
      {loading ? <LoadingCenter C={C} /> : !data?.items?.length ? (
        <EmptyCenter C={C} text={type === 'crop' ? 'No crop scans yet' : 'No animal scans yet'} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}>
          {data.items.map((item: any) => {
            const conf = item.confidence ? `${(item.confidence * 100).toFixed(0)}%` : '—';
            const tone = item.status === 'completed' ? 'crop' : item.status === 'failed' ? 'clay' : 'wheat';
            const typeLabel = type === 'crop' ? (item.crop_type ?? '') : (item.animal_type ?? '');
            return (
              <ListCard key={item.id} C={C}
                imageUrl={item.image_url || item.image_uri}
                title={item.disease_name || (type === 'crop' ? 'Crop Scan' : 'Animal Scan')}
                subtitle={`${typeLabel}${item.user_id ? ' · Farmer #' + String(item.user_id).slice(0, 6) : ''}`}
                badge={{ text: item.status ?? 'pending', tone }}
                fields={[{ label: 'Confidence', value: conf }, { label: 'Scanned', value: new Date(item.created_at).toLocaleDateString() }]}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE
// ═══════════════════════════════════════════════════════════════════════════════

function VoiceSection({ C }: { C: Colors }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getVoiceSessions(0, 100)); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader C={C} title="Voice Calls" count={data?.total} description="CALL-E voice advisory sessions" />
      <SearchBar C={C} placeholder="Search by farmer or topic" />
      {loading ? <LoadingCenter C={C} /> : !data?.items?.length ? (
        <EmptyCenter C={C} text="No voice calls logged yet" />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}>
          {data.items.map((item: any) => {
            const dur = item.started_at && item.ended_at
              ? `${Math.round((new Date(item.ended_at).getTime() - new Date(item.started_at).getTime()) / 60000)} min` : '—';
            const tone = item.status === 'completed' ? 'crop' : item.status === 'failed' ? 'clay' : 'wheat';
            return (
              <ListCard key={item.id} C={C}
                title={`Room: ${item.room_name ?? '—'}`}
                subtitle={`Farmer #${String(item.farmer_id).slice(0, 8)} · ${item.language ?? 'ur'}`}
                badge={{ text: item.status ?? 'unknown', tone }}
                fields={[{ label: 'Duration', value: dur }, { label: 'Complaints', value: String(item.complaint_count ?? 0) }, { label: 'When', value: item.started_at ? new Date(item.started_at).toLocaleString() : '—' }]}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function ConversationsSection({ C }: { C: Colors }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getConversations(0, 50)); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader C={C} title="Conversations" count={data?.total} description="Chat threads with farmers" />
      <SearchBar C={C} placeholder="Search farmer" />
      {loading ? <LoadingCenter C={C} /> : !data?.items?.length ? (
        <EmptyCenter C={C} text="No conversations yet" />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}>
          {data.items.map((item: any) => (
            <ListCard key={item.id} C={C}
              title={`Farmer #${String(item.farmer_id).slice(0, 8)}`}
              subtitle={item.summary ?? 'No summary'}
              badge={{ text: item.turn_count ? `${item.turn_count} turns` : '—', tone: 'wheat' }}
              fields={[{ label: 'Duration', value: item.duration_seconds ? `${Math.round(item.duration_seconds / 60)} min` : '—' }, { label: 'Date', value: new Date(item.created_at).toLocaleDateString() }]}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLAINTS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'registered', label: 'Registered' },
  { value: 'in_review', label: 'In Review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];
const CATEGORY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'crop_disease', label: 'Crop Disease' },
  { value: 'animal_disease', label: 'Animal Disease' },
  { value: 'weather_alert', label: 'Weather Alert' },
  { value: 'market_rate', label: 'Market Rate' },
  { value: 'general_inquiry', label: 'General' },
];
const URGENCY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function statusTone(status: string): Tint {
  if (status === 'resolved') return 'crop';
  if (status === 'in_review') return 'sky';
  if (status === 'closed') return 'clay';
  return 'wheat';
}
function urgencyTone(urgency: string): Tint {
  if (urgency === 'critical' || urgency === 'high') return 'clay';
  if (urgency === 'low') return 'sky';
  return 'wheat';
}
function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ComplaintsSection({ C }: { C: Colors }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // Pending filter values while the bottom sheet is open
  const [pStatus, setPStatus] = useState('');
  const [pCategory, setPCategory] = useState('');
  const [pDistrict, setPDistrict] = useState('');
  const [pUrgency, setPUrgency] = useState('');
  const [pDateFrom, setPDateFrom] = useState('');
  const [pDateTo, setPDateTo] = useState('');

  const openFilters = useCallback(() => {
    setPStatus(statusFilter);
    setPCategory(categoryFilter);
    setPDistrict(districtFilter);
    setPUrgency(urgencyFilter);
    setPDateFrom(dateFrom);
    setPDateTo(dateTo);
    setFilterOpen(true);
  }, [statusFilter, categoryFilter, districtFilter, urgencyFilter, dateFrom, dateTo]);

  const applyFilters = useCallback(() => {
    setStatusFilter(pStatus);
    setCategoryFilter(pCategory);
    setDistrictFilter(pDistrict);
    setUrgencyFilter(pUrgency);
    setDateFrom(pDateFrom);
    setDateTo(pDateTo);
    setFilterOpen(false);
  }, [pStatus, pCategory, pDistrict, pUrgency, pDateFrom, pDateTo]);

  const clearFilters = useCallback(() => {
    setPStatus('');
    setPCategory('');
    setPDistrict('');
    setPUrgency('');
    setPDateFrom('');
    setPDateTo('');
  }, []);

  const removeFilter = useCallback((key: string) => {
    if (key === 'status') setStatusFilter('');
    if (key === 'category') setCategoryFilter('');
    if (key === 'district') setDistrictFilter('');
    if (key === 'urgency') setUrgencyFilter('');
    if (key === 'dateFrom') setDateFrom('');
    if (key === 'dateTo') setDateTo('');
  }, []);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    if (statusFilter) chips.push({ key: 'status', label: STATUS_OPTIONS.find(o => o.value === statusFilter)?.label ?? statusFilter });
    if (categoryFilter) chips.push({ key: 'category', label: CATEGORY_OPTIONS.find(o => o.value === categoryFilter)?.label ?? categoryFilter });
    if (districtFilter) chips.push({ key: 'district', label: districtFilter });
    if (urgencyFilter) chips.push({ key: 'urgency', label: urgencyFilter });
    if (dateFrom) chips.push({ key: 'dateFrom', label: `From ${dateFrom}` });
    if (dateTo) chips.push({ key: 'dateTo', label: `To ${dateTo}` });
    return chips;
  }, [statusFilter, categoryFilter, districtFilter, urgencyFilter, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getComplaints(0, 100, statusFilter, categoryFilter)); } catch (e) { console.error(e); }
    setLoading(false);
  }, [statusFilter, categoryFilter]);
  useEffect(() => { load(); }, [load]);

  const filteredItems = useMemo(() => {
    let items = data?.items ?? [];
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter((item: any) =>
        (item.reference_number ?? '').toLowerCase().includes(q) ||
        String(item.farmer_id ?? '').includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        (item.district ?? '').toLowerCase().includes(q)
      );
    }
    if (districtFilter) {
      items = items.filter((item: any) => (item.district ?? '').toLowerCase() === districtFilter.toLowerCase());
    }
    if (urgencyFilter) {
      items = items.filter((item: any) => (item.urgency ?? '').toLowerCase() === urgencyFilter.toLowerCase());
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      if (!isNaN(from)) items = items.filter((item: any) => item.created_at && new Date(item.created_at).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime();
      if (!isNaN(to)) items = items.filter((item: any) => item.created_at && new Date(item.created_at).getTime() <= to);
    }
    return items;
  }, [data, query, districtFilter, urgencyFilter, dateFrom, dateTo]);

  const districts = useMemo(() => {
    const set = new Set<string>();
    (data?.items ?? []).forEach((item: any) => { if (item.district) set.add(item.district); });
    return Array.from(set).sort();
  }, [data]);

  // If a complaint is selected, show detail view
  if (selectedItem) {
    return (
      <View style={{ flex: 1, backgroundColor: C.soil }}>
        <ComplaintDetail
          C={C}
          complaint={selectedItem}
          onBack={() => { setSelectedItem(null); load(); }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <PageHeader C={C} title="Complaints" description="Farmer issues reported via voice agent" />

      <SearchBar
        C={C}
        value={query}
        onChangeText={setQuery}
        placeholder="Search complaints"
        onFilterPress={openFilters}
        filterActive={activeFilterChips.length > 0}
      />

      {/* Active filter chips */}
      {activeFilterChips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 36, marginTop: 8 }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 }}>
          {activeFilterChips.map((chip) => (
            <Pressable key={chip.key} onPress={() => removeFilter(chip.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: C.crop + '1A' }}>
              <Text style={{ fontFamily: 'BeVietnamPro_500Medium', fontSize: 11, color: C.crop }}>{chip.label}</Text>
              <X size={12} color={C.crop} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {loading ? <LoadingCenter C={C} /> : !filteredItems.length ? (
        <EmptyCenter C={C} text={query || activeFilterChips.length ? 'No complaints match your filters' : 'No complaints found'} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}>
          {filteredItems.map((item: any) => (
            <ComplaintCard key={item.id} C={C} item={item} onPress={() => setSelectedItem(item)} />
          ))}
        </ScrollView>
      )}

      <FilterSheet
        C={C}
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={applyFilters}
        onClear={clearFilters}
        status={pStatus} onStatusChange={setPStatus}
        category={pCategory} onCategoryChange={setPCategory}
        district={pDistrict} onDistrictChange={setPDistrict}
        districts={districts}
        urgency={pUrgency} onUrgencyChange={setPUrgency}
        dateFrom={pDateFrom} onDateFromChange={setPDateFrom}
        dateTo={pDateTo} onDateToChange={setPDateTo}
      />
    </View>
  );
}

// ── Filter Bottom Sheet ──

interface FilterSheetProps {
  C: Colors;
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
  status: string;
  onStatusChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  district: string;
  onDistrictChange: (v: string) => void;
  districts: string[];
  urgency: string;
  onUrgencyChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
}

function FilterSheet(props: FilterSheetProps) {
  const { C, open, onClose, onApply, onClear, districts } = props;
  const translateY = useRef(new Animated.Value(500)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      translateY.setValue(500);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 500, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [open]);

  if (!open) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: C.soilCard,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28,
        transform: [{ translateY }],
        maxHeight: '85%',
      }}>
        {/* Drag handle */}
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.soilLine, alignSelf: 'center', marginBottom: 12 }} />
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, fontWeight: '700', color: C.ink }}>Filters</Text>
          <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.soil, alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} color={C.ink} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Status */}
          <FilterSectionTitle C={C}>Status</FilterSectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {STATUS_OPTIONS.map(opt => (
              <RadioChip key={opt.value} C={C} label={opt.label} active={props.status === opt.value} onPress={() => props.onStatusChange(opt.value)} />
            ))}
          </View>

          {/* Category */}
          <FilterSectionTitle C={C}>Category</FilterSectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {CATEGORY_OPTIONS.map(opt => (
              <RadioChip key={opt.value} C={C} label={opt.label} active={props.category === opt.value} onPress={() => props.onCategoryChange(opt.value)} />
            ))}
          </View>

          {/* District */}
          <FilterSectionTitle C={C}>District</FilterSectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <RadioChip C={C} label="All" active={props.district === ''} onPress={() => props.onDistrictChange('')} />
            {districts.map(d => (
              <RadioChip key={d} C={C} label={d} active={props.district === d} onPress={() => props.onDistrictChange(d)} />
            ))}
          </View>

          {/* Urgency */}
          <FilterSectionTitle C={C}>Urgency</FilterSectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {URGENCY_OPTIONS.map(opt => (
              <RadioChip key={opt.value} C={C} label={opt.label} active={props.urgency === opt.value} onPress={() => props.onUrgencyChange(opt.value)} />
            ))}
          </View>

          {/* Date range */}
          <FilterSectionTitle C={C}>Date Range</FilterSectionTitle>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'BeVietnamPro_400Regular', fontSize: 12, color: C.inkMuted, marginBottom: 6 }}>From</Text>
              <TextInput
                value={props.dateFrom}
                onChangeText={props.onDateFromChange}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.inkFaint}
                style={{ height: 44, borderRadius: 12, backgroundColor: C.soil, paddingHorizontal: 12, fontFamily: 'BeVietnamPro_400Regular', fontSize: 14, color: C.ink }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'BeVietnamPro_400Regular', fontSize: 12, color: C.inkMuted, marginBottom: 6 }}>To</Text>
              <TextInput
                value={props.dateTo}
                onChangeText={props.onDateToChange}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.inkFaint}
                style={{ height: 44, borderRadius: 12, backgroundColor: C.soil, paddingHorizontal: 12, fontFamily: 'BeVietnamPro_400Regular', fontSize: 14, color: C.ink }}
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer actions */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <Pressable onPress={onClear} style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: C.soil, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.soilLine }}>
            <Text style={{ fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 14, fontWeight: '600', color: C.inkMuted }}>Clear All</Text>
          </Pressable>
          <Pressable onPress={onApply} style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: C.crop, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 14, fontWeight: '600', color: '#fff' }}>Apply Filters</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function FilterSectionTitle({ C, children }: { C: Colors; children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 10 }}>{children}</Text>
  );
}

function RadioChip({ C, label, active, onPress }: { C: Colors; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}
      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? C.crop : C.soil, borderWidth: active ? 0 : 1, borderColor: C.soilLine }}>
      <Text style={{ fontFamily: 'BeVietnamPro_500Medium', fontSize: 13, fontWeight: '500', color: active ? '#fff' : C.inkMuted }}>{label}</Text>
    </Pressable>
  );
}

// ── Complaint Card ──

function ComplaintCard({ C, item, onPress }: { C: Colors; item: any; onPress: () => void }) {
  const st = statusTone(item.status);
  const bb = badgeBg(C), bc = badgeClr(C);
  return (
    <Pressable onPress={onPress}>
      <View style={[styles.card, { backgroundColor: C.soilCard }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.cardTitle, { color: C.ink }]} numberOfLines={1}>
              #{item.reference_number}
            </Text>
            <Text style={[styles.cardSub, { color: C.inkMuted }]} numberOfLines={1}>
              {formatCategory(item.category)} · Farmer #{String(item.farmer_id).slice(0, 8)}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: bb[st] ?? bb.crop }]}>
            <Text style={[styles.badgeTxt, { color: bc[st] ?? bc.crop }]}>{item.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <Text style={{ fontFamily: 'BeVietnamPro_400Regular', fontSize: 13, color: C.inkMuted, marginTop: 8, lineHeight: 18 }} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={[styles.cardFields, { borderTopColor: C.soilLine }]}>
          <View style={{ marginRight: 20 }}>
            <Text style={[styles.fLabel, { color: C.inkFaint }]}>Urgency</Text>
            <Text style={[styles.fValue, { color: urgencyTone(item.urgency) === 'clay' ? C.clay : C.ink }]}>{item.urgency}</Text>
          </View>
          {item.crop && (
            <View style={{ marginRight: 20 }}>
              <Text style={[styles.fLabel, { color: C.inkFaint }]}>Crop</Text>
              <Text style={[styles.fValue, { color: C.ink }]}>{item.crop}</Text>
            </View>
          )}
          <View style={{ marginRight: 20 }}>
            <Text style={[styles.fLabel, { color: C.inkFaint }]}>District</Text>
            <Text style={[styles.fValue, { color: C.ink }]}>{item.district}</Text>
          </View>
          <View>
            <Text style={[styles.fLabel, { color: C.inkFaint }]}>Date</Text>
            <Text style={[styles.fValue, { color: C.ink }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
        </View>
        <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <ChevronRight size={16} color={C.inkFaint} />
        </View>
      </View>
    </Pressable>
  );
}

// ── Complaint Detail View ──

function ComplaintDetail({ C, complaint: initialComplaint, onBack }: { C: Colors; complaint: any; onBack: () => void }) {
  const [complaint, setComplaint] = useState<any>(initialComplaint);
  const [farmer, setFarmer] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState(initialComplaint.status);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Load farmer detail
        try { const f = await getFarmerDetail(String(initialComplaint.farmer_id)); setFarmer(f); } catch {}
        // Load events
        try { const evts = await getComplaintEvents(String(initialComplaint.id)); setEvents(evts as any[]); } catch {}
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [initialComplaint]);

  const handleStatusChange = async () => {
    if (!complaint || newStatus === complaint.status) return;
    setSaving(true);
    setError('');
    try {
      await updateComplaintStatus(String(complaint.id), newStatus, notes);
      // Refresh events
      const evts = await getComplaintEvents(String(complaint.id));
      setEvents(evts as any[]);
      setComplaint({ ...complaint, status: newStatus });
      setNotes('');
    } catch (e: any) {
      setError(e?.message || 'Failed to update status');
    }
    setSaving(false);
  };

  if (loading) return <LoadingCenter C={C} />;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Back button */}
      <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        <ChevronLeft size={20} color={C.crop} />
        <Text style={{ fontFamily: 'BeVietnamPro_500Medium', fontSize: 15, fontWeight: '500', color: C.crop }}>Back to Complaints</Text>
      </Pressable>

      {/* Header card */}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: C.soilCard, borderRadius: 18, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, fontWeight: '700', color: C.ink }}>#{complaint.reference_number}</Text>
              <Text style={{ fontFamily: 'BeVietnamPro_400Regular', fontSize: 13, color: C.inkMuted, marginTop: 4 }}>
                {new Date(complaint.created_at).toLocaleString()}
              </Text>
            </View>
            <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: C[statusTone(complaint.status)] + '1A' }}>
              <Text style={{ fontFamily: 'BeVietnamPro_500Medium', fontSize: 12, fontWeight: '500', color: C[statusTone(complaint.status)] }}>
                {complaint.status.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text style={{ fontFamily: 'BeVietnamPro_400Regular', fontSize: 14, color: C.ink, marginTop: 16, lineHeight: 22 }}>
            {complaint.description}
          </Text>

          {/* Info grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.soilLine }}>
            <InfoField C={C} label="Category" value={formatCategory(complaint.category)} />
            <InfoField C={C} label="Urgency" value={complaint.urgency} valueColor={urgencyTone(complaint.urgency) === 'clay' ? C.clay : undefined} />
            <InfoField C={C} label="District" value={complaint.district} />
            {complaint.crop && <InfoField C={C} label="Crop" value={complaint.crop} />}
          </View>
        </View>

        {/* Farmer info */}
        {farmer && (
          <View style={{ backgroundColor: C.soilCard, borderRadius: 18, padding: 16, marginTop: 12 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, fontWeight: '600', color: C.ink, marginBottom: 12 }}>Farmer Details</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              <InfoField C={C} label="Name" value={`${farmer.name} ${farmer.lastname ?? ''}`} />
              {farmer.email && <InfoField C={C} label="Email" value={farmer.email} />}
              {farmer.mobile && <InfoField C={C} label="Phone" value={farmer.mobile} />}
              {farmer.city && <InfoField C={C} label="City" value={farmer.city} />}
              {farmer.country && <InfoField C={C} label="Country" value={farmer.country} />}
            </View>
          </View>
        )}

        {/* Status change */}
        <View style={{ backgroundColor: C.soilCard, borderRadius: 18, padding: 16, marginTop: 12 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, fontWeight: '600', color: C.ink, marginBottom: 12 }}>Change Status</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STATUS_OPTIONS.filter(o => o.value).map((opt) => {
              const active = newStatus === opt.value;
              return (
                <Pressable key={opt.value} onPress={() => setNewStatus(opt.value)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? C.crop : C.soil, borderWidth: active ? 0 : 1, borderColor: C.soilLine }}>
                  <Text style={{ fontFamily: 'BeVietnamPro_500Medium', fontSize: 13, fontWeight: '500', color: active ? '#fff' : C.inkMuted }}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={{ marginTop: 12, height: 44, borderRadius: 12, backgroundColor: C.soil, paddingHorizontal: 14, fontFamily: 'BeVietnamPro_400Regular', fontSize: 14, color: C.ink }}
            placeholder="Add notes (optional)..."
            placeholderTextColor={C.inkFaint}
            value={notes}
            onChangeText={setNotes}
            multiline={false}
          />
          {error ? <Text style={{ fontFamily: 'BeVietnamPro_400Regular', fontSize: 13, color: C.clay, marginTop: 8 }}>{error}</Text> : null}
          <Pressable
            onPress={handleStatusChange}
            disabled={saving || newStatus === complaint.status}
            style={{ marginTop: 12, height: 44, borderRadius: 12, backgroundColor: (newStatus !== complaint.status && !saving) ? C.crop : C.soilLine, alignItems: 'center', justifyContent: 'center' }}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 14, fontWeight: '600', color: newStatus !== complaint.status ? '#fff' : C.inkFaint }}>Update Status</Text>
            }
          </Pressable>
        </View>

        {/* Event timeline */}
        {events.length > 0 && (
          <View style={{ backgroundColor: C.soilCard, borderRadius: 18, padding: 16, marginTop: 12 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, fontWeight: '600', color: C.ink, marginBottom: 12 }}>Status History</Text>
            {events.map((evt: any, idx: number) => (
              <View key={evt.id || idx} style={{ flexDirection: 'row', gap: 12, paddingBottom: 16, marginBottom: idx < events.length - 1 ? 0 : 0 }}>
                {/* Timeline dot + line */}
                <View style={{ alignItems: 'center', width: 20 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.crop }} />
                  {idx < events.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: C.soilLine, marginTop: 4 }} />}
                </View>
                {/* Content */}
                <View style={{ flex: 1, paddingBottom: 8 }}>
                  <Text style={{ fontFamily: 'BeVietnamPro_500Medium', fontSize: 13, fontWeight: '500', color: C.ink }}>
                    {evt.previous_status ? `${evt.previous_status.replace(/_/g, ' ')} → ${evt.new_status?.replace(/_/g, ' ')}` : `Created as ${evt.new_status?.replace(/_/g, ' ')}`}
                  </Text>
                  {evt.notes ? <Text style={{ fontFamily: 'BeVietnamPro_400Regular', fontSize: 12, color: C.inkMuted, marginTop: 2 }}>{evt.notes}</Text> : null}
                  <Text style={{ fontFamily: 'BeVietnamPro_400Regular', fontSize: 11, color: C.inkFaint, marginTop: 4 }}>
                    {new Date(evt.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function InfoField({ C, label, value, valueColor }: { C: Colors; label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ minWidth: 80 }}>
      <Text style={{ fontFamily: 'BeVietnamPro_400Regular', fontSize: 10.5, color: C.inkFaint }}>{label}</Text>
      <Text style={{ fontFamily: 'BeVietnamPro_500Medium', fontSize: 13, color: valueColor ?? C.ink, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

function AuditSection({ C }: { C: Colors }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getAuditLog(0, 100)); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader C={C} title="Audit Log" count={data?.total} description="System and admin activity trail" />
      <SearchBar C={C} placeholder="Search action or actor" />
      {loading ? <LoadingCenter C={C} /> : !data?.items?.length ? (
        <EmptyCenter C={C} text="No audit entries yet" />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}>
          {data.items.map((item: any) => {
            const tone = item.status === 'success' ? 'sky' : 'clay';
            return (
              <ListCard key={item.id} C={C}
                title={item.tool_name ?? 'Unknown tool'}
                subtitle={`Farmer #${String(item.farmer_id).slice(0, 8)}`}
                badge={{ text: item.status ?? 'unknown', tone }}
                fields={[{ label: 'Duration', value: item.duration_ms ? `${item.duration_ms}ms` : '—' }, { label: 'When', value: new Date(item.created_at).toLocaleString() }]}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

function PageHeader({ C, title, count, description }: { C: Colors; title: string; count?: number; description?: string }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={[styles.phTitle, { color: C.ink }]}>{title}</Text>
        {typeof count === 'number' && <Text style={[styles.phCount, { color: C.inkFaint }]}>{count}</Text>}
      </View>
      {description ? <Text style={[styles.phDesc, { color: C.inkMuted }]}>{description}</Text> : null}
    </View>
  );
}

function SearchBar({ C, value, onChangeText, placeholder, onFilterPress, filterActive }: {
  C: Colors; value?: string; onChangeText?: (t: string) => void; placeholder?: string;
  onFilterPress?: () => void; filterActive?: boolean;
}) {
  return (
    <View style={styles.searchRow}>
      <View style={[styles.searchBox, { backgroundColor: C.soilCard }]}>
        <Search size={16} color={C.inkFaint} />
        <TextInput style={[styles.searchInput, { color: C.ink }]} value={value} onChangeText={onChangeText}
          placeholder={placeholder ?? 'Search'} placeholderTextColor={C.inkFaint} />
      </View>
      {onFilterPress && (
        <Pressable onPress={onFilterPress} style={[styles.filterBtn, { backgroundColor: filterActive ? C.crop : C.soilCard }]}>
          <SlidersHorizontal size={17} color={filterActive ? '#fff' : C.ink} />
        </Pressable>
      )}
    </View>
  );
}

function ListCard({ C, title, subtitle, badge, fields, onPress, imageUrl, rightAction }: {
  C: Colors; title: string; subtitle?: string;
  badge?: { text: string; tone: string };
  fields: { label: string; value: string }[];
  onPress?: () => void;
  imageUrl?: string;
  rightAction?: React.ReactNode;
}) {
  const bb = badgeBg(C), bc = badgeClr(C);
  
  const content = (
    <View style={[styles.card, { backgroundColor: C.soilCard, overflow: 'visible', padding: 0 }]}>
      {imageUrl && (
        <Image 
          source={{ uri: imageUrl }}
          style={{ width: '100%', height: 200, backgroundColor: C.soilLine, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
          resizeMode="cover"
        />
      )}
      <View style={{ padding: 16, zIndex: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[styles.cardTitle, { color: C.ink }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.cardSub, { color: C.inkMuted }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 20 }}>
          {badge && (
            <View style={[styles.badge, { backgroundColor: bb[badge.tone] ?? bb.crop }]}>
              <Text style={[styles.badgeTxt, { color: bc[badge.tone] ?? bc.crop }]}>{badge.text}</Text>
            </View>
          )}
          {rightAction}
        </View>
      </View>
      {fields.length > 0 && (
        <View style={[styles.cardFields, { borderTopColor: C.soilLine }]}>
          {fields.map((f) => (
            <View key={f.label} style={{ marginRight: 20 }}>
              <Text style={[styles.fLabel, { color: C.inkFaint }]}>{f.label}</Text>
              <Text style={[styles.fValue, { color: C.ink }]} numberOfLines={1}>{f.value}</Text>
            </View>
          ))}
        </View>
      )}
      {onPress && (
        <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <ChevronRight size={16} color={C.inkFaint} />
        </View>
      )}
      </View>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

function LoadingCenter({ C }: { C: Colors }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.crop} /></View>;
}
function EmptyCenter({ C, text }: { C: Colors; text: string }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}><Text style={{ fontFamily: 'BeVietnamPro_400Regular', fontSize: 14, color: C.inkMuted, textAlign: 'center', marginTop: 12 }}>{text}</Text></View>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },

  // Drawer
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_W,
    paddingTop: 20, paddingBottom: 16, zIndex: 50,
  },
  drawerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  drawerH: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, fontWeight: '700', color: '#fff' },
  drawerSub: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  drawerX: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16 },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.10)' },
  navDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
  navLabel: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },
  navLabelActive: { color: '#ffffff', fontWeight: '600' },
  drawerFoot: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 12 },

  // Dashboard
  secLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  hero: { borderRadius: 18, paddingHorizontal: 20, paddingVertical: 20, overflow: 'hidden' },
  heroLabel: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.70)' },
  heroVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 34, fontWeight: '700', color: '#fff', lineHeight: 38, marginTop: 4 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  heroTrend: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 12 },
  compact: { flex: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 16 },
  compactIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  compactVal: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 24, fontWeight: '600', marginTop: 12 },
  compactLbl: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 12.5, marginTop: 2 },

  // Quick Actions
  qaBtn: { width: '22%', alignItems: 'center', gap: 8, paddingVertical: 12 },
  qaIconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 11, fontWeight: '500', textAlign: 'center' },

  // Activity
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  actIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actTitle: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 14 },
  actSub: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 12.5, marginTop: 2 },
  actTime: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 11 },

  // Page header
  phTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, fontWeight: '700' },
  phCount: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 14 },
  phDesc: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 13, marginTop: 2 },

  // Search
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 16, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontFamily: 'BeVietnamPro_400Regular', fontSize: 14, paddingVertical: 0 },
  filterBtn: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // List card
  card: { borderRadius: 18, padding: 16, marginBottom: 12 },
  cardTitle: { fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 15, fontWeight: '600' },
  cardSub: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 12.5, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 11, fontWeight: '500' },
  cardFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  fLabel: { fontFamily: 'BeVietnamPro_400Regular', fontSize: 10.5 },
  fValue: { fontFamily: 'BeVietnamPro_500Medium', fontSize: 13, marginTop: 2 },
});
