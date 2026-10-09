import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

type Group = {
    id: string;
    name: string;
    avatar_url: string | null;
}

export default function GroupsTestScreen() {
  const [groups, setGroups] = useState<Group[]>([]);

  async function loadGroups (){
    // Hämta användaren som är inloggad
    const{data: userData} = await supabase.auth.getUser();

    console.log('Inloggad user ID:', userData.user?.id);

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
                avatar_url
            )
        `)
        .eq('user_id', userData.user.id);

    if (error){
        console.log('Kunde inte hämta grupper', error);
        return;
    }

    console.log('Grupper', data);

    const userGroups = data
        .map((item) => item.groups)
        .filter((group): group is Group => group !== null);

    setGroups(userGroups);
  }

  useEffect(() => {
    loadGroups();
  }, []);

  return (
    <View style={styles.container}>
        <Text style={styles.title}>Groups</Text>

        {groups.map((group) => (
            <Pressable
                key={group.id}
                style={styles.groupRow}
                onPress={() =>
                    router.push({
                        pathname: '/group-detail-test',
                        params: { id: group.id },
                    })
                }
            >
                {group.avatar_url && (
                    <Image
                        source={{ uri: group.avatar_url }}
                        style={styles.groupImage}
                    />
                )}
            <Text>{group.name}</Text>
        </Pressable>
        ))}
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

  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },

  groupImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
});