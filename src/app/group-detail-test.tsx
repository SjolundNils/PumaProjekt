import { supabase } from '@/lib/supabase';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

export default function GroupDetailTestScreen() {
  //Hämtar id för gruppen som användaren väljer  
  const { id } = useLocalSearchParams<{ id: string }>();

  const [group, setGroup] = useState<{
    name: string;
    avatar_url: string | null;
  } | null>(null);

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