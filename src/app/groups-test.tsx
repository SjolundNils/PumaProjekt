import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Group = {
    id: string;
    name: string;
    image_url: string | null;
}

export default function GroupsTestScreen() {
  const [groups, setGroups] = useState<Group[]>([]);

  async function loadGroups (){
    // Hämta användaren som är inloggad
    const{data: userData} = await supabase.auth.getUser();

    if (!userData.user){
        return;
    }

    const { data, error} = await supabase
        .from('group_members')
        .select(`
            group_id,
            groups(
                id,
                name,
                image_url'
            )
        `)
        .eq('user_id', userData.user.id);

    if (error){
        console.log('Kunde inte hämta grupper', error);
        return;
    }

    console.log('Grupper', data);
  }

  useEffect(() => {
    loadGroups();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Groups</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
  },
});