import { fetchAverageRatings, fetchMyRatings } from '@/lib/ratings';
import { supabase } from '@/lib/supabase';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

type GroupMember = {
    user_id: string;
    profiles: {
        avatar_url: string | null;
        display_name: string | null;
    } | null;
};

type DailySong = {
    id: number;
    user_id: string;
    track_name: string;
    artist_name: string;
    image_url: string | null;
};

export default function GroupDetailTestScreen() {
    //Hämtar id för gruppen som användaren väljer  
    const { id } = useLocalSearchParams<{ id: string }>();

    const [group, setGroup] = useState<{
        name: string;
        avatar_url: string | null;
    } | null>(null);

    const [members, setMembers] = useState<GroupMember[]>([]);
    const [dailySongs, setDailySongs] = useState<DailySong[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    // Mina egna betyg för låtarna
    const [myRatings, setMyRatings] = useState<Record<number, number>>({});
    // Genomsnittsbetygen för låtarna
    const [averageRatings, setAverageRatings] = useState<Record<number, number>>({});

    useEffect(() => {
        // Hämtar ID för den inloggade användaren
        async function loadCurrentUser() {
            const { data } = await supabase.auth.getUser();
            setCurrentUserId(data.user?.id ?? null);
        }

        loadCurrentUser();
    }, []);

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

    useEffect(() => {
        async function loadDailySongs() {
            // Vänta tills gruppmedlemmarna har hämtats
            if (members.length === 0) return;

            // Hämtar dagens datum
            const today = new Date().toISOString().split('T')[0];

            // Hämtar användarnas ID
            const userIds = members.map((member) => member.user_id);

            // Hämtar dagens låtar för gruppens medlemmar
            const { data, error } = await supabase
                .from('daily_songs')
                .select('id, user_id, track_name, artist_name, image_url')
                .in('user_id', userIds)
                .eq('song_date', today);

            if (error) {
                console.log('Kunde inte hämta dagens låtar:', error);
                return;
            }

            console.log('Gruppens dagens låtar:', data);
            setDailySongs(data);
        }

        loadDailySongs();
    }, [members]);

    // Hämtar betyg när gruppsidan visas eller låtarna ändras
    useFocusEffect(
        useCallback(() => {
            async function loadRatings() {
                const songIds = dailySongs.map((song) => song.id);

                if (songIds.length === 0) {
                    setMyRatings({});
                    setAverageRatings({});
                    return;
                }

                try {
                    // Hämtar både mina betyg och genomsnittsbetygen
                    const [mine, averages] = await Promise.all([
                        fetchMyRatings(songIds),
                        fetchAverageRatings(songIds),
                    ]);

                    setMyRatings(mine);
                    setAverageRatings(averages);
                } catch (error) {
                    console.log('Kunde inte hämta betyg:', error);
                }
            }

            loadRatings();
        }, [dailySongs])
    );

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

                    {/* Visar gruppmedlemmarnas profilbilder – klicka för att se alla medlemmar */}
                    <Pressable
                        onPress={() =>
                            router.push({
                                pathname: '/group-members-test',
                                params: { id },
                            })
                        }
                        style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}
                    >
                        {members.map((member) => (
                            <View key={member.user_id}>
                                {member.profiles?.avatar_url ? (
                                    <Image
                                        source={{ uri: member.profiles.avatar_url }}
                                        style={{ width: 40, height: 40, borderRadius: 20 }}
                                    />
                                ) : (
                                    <View
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            backgroundColor: '#ddd',
                                        }}
                                    />
                                )}
                            </View>
                        ))}
                    </Pressable>

                    {/* Visar gruppmedlemmarnas dagens låtar */}
                    <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 24 }}>
                        Today's Daylist
                    </Text>

                    {dailySongs.map((song) => {
                        // Hittar medlemmen som har valt låten
                        const member = members.find((m) => m.user_id === song.user_id);
                        //Eget betyg
                        const myRating = myRatings[song.id];
                        //snitt betyg
                        const averageRating = averageRatings[song.id];

                        return (
                            <View
                                key={song.user_id}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginTop: 12,
                                    gap: 10,
                                }}
                            >
                                {/* Albumomslag */}
                                {song.image_url && (
                                    <Image
                                        source={{ uri: song.image_url }}
                                        style={{ width: 50, height: 50, borderRadius: 4 }}
                                    />
                                )}

                                {/* Låtens namn och artist */}
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 15, fontWeight: '600' }}>
                                        {song.track_name}
                                    </Text>
                                    <Text style={{ color: '#666', fontSize: 12 }}>
                                        {song.artist_name}
                                    </Text>
                                </View>

                                {/* Profilbild för personen som valde låten */}
                                {member?.profiles?.avatar_url && (
                                    <Image
                                        source={{ uri: member.profiles.avatar_url }}
                                        style={{ width: 28, height: 28, borderRadius: 14 }}
                                    />
                                )}

                                {/* Rate-knappen visas inte på den egna låten */}
                                {currentUserId && song.user_id !== currentUserId && (
                                    <Pressable
                                        onPress={() => router.push(`/rate/${song.id}`)}
                                        style={{
                                            //Orange bakgrund om låten inte har betygsatts
                                            backgroundColor: myRating === undefined ? '#FF9234' : 'transparent',
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 16,
                                        }}
                                    >
                                        {/*Visar mitt betyg eller Rate-knappen */}
                                        <Text
                                            style={{
                                                color: myRating !== undefined ? '#FF9234' : '#fff',
                                                fontWeight: '600',
                                            }}
                                        >
                                            {myRating !== undefined
                                                ? `★ ${myRating.toFixed(1).replace('.', ',')}`
                                                : '☆ Rate'}
                                        </Text>
                                    </Pressable>
                                )}

                                {/*Visar genomsnittsbetyget för låten */}
                                {averageRating !== undefined && (
                                    <Text style={{ color: '#FF9234', fontSize: 14 }}>
                                        {averageRating.toFixed(1).replace('.', ',')} ★
                                    </Text>
                                )}

                            </View>
                        );
                    })}
                </View>
            )
            }
        </View >
    );
}
