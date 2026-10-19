/**
 * edit-group/[groupId].tsx
 *
 * Sida för att ändra en befintlig grupps bild, namn och beskrivning.
 * Kan öppnas från vilken skärm som helst:
 *
 *   router.push({ pathname: '/group/[id]/edit', params: { id: groupId } });
 *
 * Bara gruppens ägare kan ändra gruppen. Andra ser ett meddelande istället
 * för formuläret. Databasen kontrollerar detta också, så det går inte att
 * kringgå från appen.
 *
 * Bilden sparas via uploadGroupAvatar (se lib/group-avatar.ts), namn och
 * beskrivning via databasfunktionen update_group. Byts bilden sätts den
 * också som omslag på gruppens spellista i Spotify.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { getErrorMessage } from '@/lib/errors';
import { pickGroupImage, uploadGroupAvatar, type GroupImage } from '@/lib/group-avatar';
import { supabase } from '@/lib/supabase';

/** Max antal tecken i gruppnamnet. Samma som när gruppen skapas. */
const MAX_NAME_LENGTH = 40;

/** Max antal tecken i gruppbeskrivningen. Motsvarar check-regeln i databasen. */
const MAX_DESCRIPTION_LENGTH = 200;

export default function EditGroupScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);

  // En ny bild som användaren har valt, men som inte är sparad än.
  const [newImage, setNewImage] = useState<GroupImage | null>(null);

  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadGroup();
  }, [groupId]);

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

      router.back();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
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
      <ThemedView style={styles.centered}>
        <ThemedText style={styles.dim}>
          {errorMessage ?? 'Only the group owner can edit this group.'}
        </ThemedText>
      </ThemedView>
    );
  }

  // Den nya bilden om en är vald, annars den nuvarande.
  const previewUrl = newImage?.uri ?? currentAvatarUrl;
  const canSave = name.trim().length > 0 && !saving;
  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.text }];

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Gruppbild. Tryck för att välja en ny. */}
        <Pressable
          style={[styles.avatar, { borderColor: colors.text }, previewUrl && styles.avatarSelected]}
          onPress={handlePickImage}
          accessibilityLabel="Change group picture"
        >
          {previewUrl ? (
            <Image source={{ uri: previewUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="camera-outline" size={32} color={colors.text} />
          )}
        </Pressable>
        <ThemedText style={styles.hint}>Tap the picture to change it</ThemedText>

        <ThemedText style={styles.label}>Name</ThemedText>
        <TextInput
          style={inputStyle}
          value={name}
          onChangeText={setName}
          placeholder="Group name"
          placeholderTextColor="#888"
          maxLength={MAX_NAME_LENGTH}
        />

        <ThemedText style={styles.label}>Description</ThemedText>
        <TextInput
          style={[...inputStyle, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="What is this group about? (optional)"
          placeholderTextColor="#888"
          maxLength={MAX_DESCRIPTION_LENGTH}
          multiline
        />
        <ThemedText style={styles.counter}>
          {description.length}/{MAX_DESCRIPTION_LENGTH}
        </ThemedText>

        {errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}

        <Pressable
          style={[styles.button, !canSave && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <ThemedText style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 24, gap: 12, paddingBottom: 48 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  avatarSelected: { borderWidth: 0, opacity: 1 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 48 },
  hint: { fontSize: 12, opacity: 0.5, alignSelf: 'center', marginBottom: 8 },
  label: { fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, opacity: 0.9 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  counter: { fontSize: 12, opacity: 0.5, alignSelf: 'flex-end' },
  dim: { opacity: 0.6, textAlign: 'center' },
  error: { color: '#c0392b' },
  button: { backgroundColor: '#1DB954', paddingVertical: 14, borderRadius: 999, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '600' },
});