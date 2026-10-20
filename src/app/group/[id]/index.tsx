/**
 * group/[id]/index.tsx
 *
 * Gruppsidan: gruppens bild, namn och beskrivning, medlemmarna, och
 * dagens låtar från medlemmarna med betyg.
 *
 * Sidan har tre lägen (se getInviteState i lib/groupInvites.ts):
 *   - member:  jag är med i gruppen. Allt visas, och ägaren får en knapp för
 *              att redigera gruppen. Alla medlemmar får en länk till
 *              gruppens spellista i Spotify.
 *   - pending: jag är inbjuden. Förhandsvisning av gruppen med Join/Decline.
 *   - none:    ingen åtkomst.
 *
 * Färger och mått kommer från temat (constants/theme.ts), så sidan följer
 * ljust och mörkt läge.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InviteButtons } from '@/components/groups/invite-buttons';
import { RateButton } from '@/components/rating/rate-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { BackButton } from '@/components/ui/back-button';
import { SpotifyButton } from '@/components/ui/spotify-button';
import { BottomTabInset, ComponentSize, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getInvitePreview, getInviteState, InviteState } from '@/lib/groupInvites';
import { fetchAverageRatings, fetchMyRatings } from '@/lib/ratings';
import { spotifyPlaylistUrl } from '@/lib/spotifyLinks';
import { supabase } from '@/lib/supabase';

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

type Group = {
  name: string;
  avatar_url: string | null;
  description?: string | null;
  // Saknas i förhandsvisningen för inbjudna
  owner_id?: string;
  spotify_playlist_id?: string | null;
};

/** Ägarens avatar är lite större än de andras, som i designen. */
const OWNER_AVATAR = 48;
const COVER = 80;

