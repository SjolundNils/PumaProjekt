import { supabase } from '@/lib/supabase';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

// Information om en gruppmedlem
type GroupMember = {
  user_id: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export default function GroupMemberTestScreen() {
  // Hämtar gruppens ID från föregående sida
  const { id } = useLocalSearchParams<{ id: string }>();

  const [members, setMembers] = useState<GroupMember[]>([]);

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

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        Members
      </Text>

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
    </View>
  );
}