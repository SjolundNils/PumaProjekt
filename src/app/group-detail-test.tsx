import { supabase } from '@/lib/supabase';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

type GroupMember = {
  user_id: string;
  profiles: {
    avatar_url: string | null;
    display_name: string | null;
  } | null;
};

export default function GroupDetailTestScreen() {
  //Hämtar id för gruppen som användaren väljer  
  const { id } = useLocalSearchParams<{ id: string }>();

  const [group, setGroup] = useState<{
    name: string;
    avatar_url: string | null;
  } | null>(null);

  const [members, setMembers] = useState<GroupMember[]>([]);

  useEffect(() => {
    async function loadGroup() {
      if (!id) return;

      // Hämtar information om den valda gruppen från Supabase
      const { data, error } = await supabase
        .from('groups')
        .select('name, avatar_url')
        .eq('id', id)
        .single();

      if (error) {
        console.log('Kunde inte hämta grupp:', error);
        return;
      }

      // Sparar gruppinformationen så att den kan visas på skärmen
      setGroup(data);
    }

    loadGroup();
  }, [id]);

    useEffect(() => {
    async function loadMembers() {
      if (!id) return;

      // Hämtar medlemmarna och deras profilbilder från Supabase
      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, profiles!group_members_user_id_fkey(avatar_url, display_name)')
        .eq('group_id', id);

      if (error) {
        console.log('Kunde inte hämta medlemmar:', error);
        return;
      }

      console.log('Gruppmedlemmar:', data);
      setMembers(data as GroupMember[]);
    }

    loadMembers();
  }, [id]);


  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
        <Text>Group details</Text>

        {/* Visar gruppens information när den har hämtats */}
        {group && (
        <View>
            {group.avatar_url && (
            <Image
                source={{ uri: group.avatar_url }}
                style={{ width: 80, height: 80, borderRadius: 8 }}
            />
            )}

            <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
                {group.name}
            </Text>
        </View>
        )}
    </View>
  );
}