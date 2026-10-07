/**
 * friends-test.tsx
 *
 * TESTSKÄRM för vänflödet. Ersätts av den riktiga profilsidan/Friends-sidan
 * men använder samma funktioner från lib/friends.ts, så logiken är den som
 * ska användas i den färdiga appen. Ta bort innan merge till main.
 */
import { signOut } from '@/lib/auth';
import {
	acceptRequest,
	Friendship,
	listFriendships,
	ProfileHit,
	removeFriendship,
	searchUsers,
	sendFriendRequest,
} from '@/lib/friends';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	Image,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';

const SEND_MESSAGES = {
  sent: 'Förfrågan skickad.',
  accepted: 'Ni är nu vänner (hen hade redan skickat en förfrågan till dig).',
  already_sent: 'Du har redan skickat en förfrågan.',
  already_friends: 'Ni är redan vänner.',
} as const;

export default function FriendsTestScreen() {
  const [me, setMe] = useState<string>('...');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ProfileHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const friends = friendships.filter((f) => f.status === 'accepted');
  const incoming = friendships.filter((f) => f.status === 'pending' && f.direction === 'incoming');
  const outgoing = friendships.filter((f) => f.status === 'pending' && f.direction === 'outgoing');

  /** Hämtar vänner och förfrågningar. */
  const load = useCallback(async () => {
    try {
      setFriendships(await listFriendships());
    } catch (e) {
      Alert.alert('Kunde inte hämta vänner', e instanceof Error ? e.message : 'Okänt fel');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Kör sökningen om, så att knapparna i träfflistan visar rätt läge. */
  const runSearch = useCallback(async (text: string) => {
    if (text.trim().length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }
    try {
      setHits(await searchUsers(text));
      setSearched(true);
    } catch (e) {
      Alert.alert('Sökningen misslyckades', e instanceof Error ? e.message : 'Okänt fel');
    }
  }, []);

  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', data.user.id)
        .maybeSingle();
      setMe(profile?.display_name ?? data.user.id.slice(0, 8));
    })();
  }, [load]);

  /** Kör en åtgärd, visar fel om något går snett och uppdaterar listorna. */
  async function act(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      Alert.alert('Något gick fel', e instanceof Error ? e.message : 'Okänt fel');
    } finally {
      await load();
      await runSearch(query);
      setBusy(false);
    }
  }

  const handleSend = (hit: ProfileHit) =>
    act(async () => {
      const result = await sendFriendRequest(hit.id);
      Alert.alert(hit.display_name ?? 'Användaren', SEND_MESSAGES[result]);
    });

  const handleAccept = (f: Friendship) => act(() => acceptRequest(f.friendship_id));

  const handleDecline = (f: Friendship) => act(() => removeFriendship(f.friendship_id));

  const handleCancel = (f: Friendship) => act(() => removeFriendship(f.friendship_id));

  const handleRemove = (f: Friendship) =>
    Alert.alert('Ta bort vän', `Vill du ta bort ${f.display_name ?? 'användaren'} som vän?`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: () => act(() => removeFriendship(f.friendship_id)) },
    ]);

  /** Säkerhetstest: försöker acceptera en förfrågan man själv har skickat. Ska blockeras. */
  async function cheatTest(f: Friendship) {
    const { data } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', f.friendship_id)
      .select('id');
    Alert.alert('Fusk-test', data && data.length > 0 ? 'FEL: det gick igenom!' : 'Blockerat (rätt).');
    await load();
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.me}>Inloggad som: {me}</Text>
        <Pressable onPress={handleSignOut}>
          <Text style={styles.link}>Logga ut</Text>
        </Pressable>
      </View>

	   <Pressable style={styles.button} onPress={() => router.push('/friends')}>
        <Text style={styles.buttonText}>Öppna vänlistan (friends/index)</Text>
      </Pressable>

      {/* Sök */}
      <Text style={styles.section}>Sök användare</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch(query)}
          placeholder="Namn (minst 2 tecken)"
          autoCapitalize="none"
          returnKeyType="search"
        />
        <Pressable style={styles.button} onPress={() => runSearch(query)}>
          <Text style={styles.buttonText}>Sök</Text>
        </Pressable>
      </View>
      <Pressable style={styles.addFriendsButton} onPress={() => router.push('/add-friends')}>
        <Text style={styles.buttonText}>Add friends</Text>
      </Pressable>

      {searched && hits.length === 0 && <Text style={styles.empty}>Inga träffar.</Text>}
      {hits.map((hit) => (
        <Row key={hit.id} name={hit.display_name} avatar={hit.avatar_url}>
          {hit.relation === 'none' && <Btn label="Lägg till" onPress={() => handleSend(hit)} disabled={busy} />}
          {hit.relation === 'sent' && <Text style={styles.status}>Förfrågan skickad</Text>}
          {hit.relation === 'received' && <Btn label="Acceptera" onPress={() => handleSend(hit)} disabled={busy} />}
          {hit.relation === 'friends' && <Text style={styles.status}>Vänner</Text>}
        </Row>
      ))}

      {/* Inkommande */}
      <Text style={styles.section}>Inkommande förfrågningar ({incoming.length})</Text>
      {incoming.length === 0 && <Text style={styles.empty}>Inga.</Text>}
      {incoming.map((f) => (
        <Row key={f.friendship_id} name={f.display_name} avatar={f.avatar_url}>
          <Btn label="Acceptera" onPress={() => handleAccept(f)} disabled={busy} />
          <Btn label="Avböj" onPress={() => handleDecline(f)} disabled={busy} secondary />
        </Row>
      ))}

      {/* Skickade */}
      <Text style={styles.section}>Skickade förfrågningar ({outgoing.length})</Text>
      {outgoing.length === 0 && <Text style={styles.empty}>Inga.</Text>}
      {outgoing.map((f) => (
        <Row key={f.friendship_id} name={f.display_name} avatar={f.avatar_url}>
          <Btn label="Dra tillbaka" onPress={() => handleCancel(f)} disabled={busy} secondary />
          <Btn label="Fuska" onPress={() => cheatTest(f)} disabled={busy} secondary />
        </Row>
      ))}

      {/* Vänner */}
      <Text style={styles.section}>Vänner ({friends.length})</Text>
      {loading && <ActivityIndicator />}
      {!loading && friends.length === 0 && <Text style={styles.empty}>Inga vänner än.</Text>}
      {friends.map((f) => (
        <Row key={f.friendship_id} name={f.display_name} avatar={f.avatar_url}>
          <Btn label="Ta bort" onPress={() => handleRemove(f)} disabled={busy} secondary />
        </Row>
      ))}
    </ScrollView>
  );
}

function Row({
  name,
  avatar,
  children,
}: {
  name: string | null;
  avatar: string | null;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarEmpty]} />}
      <Text style={styles.name} numberOfLines={1}>
        {name ?? 'Okänd'}
      </Text>
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

function Btn({
  label,
  onPress,
  disabled,
  secondary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.smallButton, secondary && styles.smallButtonSecondary, disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.smallButtonText, secondary && styles.smallButtonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 60, gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  me: { fontSize: 14, color: '#555' },
  link: { color: '#1DB954', fontWeight: '600' },
  section: { fontSize: 18, fontWeight: '700', marginTop: 20 },
  empty: { color: '#888' },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  button: { backgroundColor: '#1DB954', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  addFriendsButton: { backgroundColor: '#1DB954', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarEmpty: { backgroundColor: '#ddd' },
  name: { flex: 1, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  status: { color: '#888' },
  smallButton: { backgroundColor: '#1DB954', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  smallButtonSecondary: { backgroundColor: '#eee' },
  smallButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  smallButtonTextSecondary: { color: '#333' },
});