export default function GroupDetailScreen() {
  const theme = useTheme();
  // Id för gruppen som användaren valt
  const { id } = useLocalSearchParams<{ id: string }>();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [dailySongs, setDailySongs] = useState<DailySong[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Mina egna betyg och genomsnittsbetygen, med daily_songs.id som nyckel
  const [myRatings, setMyRatings] = useState<Record<number, number>>({});
  const [averageRatings, setAverageRatings] = useState<Record<number, number>>({});
  // 'loading' tills vi vet om jag är medlem, inbjuden eller inget av det
  const [inviteState, setInviteState] = useState<'loading' | InviteState>('loading');

  // Avgör om jag är medlem, inbjuden eller utan åtkomst. För inbjudna fylls
  // sidan från förhandsvisningen, eftersom RLS inte släpper igenom gruppen.
  useEffect(() => {
    if (!id) return;
    let mounted = true;

    async function loadAccess() {
      try {
        const state = await getInviteState(id);
        if (!mounted) return;

        if (state === 'pending') {
          const preview = await getInvitePreview(id);
          if (!mounted) return;
          setGroup(preview.group);
          setMembers(
            preview.members.map((m) => ({
              user_id: m.user_id,
              profiles: { avatar_url: m.avatar_url, display_name: m.display_name },
            }))
          );
          setDailySongs(preview.songs);
        }
        setInviteState(state);
      } catch (error) {
        console.log('Kunde inte kontrollera åtkomst:', error);
        if (mounted) setInviteState('none');
      }
    }

    loadAccess();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  // Gruppen hämtas varje gång sidan visas, så att ändringar från
  // redigeringssidan (namn, bild, beskrivning) syns när man kommer tillbaka.
  useFocusEffect(
    useCallback(() => {
      if (!id || inviteState !== 'member') return;

      supabase
        .from('groups')
        .select('name, avatar_url, description, owner_id, spotify_playlist_id')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.log('Kunde inte hämta grupp:', error);
            return;
          }
          setGroup(data);
        });
    }, [id, inviteState])
  );

  useEffect(() => {
    async function loadMembers() {
      if (!id || inviteState !== 'member') return;

      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, profiles!group_members_user_id_fkey(avatar_url, display_name)')
        .eq('group_id', id);

      if (error) {
        console.log('Kunde inte hämta medlemmar:', error);
        return;
      }
      setMembers(data as GroupMember[]);
    }

    loadMembers();
  }, [id, inviteState]);

  useEffect(() => {
    async function loadDailySongs() {
      if (inviteState !== 'member' || members.length === 0) return;

      // Dagens datum från databasen (dagen byter 04:00 svensk tid)
      const { data: today, error: dateError } = await supabase.rpc('app_today');
      if (dateError || !today) {
        console.log('Kunde inte hämta dagens datum:', dateError);
        return;
      }

      const { data, error } = await supabase
        .from('daily_songs')
        .select('id, user_id, track_name, artist_name, image_url')
        .in('user_id', members.map((member) => member.user_id))
        .eq('song_date', today);

      if (error) {
        console.log('Kunde inte hämta dagens låtar:', error);
        return;
      }
      setDailySongs(data);
    }

    loadDailySongs();
  }, [members, inviteState]);

  // Betygen hämtas när sidan visas eller låtarna ändras
  useFocusEffect(
    useCallback(() => {
      async function loadRatings() {
        if (inviteState !== 'member' || !id) return;

        const songIds = dailySongs.map((song) => song.id);
        if (songIds.length === 0) {
          setMyRatings({});
          setAverageRatings({});
          return;
        }

        try {
          const [mine, averages] = await Promise.all([
            fetchMyRatings(songIds),
            fetchAverageRatings(id, songIds),
          ]);
          setMyRatings(mine);
          setAverageRatings(averages);
        } catch (error) {
          console.log('Kunde inte hämta betyg:', error);
        }
      }

      loadRatings();
    }, [dailySongs, inviteState, id])
  );

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/groups');
  }

  if (inviteState === 'loading') {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (inviteState === 'none') {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={{ color: theme.textSecondary }}>
          You don't have access to this group.
        </ThemedText>
      </ThemedView>
    );
  }

  const isOwner = !!currentUserId && group?.owner_id === currentUserId;

  // Ägaren först, som i designen
  const orderedMembers = [...members].sort(
    (a, b) => Number(b.user_id === group?.owner_id) - Number(a.user_id === group?.owner_id)
  );

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.four }]}
        >
          <View style={styles.headerRow}>
            <BackButton onPress={goBack} />
            {isOwner && inviteState === 'member' && (
              <ActionButton
                label="Edit group"
                icon="create-outline"
                size="medium"
                color="base"
                onPress={() => router.push({ pathname: '/group/[id]/edit', params: { id } })}
              />
            )}
          </View>

          {group && (
            <>
              {/* Omslag, namn och undertitel */}
              <View style={styles.titleRow}>
                {group.avatar_url ? (
                  <Image source={{ uri: group.avatar_url }} style={styles.cover} />
                ) : (
                  <View style={[styles.cover, { backgroundColor: theme.backgroundSelected }]} />
                )}
                <View style={styles.titleText}>
                  <ThemedText style={Typography.pageTitle} numberOfLines={2}>
                    {group.name}
                  </ThemedText>
                  <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
                    Today's Daylist
                  </ThemedText>
                </View>
              </View>

              {group.description ? (
                <ThemedText style={styles.description}>{group.description}</ThemedText>
              ) : null}

              {/* Medlemmarna. Ett tryck öppnar hela listan. */}
              <View style={styles.membersRow}>
                <Pressable
                  onPress={() => router.push({ pathname: '/group/[id]/members', params: { id } })}
                  style={styles.members}
                  accessibilityLabel="See all members"
                >
                  {orderedMembers.map((member) => {
                    const isGroupOwner = member.user_id === group.owner_id;
                    const size = isGroupOwner ? OWNER_AVATAR : ComponentSize.avatar.default;

                    return (
                      <View key={member.user_id} style={styles.memberSlot}>
                        {isGroupOwner && (
                          <MaterialCommunityIcons
                            name="crown"
                            size={16}
                          	color={theme.accentIndigo}
                          	style={styles.crown}
                          />
                    	)}
                      	{member.profiles?.avatar_url ? (
                          <Image
                            source={{ uri: member.profiles.avatar_url }}
                            style={{ width: size, height: size, borderRadius: size / 2 }}
                          />
                        ) : (
                          <View
                            style={{
                              width: size,
                              height: size,
                              borderRadius: size / 2,
                              backgroundColor: theme.backgroundSelected,
                            }}
                          />
                        )}
                      </View>
                    );
                  })}
            	</Pressable>
			    {inviteState === 'member' && (
                  <SpotifyButton
                    url={spotifyPlaylistUrl(group.spotify_playlist_id)}
                    size="medium"
                    style={styles.spotifyLink}
                  />
                )}
              </View>

              {/* Inbjuden: Join/Decline */}
              {inviteState === 'pending' && id && (
                <View style={styles.invite}>
                  <ThemedText>You've been invited</ThemedText>
                  <InviteButtons
                    groupId={id}
                    onAccepted={() => setInviteState('member')}
                    onDeclined={goBack}
                  />
                </View>
              )}

              {/* Dagens låtar */}
              <View style={styles.songs}>
                {dailySongs.length === 0 && (
                  <ThemedText style={{ color: theme.textSecondary }}>
                    Nobody has picked a song yet today.
                  </ThemedText>
                )}

                {dailySongs.map((song) => {
                  const picker = members.find((m) => m.user_id === song.user_id);
                  const average = averageRatings[song.id];
                  const canRate =
                    inviteState === 'member' && !!currentUserId && song.user_id !== currentUserId;

                  return (
                    <View
                      key={song.id}
                      style={[styles.songRow, { borderBottomColor: theme.backgroundSelected }]}
                    >
                      {song.image_url ? (
                        <Image source={{ uri: song.image_url }} style={styles.songCover} />
                      ) : (
                        <View style={[styles.songCover, { backgroundColor: theme.backgroundSelected }]} />
                      )}

                      <View style={styles.songText}>
                        <ThemedText style={styles.songName} numberOfLines={1}>
                          {song.track_name}
                        </ThemedText>
                        <ThemedText
                          style={[styles.songArtist, { color: theme.textSecondary }]}
                          numberOfLines={1}
                        >
                          {song.artist_name}
                        </ThemedText>

                        <View style={styles.ratingRow}>
                          {canRate && (
                            <RateButton dailySongId={song.id} myRating={myRatings[song.id]} />
                          )}
                          {average !== undefined && (
                            <ThemedText style={[styles.average, { color: theme.accentOrange }]}>
                              {average.toFixed(1).replace('.', ',')} ★
                            </ThemedText>
                          )}
                        </View>
                      </View>

                      {/* Personen som valde låten */}
                      {picker?.profiles?.avatar_url ? (
                        <Image
                          source={{ uri: picker.profiles.avatar_url }}
                          style={styles.pickerAvatar}
                        />
                      ) : (
                        <View style={[styles.pickerAvatar, { backgroundColor: theme.backgroundSelected }]} />
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.three },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cover: { width: COVER, height: COVER, borderRadius: Radius.small },
  titleText: { flex: 1 },
  subtitle: { fontSize: 20, lineHeight: 24 },
  description: { fontSize: 14, lineHeight: 17 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  membersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  members: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: Spacing.two },
  spotifyLink: { alignSelf: 'flex-end' },
  memberSlot: { alignItems: 'center' },
  crown: { marginBottom: 2 },

  invite: { gap: Spacing.one },

  songs: { marginTop: Spacing.one },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  songCover: { width: 68, height: 68 },
  songText: { flex: 1 },
  songName: { fontSize: 15, fontWeight: '400' },
  songArtist: { fontSize: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  average: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  pickerAvatar: { width: 32, height: 32, borderRadius: 16 },
});