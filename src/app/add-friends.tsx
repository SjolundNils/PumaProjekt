import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const SEARCH_LIMIT = 10;
const SEARCH_BAR_HEIGHT = 48;
const glassSupported = isLiquidGlassAvailable();

type ProfileResult = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function AddFriendsScreen() {
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      let request = supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .ilike('display_name', `%${trimmed}%`)
        .limit(SEARCH_LIMIT);

      if (userData.user) {
        request = request.neq('id', userData.user.id);
      }

      const { data, error } = await request;
      if (error) throw error;
      setProfiles(data ?? []);
      setHasSearched(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunde inte söka efter användare.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} />
          <ThemedText>Back</ThemedText>
        </Pressable>

        <ThemedText type="title">Add friends</ThemedText>
        <ThemedText type="small" style={styles.subtitle}>
          Search for likeminded
        </ThemedText>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            data={profiles}
            keyExtractor={(profile) => profile.id}
            contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
            renderItem={({ item }) => (
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <ThemedText>{item.display_name?.charAt(0).toUpperCase() ?? '?'}</ThemedText>
                </View>
                <ThemedText>{item.display_name ?? 'Unnamed user'}</ThemedText>
              </View>
            )}
            ListEmptyComponent={
              !loading && hasSearched ? (
                <ThemedText style={styles.message}>No users found.</ThemedText>
              ) : null
            }
          />

          {errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}

          <View
            style={[styles.searchOverlay, { paddingBottom: insets.bottom + 8 }]}
            pointerEvents="box-none"
          >
            <GlassContainer spacing={8} style={styles.searchRow}>
              <GlassView
                style={[styles.searchField, !glassSupported && styles.fallback]}
                glassEffectStyle="regular"
              >
                <Ionicons name="search" size={18} />
                <TextInput
                  style={styles.input}
                  value={query}
                  onChangeText={(text) => {
                    setQuery(text);
                    if (!text.trim()) {
                      setHasSearched(false);
                      setProfiles([]);
                    }
                  }}
                  onSubmitEditing={handleSearch}
                  placeholder="Search users"
                  returnKeyType="search"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </GlassView>
              <GlassView
                style={[styles.searchButton, !glassSupported && styles.fallback]}
                glassEffectStyle="regular"
                isInteractive
              >
                <Pressable
                  onPress={handleSearch}
                  disabled={loading}
                  style={styles.searchButtonInner}
                  accessibilityRole="button"
                  accessibilityLabel="Search users"
                >
                  {loading ? <ActivityIndicator /> : <Ionicons name="arrow-forward" size={20} />}
                </Pressable>
              </GlassView>
            </GlassContainer>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 16 },
  flex: { flex: 1 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  subtitle: { marginTop: 4 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { paddingVertical: 16 },
  error: { paddingVertical: 8 },
  searchOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: SEARCH_BAR_HEIGHT, borderRadius: SEARCH_BAR_HEIGHT / 2, paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 17, paddingVertical: 0 },
  searchButton: { width: SEARCH_BAR_HEIGHT, height: SEARCH_BAR_HEIGHT, borderRadius: SEARCH_BAR_HEIGHT / 2 },
  searchButtonInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallback: { borderWidth: StyleSheet.hairlineWidth },
});
