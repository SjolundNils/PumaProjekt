import { supabase } from '@/lib/supabase';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
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
  async function searchUsers() {
    const trimmed = search.trim();

    if (!trimmed) {
      setSearchResults([]);
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
      return;
    }

    console.log('Gruppinbjudan skickad!');
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

        <TextInput
        placeholder="Search users..."
        value={search}

        //Uppdaterar söktexten och tömmer gamla resultat
        onChangeText={(text) => {
          setSearch(text);
          if (!text.trim()) {
            setSearchResults([]);
          }
        }}

        //Söker när användaren trycker Search på keyboard
        onSubmitEditing={searchUsers}
        returnKeyType="search"

        style={{
          backgroundColor: '#F5F5F5',
          padding: 14,
          borderRadius: 12,
          fontSize: 16,
        }}
      />
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
            onPress={() => inviteUser(profile.id)}
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