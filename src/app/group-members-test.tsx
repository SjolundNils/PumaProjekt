import { supabase } from '@/lib/supabase';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Information om en gruppmedlem
type GroupMember = {
  user_id: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

//Information om användare som hittas vid sökning
type ProfileResult = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function GroupMemberTestScreen() {
  // Hämtar gruppens ID från föregående sida
  const { id } = useLocalSearchParams<{ id: string }>();

  const [members, setMembers] = useState<GroupMember[]>([]);

  // Bestämmer om vi visar medlemmar eller sökning efter nya medlemmar
  const [showAddMembers, setShowAddMembers] = useState(false);

  // Söktexten i Add Members-vyn
  const [search, setSearch] = useState('');

  // Sparar användarna som hittas vid sökning
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([]);

  // Visar om en sökning pågår
  const [searchLoading, setSearchLoading] = useState(false);

  // åller reda på vilken sökning som är den senaste
const searchRequestId = useRef(0);

  useEffect(() => {
    async function loadMembers() {
      if (!id) return;

      // Hämtar medlemmarna i den valda gruppen
      const { data, error } = await supabase
        .from('group_members')
        .select(
          'user_id, profiles!group_members_user_id_fkey(display_name, avatar_url)'
        )
        .eq('group_id', id);

      if (error) {
        console.log('Kunde inte hämta medlemmar:', error);
        return;
      }

      setMembers(data as GroupMember[]);
    }

    loadMembers();
  }, [id]);

  //Söker efter användare i Supabase
  async function searchUsers(query: string) {
  const requestId = ++searchRequestId.current;
  const trimmed = query.trim();

    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);

    const { data: userData } = await supabase.auth.getUser();

    let request = supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `%${trimmed}%`)
      .limit(10);

    // Visa inte den inloggade användaren i sökresultaten
    if (userData.user) {
      request = request.neq('id', userData.user.id);
    }

    const { data, error } = await request;

    // Ignorera resultat från äldre sökningar
    if (requestId !== searchRequestId.current) return;

    if (error) {
      console.log('Kunde inte söka efter användare:', error);
    } else {
      // Filtrera bort personer som redan är med i gruppen
      const availableUsers = (data ?? []).filter(
        (profile) => !members.some((member) => member.user_id === profile.id)
      );

      setSearchResults(availableUsers);
    }

    setSearchLoading(false);
  }

  // Skickar en gruppinbjudan till en användare
  async function inviteUser(userId: string) {
    if (!id) return;

    // Hämtar den inloggade användaren
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      console.log('Kunde inte hämta inloggad användare');
      return;
    }

    // Skapar en inbjudan till den befintliga gruppen
    const { error } = await supabase
      .from('group_invites')
      .insert({
        group_id: id,
        invited_user_id: userId,
        invited_by: userData.user.id,
      });

    if (error) {
      console.log('Kunde inte skicka inbjudan:', error);

      // Visar ett felmeddelande om inbjudan inte kunde skickas
      Alert.alert(
        'Invitation failed',
        'Could not send the invitation. Please try again.'
      );
      return;
    }

    // Visar bekräftelse när inbjudan har sparats i Supabase
    Alert.alert(
      'Invitation sent!',
      'Your group invitation has been sent successfully.',
      [{ text: 'OK' }]
    );
  }
  
  // Visar en bekräftelseruta innan en gruppinbjudan skickas
  function confirmInvite(profile: ProfileResult) {
    Alert.alert(
      'Invite to group',
      `Do you want to invite ${profile.display_name ?? 'this user'} to the group?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Invite',
          onPress: () => inviteUser(profile.id),
        },
      ]
    );
  }

  return (
    <SafeAreaView
    edges={['top']}
    style={{ flex: 1, backgroundColor: '#fff', padding: 20 }}
  >
      {showAddMembers ? (
      //Vyn för att söka och lägga till medlemmar
      <View>
        <Pressable onPress={() => setShowAddMembers(false)}>
          <Text style={{ fontSize: 16, marginBottom: 20 }}>
            ← Back
          </Text>
        </Pressable>

        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
          Add Members
        </Text>

        <Text style={{ color: '#888', marginBottom: 24 }}>
          Share with friends
        </Text>

        {/* Sökfält med automatiska namnförslag och kryss */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F5F5F5',
            borderRadius: 12,
            paddingHorizontal: 14,
          }}
>
      <TextInput
        placeholder="Search users..."
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          searchUsers(text);
        }}
        style={{
          flex: 1,
          paddingVertical: 14,
          fontSize: 16,
        }}
      />

      {/* Kryss för att rensa sökningen */}
      {search.length > 0 && (
        <Pressable
          onPress={() => {
            setSearch('');
            searchUsers('');
          }}
          hitSlop={10}
        >
          <Text style={{ fontSize: 22, color: '#888' }}>×</Text>
        </Pressable>
      )}
    </View>
      {/*Visar att en sökning pågår */}
      {searchLoading && (
        <Text style={{ marginTop: 16 }}>Searching...</Text>
      )}

      {/*Visar användarna som hittades */}
      {searchResults.map((profile) => (
        <View
          key={profile.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 16,
          }}
        >
          {/* Profilbild */}
          {profile.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={{ width: 45, height: 45, borderRadius: 23 }}
            />
          ) : (
            <View
              style={{
                width: 45,
                height: 45,
                borderRadius: 23,
                backgroundColor: '#ddd',
              }}
            />
          )}

          {/* Användarens namn */}
          <Text style={{ flex: 1 }}>
            {profile.display_name ?? 'Unknown user'}
          </Text>

          {/* Plusknapp för att senare skicka gruppinbjudan */}
          <Pressable
            onPress={() => confirmInvite(profile)}
          >
            <Text style={{ color: '#6955FF', fontSize: 24 }}>+</Text>
          </Pressable>
        </View>
      ))}
      </View>
    ) : (
      <>
      {/*Rubrik och knapp för att lägga till members*/}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
          Members
        </Text>

        <Pressable
          onPress={() => setShowAddMembers(true)}
          style={{
            backgroundColor: '#6955FF',
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 22 }}>+</Text>
        </Pressable>
      </View>

      <Text style={{ color: '#888', marginBottom: 20 }}>
        {members.length} members
      </Text>

      {members.map((member) => (
        <View
          key={member.user_id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
            gap: 12,
          }}
        >
          {member.profiles?.avatar_url ? (
            <Image
              source={{ uri: member.profiles.avatar_url }}
              style={{ width: 45, height: 45, borderRadius: 23 }}
            />
          ) : (
            <View
              style={{
                width: 45,
                height: 45,
                borderRadius: 23,
                backgroundColor: '#ddd',
              }}
            />
          )}

          <Text style={{ fontSize: 16 }}>
            {member.profiles?.display_name ?? 'Unknown user'}
          </Text>
        </View>
      ))}
      </>
    )}
    </SafeAreaView>
  );
}