/**
 * group-avatar.ts
 *
 * Funktioner för gruppbilder: välja en bild i telefonen, förbereda den och
 * ladda upp den.
 *
 * Bilden förminskas till högst 640 × 640 pixlar och sparas som JPEG under
 * 256 kB. Det är Spotifys krav för omslag på spellistor, så samma bild kan
 * användas både i appen och i Spotify.
 *
 * Bilderna sparas i Supabase Storage, i bucketen group-avatars:
 *   group-avatars/<användar-id>/<grupp-id>.jpg
 * Lagringsreglerna tillåter bara användare att ladda upp i sin egen mapp.
 */

import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

const BUCKET = 'group-avatars';

/** Bildens bredd och höjd i pixlar. */
const SIZE = 640;

/** Spotifys maxstorlek för omslag på spellistor. */
const MAX_BYTES = 256 * 1024;

/** En förberedd bild, redo att visas och laddas upp. */
export type GroupImage = {
  /** Lokal adress till bilden, för att visa den i appen innan uppladdning. */
  uri: string;
  /** Bilden som base64-kodad JPEG, för uppladdning. */
  base64: string;
};

/**
 * Låter användaren välja en bild i telefonens bildbibliotek, beskära den
 * kvadratiskt och förbereder den för uppladdning.
 *
 * @returns Den förberedda bilden, eller null om användaren avbröt.
 */
export async function pickGroupImage(): Promise<GroupImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return null;
  return prepareImage(result.assets[0].uri);
}

/**
 * Förminskar bilden och sparar den som JPEG. Om den ändå är för stor
 * komprimeras den hårdare, tills den är under MAX_BYTES.
 */
async function prepareImage(uri: string): Promise<GroupImage> {
  for (const compress of [0.8, 0.6, 0.4, 0.2]) {
    const image = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: SIZE, height: SIZE } }],
      { compress, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    // Base64 tar ungefär 4/3 så mycket plats som själva bilden.
    const bytes = Math.ceil(((image.base64 ?? '').length * 3) / 4);
    if (image.base64 && bytes <= MAX_BYTES) {
      return { uri: image.uri, base64: image.base64 };
    }
  }
  throw new Error('The picture is too large. Please choose another one.');
}

/**
 * Laddar upp gruppens bild och sparar adressen i groups.avatar_url.
 *
 * Får bara anropas av gruppens ägare, vilket både lagringsreglerna och
 * databasfunktionen set_group_avatar kontrollerar.
 *
 * @param groupId Gruppens id.
 * @param image   Bilden från pickGroupImage.
 * @returns       Bildens publika adress.
 * @throws        Om uppladdningen eller sparandet misslyckas.
 */
export async function uploadGroupAvatar(groupId: string, image: GroupImage): Promise<string> {
    const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('You need to be signed in to upload a picture.');

  // Tidsstämpeln gör filnamnet unikt, så att en ny bild aldrig behöver
  // skriva över en gammal fil. Den nya adressen gör också att den nya
  // bilden visas direkt, istället för en gammal som sparats i minnet.
  const path = `${userId}/${groupId}-${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(image.base64), { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = data.publicUrl;

  const { error: saveError } = await supabase.rpc('set_group_avatar', {
    group_id: groupId,
    avatar_url: url,
  });
  if (saveError) throw saveError;

  return url;
}