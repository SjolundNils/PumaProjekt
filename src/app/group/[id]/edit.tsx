/**
 * group/[id]/edit.tsx
 *
 * Sida för att ändra en befintlig grupps bild, namn och beskrivning, eller
 * ta bort gruppen. Kan öppnas från vilken skärm som helst:
 *
 *   router.push({ pathname: '/group/[id]/edit', params: { id: groupId } });
 *
 * Bara gruppens ägare kan ändra eller ta bort gruppen. Andra ser ett
 * meddelande i stället för formuläret. Databasen kontrollerar detta också,
 * så det går inte att kringgå från appen.
 *
 * Bilden sparas via uploadGroupAvatar (se lib/group-avatar.ts), namn och
 * beskrivning via databasfunktionen update_group. Byts bilden sätts den
 * också som omslag på gruppens spellista i Spotify. Gruppen tas bort via
 * databasfunktionen delete_group. Ägaren kan inte lämna gruppen utan att
 * ta bort den.
 *
 * Formuläret är samma som när man skapar en grupp (se components/groups).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupFields } from '@/components/groups/group-fields';
import { GroupImagePicker } from '@/components/groups/group-image-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { BackButton } from '@/components/ui/back-button';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/lib/errors';
import { pickGroupImage, uploadGroupAvatar, type GroupImage } from '@/lib/group-avatar';
import { supabase } from '@/lib/supabase';

export default function EditGroupScreen() {
  const theme = useTheme();
  const { id: groupId } = useLocalSearchParams<{ id: string }>();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);

  // En ny bild som användaren har valt, men som inte är sparad än.
  const [newImage, setNewImage] = useState<GroupImage | null>(null);

  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/groups');
  }

  /**
   * Hämtar gruppen och kontrollerar om den inloggade användaren är ägare.
   */
  async function loadGroup() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      const { data: group, error } = await supabase
        .from('groups')
        .select('name, description, avatar_url, owner_id')
        .eq('id', groupId)
        .maybeSingle();

      if (error) throw error;
      if (!group) throw new Error('This group could not be found.');

      setName(group.name);
      setDescription(group.description ?? '');
      setCurrentAvatarUrl(group.avatar_url);
      setIsOwner(group.owner_id === userId);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  /** Låter användaren välja en ny bild. Den sparas först vid Save. */
  async function handlePickImage() {
    try {
      const image = await pickGroupImage();
      if (image) setNewImage(image);
    } catch (error) {
      Alert.alert('Could not use the picture', getErrorMessage(error));
    }
  }

  /**
   * Sparar ändringarna: först bilden om en ny är vald, sedan namn och
   * beskrivning. Byttes bilden sätts den också som omslag i Spotify.
   */
  async function handleSave() {
    setSaving(true);
    setErrorMessage(null);
    try {
      if (newImage) {
        await uploadGroupAvatar(groupId, newImage);
      }

      const { error } = await supabase.rpc('update_group', {
        p_group_id: groupId,
        p_name: name,
        p_description: description,
      });
      if (error) throw error;

      // Omslaget i Spotify. Har gruppen ingen spellista än, eller går något
      // fel, ska det inte stoppa något: gruppen är redan uppdaterad.
      if (newImage) {
        const { error: coverError } = await supabase.functions.invoke('set-playlist-cover', {
          body: { groupId },
        });
        if (coverError) console.log('Kunde inte sätta omslaget i Spotify:', coverError);
      }

      goBack();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  /** Frågar innan gruppen tas bort. Det går inte att ångra. */
  function confirmRemoveGroup() {
    Alert.alert(
      'Remove group',
      "This permanently removes the group for all members, including its history in the feed. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove group', style: 'destructive', onPress: removeGroup },
      ]
    );
  }

  async function removeGroup() {
    setRemoving(true);
    try {
      const { error } = await supabase.rpc('delete_group', { p_group_id: groupId });
      if (error) throw error;

      // Gruppens sidor finns inte längre, så stacken töms och du hamnar på grupplistan
      router.dismissAll();
      router.navigate('/groups');
    } catch (error) {
      Alert.alert('Could not remove the group', getErrorMessage(error));
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!isOwner) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.screen} edges={['top']}>
          <View style={styles.content}>
            <BackButton onPress={goBack} />
            <ThemedText style={{ color: theme.textSecondary }}>
              {errorMessage ?? 'Only the group owner can edit this group.'}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const canSave = name.trim().length > 0 && !saving && !removing;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {/* Bakåt till vänster och Save till höger */}
          <View style={styles.headerRow}>
            <BackButton onPress={goBack} />
            <ActionButton
              label={saving ? 'Saving...' : 'Save'}
              icon="checkmark"
              size="medium"
              color="indigo"
              disabled={!canSave}
              onPress={handleSave}
            />
          </View>

          <View>
            <ThemedText style={Typography.pageTitle}>Edit group</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              Change the picture, name or description
            </ThemedText>
          </View>

          <GroupImagePicker uri={newImage?.uri ?? currentAvatarUrl} onPress={handlePickImage} />

          <GroupFields
            name={name}
            onChangeName={setName}
            description={description}
            onChangeDescription={setDescription}
          />

          {errorMessage && (
            <ThemedText style={{ color: theme.destructiveText }}>{errorMessage}</ThemedText>
          )}

          <View style={styles.dangerZone}>
            <ActionButton
              label="Remove group"
              icon="trash-outline"
              size="medium"
              color="destructiveSecondary"
              disabled={removing || saving}
              onPress={confirmRemoveGroup}
            />
            <ThemedText style={[styles.dangerHint, { color: theme.textSecondary }]}>
              Owners can't leave a group. Removing it deletes it for everyone.
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtitle: { fontSize: 18, lineHeight: 24 },
  dangerZone: { marginTop: Spacing.five, alignItems: 'center', gap: Spacing.two },
  dangerHint: { fontSize: 12, textAlign: 'center' },
});