/**
 * add-song.tsx
 *
 * Fliken för att välja dagens låt.
 *
 * Visar användarens senast spelade låtar och låter hen söka efter fler.
 * Alla Spotify-anrop går via servern (se spotifyData.ts och
 * spotifySearch.ts), så appen hanterar aldrig några Spotify-nycklar.
 *
 * När man trycker på en låt öppnas en ruta mitt på skärmen där man kan
 * bekräfta eller stänga. Bekräftas låten sparas den i daily_songs.
 * Databasen sätter dagens datum i svensk tid, och tillåter bara en låt
 * per person och dag.
 *
 * Designen följer iOS: systemfärger som byter med mörkt läge, SF Symbols
 * och listor med tunna avdelare. Sökfältet följer med tangentbordet upp,
 * och senast spelade döljs medan man söker. Man lämnar sökningen med
 * krysset bredvid sökfältet, eller genom att byta flik.
 */

import { ThemedView } from '@/components/themed-view';
import { SEARCH_BAR_HEIGHT, SearchBar } from '@/components/ui/search-bar';
import { useTheme } from '@/hooks/use-theme';
import { useDailySong } from '@/lib/daily-song-context';
import { getErrorMessage } from '@/lib/errors';
import { getRecentlyPlayed } from '@/lib/spotifyData';
import { syncPlaylists } from '@/lib/spotifyPlaylists';
import { searchTracks, SpotifyNotConnectedError } from '@/lib/spotifySearch';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ColorValue,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardEvent,
  LayoutAnimation,
  Modal,
  Platform,
  PlatformColor,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  Keyframe,
  LinearTransition,
  runOnJS,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const glassSupported = isLiquidGlassAvailable();

/** Hur lång tid omslaget tar på sig att flyga ner till profilfliken. */
const FLY_DURATION_MS = 650;

/** Hur stort omslaget är när det landar på profilikonen. */
const FLY_TARGET_SIZE = 28;

/**
 * Rutan tonar in och krymper från lite större till rätt storlek, som
 * iOS egna dialogrutor.
 */
const popupEntering = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.08 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(220);

/**
 * En låt som kan väljas. Både senast spelade och sökresultat görs om till
 * den här formen, så att resten av sidan bara behöver hantera en typ.
 *
 * key är unik för varje rad i en lista. För senast spelade är det
 * tidpunkten då låten spelades.
 */
type Song = {
  key: string;
  id: string;
  name: string;
  artist_name: string;
  image_url: string | null;
};

/** Gör om en låt från servern till sidans egen form. */
function toSong(track: { id: string; name: string; artist_name: string; image_url: string | null }, key?: string): Song {
  return {
    key: key ?? track.id,
    id: track.id,
    name: track.name,
    artist_name: track.artist_name,
    image_url: track.image_url,
  };
}

/**
 * Tar bort låtar som redan finns tidigare i listan, så att varje låt bara
 * visas en gång. Den första behålls, vilket för senast spelade är den
 * senaste gången låten spelades.
 */
function uniqueSongs(songs: Song[]): Song[] {
  const seen = new Set<string>();
  return songs.filter((song) => {
    if (seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
}

type Colors = {
  label: ColorValue;
  secondaryLabel: ColorValue;
  placeholder: ColorValue;
  separator: ColorValue;
  highlight: ColorValue;
  fill: ColorValue;
  popup: ColorValue;
  tint: ColorValue;
  onTint: ColorValue;
  red: ColorValue;
};

/**
 * Färgerna på sidan. På iOS används systemets egna färger, som byter
 * automatiskt mellan ljust och mörkt läge. På Android används appens tema.
 *
 * tint är färgen på Confirm-knappen. Byt systemBlue mot appens egen färg
 * om ni har en.
 */
function useColors(): Colors {
  const theme = useTheme();

  if (Platform.OS === 'ios') {
    return {
      label: PlatformColor('label'),
      secondaryLabel: PlatformColor('secondaryLabel'),
      placeholder: PlatformColor('placeholderText'),
      separator: PlatformColor('separator'),
      highlight: PlatformColor('systemGray5'),
      fill: PlatformColor('tertiarySystemFill'),
      popup: PlatformColor('secondarySystemGroupedBackground'),
      tint: PlatformColor('systemIndigo'),
      onTint: '#fff',
      red: PlatformColor('systemRed'),
    };
  }

  return {
    label: theme.text,
    secondaryLabel: '#8e8e93',
    placeholder: '#8e8e93',
    separator: 'rgba(128,128,128,0.3)',
    highlight: theme.backgroundSelected,
    fill: theme.backgroundElement,
    popup: theme.background,
    tint: '#0a84ff',
    onTint: '#fff',
    red: '#ff3b30',
  };
}

/** Omslag med tunn kant, som i Apple Music. Visar en not om bild saknas. */
function Cover({ uri, size, radius, colors }: { uri: string | null; size: number; radius: number; colors: Colors }) {
  const style = [styles.cover, { width: size, height: size, borderRadius: radius, borderColor: colors.separator }];

  if (uri) return <Image source={{ uri }} style={style} />;

  return (
    <View style={[style, styles.coverPlaceholder, { backgroundColor: colors.fill }]}>
      <SymbolView
        name="music.note"
        size={size * 0.35}
        tintColor={colors.secondaryLabel}
        fallback={<Ionicons name="musical-note" size={size * 0.35} color={colors.secondaryLabel as string} />}
      />
    </View>
  );
}

// --- Omslaget som flyger till profilen ---

/** En ruta på skärmen, i fönstrets koordinater. */
type Rect = { x: number; y: number; width: number; height: number };

/**
 * Var profilikonen i flikraden finns på skärmen, ungefär.
 *
 * Flikraden är iOS egen, så appen kan inte mäta var knapparna hamnar.
 * Platsen räknas istället ut från hur flikraden brukar se ut:
 *
 * - Med Liquid Glass (iOS 26) ligger Feed, Groups och Profile i en ö
 *   till vänster, och Daily Track som en egen rund knapp till höger.
 *   Profile är den sista av tre i ön.
 * - Annars är flikraden lika bred som skärmen med fyra lika breda
 *   flikar, och Profile är den tredje.
 *
 * Hamnar omslaget lite fel, justera siffrorna här.
 */
function profileTabCenter(width: number, height: number, bottomInset: number) {
  // Ikonen sitter lite ovanför flikradens mitt, med texten under.
  const y = height - bottomInset - 24;

  if (glassSupported) {
    const islandLeft = 20;
    // Daily Track-knappen (62 bred) och mellanrummet till ön.
    const islandRight = width - 20 - 62 - 12;
    return { x: islandLeft + ((islandRight - islandLeft) * 5) / 6, y };
  }

  return { x: (width * 2.5) / 4, y };
}

/**
 * En kopia av omslaget som flyger från rutan ner till profilfliken, som
 * om låten sparas där.
 *
 * Omslaget glider först åt sidan och faller sedan nedåt, så att det rör
 * sig i en båge. På vägen krymper det och blir runt som en profilbild, och
 * tonas bort precis när det landar.
 *
 * Kopian ligger utanför rutan, eftersom rutan klipper bort allt som hamnar
 * utanför dess kanter.
 */
function FlyingCover({
  uri,
  from,
  to,
  colors,
  onDone,
}: {
  uri: string | null;
  from: Rect;
  to: { x: number; y: number };
  colors: Colors;
  onDone: () => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    // onDone körs även om animationen avbryts, så att sparandet inte
    // fastnar och väntar.
    progress.value = withTiming(1, { duration: FLY_DURATION_MS, easing: Easing.inOut(Easing.quad) }, () => {
      runOnJS(onDone)();
    });
  }, []);

  const dx = to.x - (from.x + from.width / 2);
  const dy = to.y - (from.y + from.height / 2);
  const endScale = FLY_TARGET_SIZE / from.width;

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    // Sidled går fort i början, höjdled fort i slutet. Det ger bågen.
    const easeOut = 1 - (1 - p) * (1 - p);
    const easeIn = p * p;

    return {
      opacity: interpolate(p, [0.85, 1], [1, 0], Extrapolation.CLAMP),
      borderRadius: interpolate(p, [0.2, 0.9], [0, from.width / 2], Extrapolation.CLAMP),
      transform: [
        { translateX: dx * easeOut },
        { translateY: dy * easeIn },
        // Lyfts lite först, som när man plockar upp något.
        { scale: interpolate(p, [0, 0.15, 1], [1, 1.05, endScale], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flyingCover,
        { left: from.x, top: from.y, width: from.width, height: from.height },
        animatedStyle,
      ]}
    >
      <Cover uri={uri} size={from.width} radius={0} colors={colors} />
    </Animated.View>
  );
}

// --- Hjulet med senast spelade ---

/**
 * Omslagens storlek. Resten av hjulets mått räknas fram från den, så att
 * hjulet ser likadant ut i alla storlekar.
 */
const WHEEL_COVER = 280;
/** Avståndet mellan två omslags mittpunkter längs hjulet. */
const WHEEL_STEP = Math.round(WHEEL_COVER * 1.04);
/**
 * Hjulets radie. Mindre radie ger ett snävare hjul där omslagen snurrar
 * bort snabbare, större ger en plattare båge.
 */
const WHEEL_RADIUS = WHEEL_COVER * 2.5;
/**
 * Längst ner i hjulet tonas omslagen bort mot bakgrunden, istället för
 * att klippas av rakt. Det här är hur hög den toningen är.
 */
const WHEEL_FADE = 40;
/**
 * Hur stora omslagen vid sidan är jämfört med det i mitten. 1 betyder
 * lika stora, lägre gör dem mindre.
 */
const WHEEL_SIDE_SCALE = 0.7;
/**
 * Hur många gånger låtarna upprepas för att hjulet ska kännas oändligt.
 * Med 50 senast spelade blir det 1 050 omslag, men bara de som syns ritas.
 */
const WHEEL_LOOPS = 21;
/**
 * Hur många varv från en ände hjulet får komma innan det hoppar tillbaka
 * till mitten. Hoppet sker bara när hjulet har stannat.
 */
const WHEEL_RECENTER_MARGIN = 3;
/**
 * Hur mycket av hjulet som syns: omslaget i mitten, plus toningen under.
 * Omslagen vid sidan sjunker ner i toningen och försvinner.
 */
const WHEEL_HEIGHT = 8 + WHEEL_COVER + WHEEL_FADE;

/**
 * Gör en färg genomskinlig, för toningens övre kant. En toning till
 * 'transparent' blir grå på iOS, eftersom det räknas som genomskinligt
 * svart.
 */
function withoutAlpha(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}00` : 'transparent';
}

/**
 * Ett omslag på hjulet.
 *
 * Omslaget placeras på en cirkel utifrån hur långt det är från mitten av
 * skärmen. Rakt i mitten står det upprätt högst upp. Längre ut lutar det,
 * sjunker nedåt och tonas bort, som om hjulet snurrar det ur bild.
 *
 * Bara det inre omslaget flyttas. Den yttre Pressable ligger kvar som en
 * vanlig kolumn, så att tryck hamnar rätt även om omslaget har flyttats.
 */
function WheelItem({
  track,
  index,
  scrollX,
  onPress,
}: {
  track: Song;
  index: number;
  scrollX: SharedValue<number>;
  onPress: (index: number) => void;
}) {
  const colors = useColors();

  const animatedStyle = useAnimatedStyle(() => {
    // Avstånd från skärmens mitt, i pixlar längs listan.
    const offset = index * WHEEL_STEP - scrollX.value;
    // Samma avstånd som vinkel på hjulet, högst ett kvarts varv åt varje håll.
    const angle = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, offset / WHEEL_RADIUS));

    return {
      opacity: interpolate(Math.abs(angle), [0, 1.1], [1, 0], Extrapolation.CLAMP),
      transform: [
        // Flytta från platsen i den raka listan till platsen på cirkeln.
        { translateX: WHEEL_RADIUS * Math.sin(angle) - offset },
        { translateY: WHEEL_RADIUS * (1 - Math.cos(angle)) },
        { rotate: `${angle}rad` },
        // Omslaget i mitten är fullstort, grannarna mindre. Växer när
        // de dras in mot mitten.
        { scale: interpolate(Math.abs(offset), [0, WHEEL_STEP], [1, WHEEL_SIDE_SCALE], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Pressable
      onPress={() => onPress(index)}
      style={styles.wheelItem}
      accessibilityRole="button"
      accessibilityLabel={`${track.name} by ${track.artist_name}`}
    >
      <Animated.View style={animatedStyle}>
        <Cover uri={track.image_url} size={WHEEL_COVER} radius={0} colors={colors} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Senast spelade som ett hjul, som trumman i en revolver. Man ser bara
 * övre delen, och omslagen snurrar bort åt sidorna när man drar.
 *
 * Hjulet stannar alltid med ett omslag i mitten, och det vibrerar varje
 * gång ett nytt omslag hamnar där. Under hjulet visas låten i mitten.
 *
 * Choose-knappen under, eller ett tryck på omslaget i mitten, öppnar
 * rutan för att bekräfta. Trycker man på ett omslag vid sidan snurrar
 * hjulet fram det.
 */
function RecentWheel({ songs, onPick }: { songs: Song[]; onPick: (track: Song) => void }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const listRef = useRef<FlatList<Song>>(null);

  // Hjulet har ingen början eller slut. Låtarna upprepas många gånger
  // efter varandra, och man börjar i mitten. Kommer man för nära någon
  // av ändarna hoppar listan osynligt tillbaka till samma låt i mitten.
  const count = songs.length;
  const loopedSongs = useMemo(
    () => Array.from({ length: WHEEL_LOOPS }, () => songs).flat(),
    [songs]
  );
  const middleStart = Math.floor(WHEEL_LOOPS / 2) * count;

  // Index här är platsen i den upprepade listan. Vilken låt det är fås
  // med index % count.
  const scrollX = useSharedValue(middleStart * WHEEL_STEP);
  const lastIndex = useSharedValue(middleStart);
  const [centerIndex, setCenterIndex] = useState(middleStart);

  /** Körs varje gång ett nytt omslag hamnar i mitten. */
  function handleTick(index: number) {
    // Rigid är en kort, hård stöt, som ett mekaniskt klick. Vill du ha
    // ännu mer, prova Heavy. Light och Medium är mjukare.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    setCenterIndex(index);
  }

  /**
   * Hoppar tillbaka till mitten av listan när hjulet har stannat nära en
   * av ändarna. Samma låt hamnar på exakt samma plats, så hoppet syns
   * inte och vibrerar inte.
   */
  function recenter(offsetX: number) {
    const index = Math.round(offsetX / WHEEL_STEP);
    const margin = WHEEL_RECENTER_MARGIN * count;
    if (index >= margin && index < loopedSongs.length - margin) return;

    const target = middleStart + (index % count);
    lastIndex.value = target;
    setCenterIndex(target);
    listRef.current?.scrollToOffset({ offset: target * WHEEL_STEP, animated: false });
  }

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;

      const index = Math.round(event.contentOffset.x / WHEEL_STEP);
      if (index !== lastIndex.value) {
        lastIndex.value = index;
        runOnJS(handleTick)(index);
      }
    },
    onMomentumEnd: (event) => {
      runOnJS(recenter)(event.contentOffset.x);
    },
  });

  function handlePress(index: number) {
    if (index === centerIndex) {
      onPick(loopedSongs[index]);
    } else {
      listRef.current?.scrollToOffset({ offset: index * WHEEL_STEP, animated: true });
    }
  }

  const centered = loopedSongs[centerIndex];

  return (
    <View>
      <Animated.FlatList
        ref={listRef}
        horizontal
        data={loopedSongs}
        // Samma låt finns många gånger, så platsen i listan ingår i nyckeln.
        keyExtractor={(track: Song, index: number) => `recent-${track.key}-${index}`}
        // Alla omslag är lika breda. Då kan listan börja i mitten direkt,
        // utan att först rita upp allt före.
        getItemLayout={(_: unknown, index: number) => ({ length: WHEEL_STEP, offset: WHEEL_STEP * index, index })}
        initialScrollIndex={middleStart}
        initialNumToRender={5}
        windowSize={5}
        renderItem={({ item, index }: { item: Song; index: number }) => (
          <WheelItem track={item} index={index} scrollX={scrollX} onPress={handlePress} />
        )}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={WHEEL_STEP}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        // Luft på båda sidor, så att första och sista omslaget kan hamna i mitten.
        contentContainerStyle={{ paddingHorizontal: (width - WHEEL_STEP) / 2 }}
        style={styles.wheel}
      />

      {/* Toningen ligger ovanpå hjulets nederkant, under omslaget i mitten. */}
      <LinearGradient
        colors={[withoutAlpha(theme.background), theme.background]}
        style={styles.wheelFade}
        pointerEvents="none"
      />

      {centered && (
        <View style={styles.wheelInfo}>
          <Text style={[styles.wheelTitle, { color: colors.label }]} numberOfLines={1}>{centered.name}</Text>
          <Text style={[styles.wheelArtist, { color: colors.secondaryLabel }]} numberOfLines={1}>
            {centered.artist_name}
          </Text>

          <Pressable
            onPress={() => onPick(centered)}
            style={({ pressed }) => [styles.chooseButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${centered.name}`}
          >
            <Text style={[styles.chooseText, { color: colors.onTint }]}>Choose</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Rad i sökresultaten. Grå medan man trycker, som i iOS egna listor. */
function TrackRow({ track, index, onPress }: { track: Song; index: number; onPress: (track: Song) => void }) {
  const colors = useColors();

  return (
    <Animated.View entering={FadeIn.duration(200).delay(index < 8 ? index * 30 : 0)}>
      <Pressable
        onPress={() => onPress(track)}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.highlight }]}
        accessibilityRole="button"
        accessibilityLabel={`Pick ${track.name}`}
      >
        <Cover uri={track.image_url} size={48} radius={4} colors={colors} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.label }]} numberOfLines={1}>{track.name}</Text>
          <Text style={[styles.rowArtist, { color: colors.secondaryLabel }]} numberOfLines={1}>{track.artist_name}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Rutan mitt på skärmen där man bekräftar låten.
 *
 * När låten är sparad blir flying sann. Då tonar rutan bort och omslaget
 * flyger ner till profilfliken, vilket är bekräftelsen på att låten är
 * sparad. onFlown körs när det har landat.
 *
 * Medan låten sparas, och efter att den är sparad, går rutan inte att
 * stänga.
 */
function ConfirmPopup({
  track,
  saving,
  flying,
  onClose,
  onConfirm,
  onFlown,
}: {
  track: Song | null;
  saving: boolean;
  flying: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onFlown: () => void;
}) {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Omslagets plats i rutan, uppmätt när det ska flyga. Medan kopian
  // flyger döljs omslaget i rutan.
const coverRef = useRef<React.ComponentRef<typeof View>>(null);
  const [flyFrom, setFlyFrom] = useState<Rect | null>(null);

  // Rutan och den mörka bakgrunden tonas bort när omslaget lyfter.
  const fade = useSharedValue(1);

  useEffect(() => {
    if (!flying) {
      setFlyFrom(null);
      fade.value = 1;
      return;
    }

    coverRef.current?.measureInWindow((x, y, w, h) => {
      setFlyFrom({ x, y, width: w, height: h });
      fade.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
    });
  }, [flying]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: interpolate(fade.value, [0, 1], [0.94, 1]) }],
  }));

  // Rutan tonar ut efter att track blivit null. Den senaste låten sparas
  // så att innehållet inte försvinner mitt i uttoningen.
  const lastTrack = useRef<Song | null>(null);
  if (track) lastTrack.current = track;
  const shown = track ?? lastTrack.current;

  const busy = saving || flying;
  const close = busy ? undefined : onClose;

  return (
    <Modal visible={!!track} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.popupRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
          <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={close} accessibilityLabel="Close" />
        </Animated.View>

        {shown && (
          <Animated.View entering={popupEntering} style={styles.popupWrap}>
            <Animated.View style={cardStyle}>
            <GlassView
              style={[styles.popup, !glassSupported && { backgroundColor: colors.popup }]}
              glassEffectStyle="regular"
            >
              <View ref={coverRef} collapsable={false} style={flyFrom && styles.hidden}>
                <Cover uri={shown.image_url} size={200} radius={0} colors={colors} />
              </View>

              <View style={styles.popupText}>
                <Text style={[styles.popupTitle, { color: colors.label }]} numberOfLines={2}>{shown.name}</Text>
                <Text style={[styles.popupArtist, { color: colors.secondaryLabel }]} numberOfLines={1}>
                  {shown.artist_name}
                </Text>
                <Text style={[styles.popupNote, { color: colors.secondaryLabel }]}>
                  This will be your track for all groups today.
                </Text>
              </View>

              <View style={styles.popupButtons}>
                <View style={styles.popupButtonWrap}>
                  <Pressable
                    onPress={onClose}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.popupButton,
                      { backgroundColor: colors.fill },
                      (pressed || busy) && styles.pressed,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.popupButtonText, { color: colors.label }]}>Cancel</Text>
                  </Pressable>
                </View>

                <View style={styles.popupButtonWrap}>
                  <Pressable
                    onPress={onConfirm}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.popupButton,
                      { backgroundColor: colors.tint },
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Confirm ${shown.name}`}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.onTint as string} />
                    ) : (
                      <Text style={[styles.popupButtonText, styles.confirmText, { color: colors.onTint }]}>Confirm</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </GlassView>
            </Animated.View>
          </Animated.View>
        )}

        {shown && flyFrom && (
          <FlyingCover
            uri={shown.image_url}
            from={flyFrom}
            to={profileTabCenter(width, height, insets.bottom)}
            colors={colors}
            onDone={onFlown}
          />
        )}
      </View>
    </Modal>
  );
}

export default function AddSongScreen() {
  const [query, setQuery] = useState('');
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  const [tracks, setTracks] = useState<Song[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<Song | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flying, setFlying] = useState(false);
  const flyDone = useRef<(() => void) | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { refresh: refreshDailySong } = useDailySong();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  // --- Tangentbordet ---

  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Medan man söker döljs senast spelade, så att resultaten får plats.
  // Sidan räknas som i sökläge så länge det står något i fältet, så att
  // senast spelade inte hoppar tillbaka när tangentbordet stängs efter
  // en sökning.
  const searching = searchFocused || query.trim().length > 0;

  // Avståndet mellan sidans nederkant och skärmens nederkant, till exempel
  // om flikraden ligger under sidan. Behövs för att räkna ut hur högt
  // sökfältet ska lyftas.
const rootRef = useRef<React.ComponentRef<typeof View>>(null);
  const [bottomGap, setBottomGap] = useState(0);

  function measureBottomGap() {
    rootRef.current?.measureInWindow((_x, y, _width, height) => {
      const gap = Math.max(0, Dimensions.get('window').height - (y + height));
      setBottomGap(gap);
    });
  }

  // Tangentbordets höjd. Sökfältet och listan flyttas med vanlig layout
  // när den ändras, och LayoutAnimation gör att det glider i samma takt
  // och kurva som tangentbordet. Det är samma teknik som React Natives
  // egen KeyboardAvoidingView använder.
  //
  // Sökfältet flyttades tidigare med Reanimated. Då flyttades bara det man
  // ser, medan appen räknade tryck utifrån den gamla platsen längst ner.
  // Tryck på krysset hamnade därför i listan bakom, som bara stängde
  // tangentbordet. Med vanlig layout ligger knapparna där de syns.
  useEffect(() => {
    function animateWithKeyboard(event: KeyboardEvent) {
      if (Platform.OS !== 'ios' || !event.duration) return;
      LayoutAnimation.configureNext({
        duration: event.duration,
        update: { duration: event.duration, type: LayoutAnimation.Types.keyboard },
      });
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      animateWithKeyboard(event);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, (event) => {
      animateWithKeyboard(event);
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /**
   * Visar ett begripligt fel. Om Spotify-kopplingen har gått ut skickas
   * användaren till inloggningen.
   */
  function handleSpotifyError(error: unknown) {
    if (error instanceof SpotifyNotConnectedError) {
      router.replace('/login');
      return;
    }
    setErrorMessage(getErrorMessage(error));
  }

  async function loadRecentSongs() {
    setLoadingRecent(true);
    try {
      const recent = await getRecentlyPlayed();
      setRecentSongs(uniqueSongs(recent.map((track) => toSong(track, track.played_at))));
    } catch (error) {
      handleSpotifyError(error);
    } finally {
      setLoadingRecent(false);
    }
  }

  useEffect(() => {
    loadRecentSongs();
  }, []);

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      const results = await searchTracks(trimmed);
      setTracks(uniqueSongs(results.map((track) => toSong(track))));
    } catch (error) {
      handleSpotifyError(error);
    } finally {
      setLoading(false);
    }
  }

  /** Lämnar sökläget och visar Recently Played igen. */
  function exitSearch() {
    setQuery('');
    setTracks([]);
    setSearchFocused(false);
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  }

  // Byter man flik mitt i en sökning börjar sidan om från Recently Played
  // nästa gång man kommer tillbaka.
  useFocusEffect(
    useCallback(() => {
      return () => exitSearch();
    }, [])
  );

  /** Öppnar rutan för att bekräfta en låt. */
  function openPopup(track: Song) {
    Keyboard.dismiss();
    setFlying(false);
    setSelectedTrack(track);
  }

  /**
   * Låter omslaget flyga ner till profilfliken, och väntar tills det har
   * landat. Vibrationen kommer när det landar, som bekräftelse.
   */
  function flyCoverToProfile() {
    return new Promise<void>((resolve) => {
      flyDone.current = () => {
        flyDone.current = null;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        resolve();
      };
      setFlying(true);
    });
  }

  /**
   * Sparar en låt som dagens låt i databasen.
   */
  async function saveDailySong(track: Song) {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) throw new Error('You need to be signed in to pick a song.');

    // song_date utelämnas: databasen sätter dagens datum i svensk tid.
    const { error } = await supabase.from('daily_songs').insert({
      user_id: userId,
      spotify_track_id: track.id,
      track_name: track.name,
      artist_name: track.artist_name,
      image_url: track.image_url,
    });

    // 23505 = unik regel bruten: användaren har redan valt en låt idag.
    if (error?.code === '23505') {
      throw new Error("You've already picked today's song.");
    }
    if (error) throw error;
  }

  /**
   * Väljer den valda låten som dagens låt.
   *
   * Appen ska kännas snabb, så man skickas direkt till flödet när man
   * trycker Confirm. Samtidigt flyger omslaget ner till profilfliken och
   * låten sparas i bakgrunden. Rutan ligger ovanpå allt, även flikarna, så
   * flygningen syns över flödet.
   *
   * Misslyckas sparandet visas felet efteråt. Det händer sällan, eftersom
   * fliken döljs så fort dagens låt är vald.
   */
  async function confirmSelection() {
    const track = selectedTrack;
    if (!track || saving || flying) return;

    setSaving(true);
    const landed = flyCoverToProfile();
    router.replace('/');

    let saved = false;
    try {
      await saveDailySong(track);
      saved = true;
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not save the song', getErrorMessage(error));
    }

    // Rutan stängs först när omslaget har landat, annars försvinner det
    // mitt i flygningen.
    await landed;
    setSelectedTrack(null);
    setSaving(false);
    if (!saved) return;

    // Lägger låten i spellistorna för alla grupper användaren är med i, i
    // bakgrunden. syncPlaylists kastar inte: misslyckas synken gäller valet
    // ändå, och nattjobbet hinner ikapp vid nästa körning.
    syncPlaylists();

    // Görs sist: när appen får veta att dagens låt är vald döljs den här
    // fliken. Görs det medan omslaget flyger stängs rutan för tidigt.
    await refreshDailySong();
  }

  // Plats under listan för sökfältet, och för tangentbordet när det är uppe.
  const keyboardSpace = Math.max(0, keyboardHeight - bottomGap - insets.bottom);
  const bottomSpace = SEARCH_BAR_HEIGHT + 32 + insets.bottom + keyboardSpace;

  return (
    <ThemedView style={styles.container}>
      {/* Osynlig vy som bara används för att mäta sidans plats på skärmen. */}
      <View ref={rootRef} onLayout={measureBottomGap} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.flex}>
          <Animated.FlatList
            // Sökresultaten syns bara medan man söker.
            data={searching ? tracks : []}
            keyExtractor={(track: Song) => track.key}
            // Raderna glider upp mjukt när senast spelade döljs.
            itemLayoutAnimation={LinearTransition.duration(250)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingBottom: bottomSpace }}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: colors.separator }]} />
            )}
            ListHeaderComponent={
              <>
                <Text style={[styles.largeTitle, { color: colors.label }]} accessibilityRole="header">
                  Add Track
                </Text>
                <Text style={[styles.subtitle, { color: colors.secondaryLabel }]}>
                  This will be your track for all groups today, so choose wisely. Or don't.
                </Text>

                {!searching && (
                  <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                    <Text style={[styles.sectionTitle, { color: colors.label }]} accessibilityRole="header">
                      Recently Played
                    </Text>
                    {loadingRecent ? (
                      <ActivityIndicator style={styles.recentLoading} />
                    ) : recentSongs.length > 0 ? (
                      <RecentWheel songs={recentSongs} onPick={openPopup} />
                    ) : (
                      <Text style={[styles.empty, { color: colors.secondaryLabel }]}>No recent tracks found.</Text>
                    )}
                  </Animated.View>
                )}

                {searching && (
                  <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                    <Text style={[styles.sectionTitle, { color: colors.label }]} accessibilityRole="header">
                      Search Results
                    </Text>
                  </Animated.View>
                )}

                {/* Felet visas alltid, eftersom det också kan gälla senast spelade. */}
                {errorMessage && (
                  <Animated.View layout={LinearTransition.duration(250)}>
                    <Text style={[styles.error, { color: colors.red }]}>{errorMessage}</Text>
                  </Animated.View>
                )}
              </>
            }
            renderItem={({ item, index }: { item: Song; index: number }) => (
              <TrackRow track={item} index={index} onPress={openPopup} />
            )}
            ListEmptyComponent={
              searching && !loading ? (
                <Text style={[styles.empty, { color: colors.secondaryLabel }]}>
                  Search for a song to see results.
                </Text>
              ) : undefined
            }
          />

          <View
            style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 8, bottom: keyboardSpace }]}
            pointerEvents="box-none"
          >
            {/* I sökläge blir knappen ett kryss som lämnar sökningen.
                Att söka görs då med tangentbordets Search-knapp. */}
            <SearchBar
              ref={searchInputRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search for a song"
              clearButtonMode="while-editing"
              enablesReturnKeyAutomatically
              loading={loading}
              button={
                searching
                  ? // onPress finns kvar för VoiceOver, som inte alltid skickar onPressIn.
                    { icon: 'close', onPress: exitSearch, onPressIn: exitSearch }
                  : { icon: 'search', onPress: handleSearch }
              }
            />
          </View>
        </View>
      </SafeAreaView>

      <ConfirmPopup
        track={selectedTrack}
        saving={saving}
        flying={flying}
        onClose={() => setSelectedTrack(null)}
        onConfirm={confirmSelection}
        onFlown={() => flyDone.current?.()}
      />
    </ThemedView>
  );
}

// Textstorlekar följer iOS: Large Title 34, Title 2 22, Title 3 20,
// Body 17, Subheadline 15, Footnote 13.
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },

  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.4, paddingHorizontal: 16, marginTop: 8 },
  subtitle: { fontSize: 15, lineHeight: 20, paddingHorizontal: 16, marginTop: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '700', letterSpacing: 0.35, paddingHorizontal: 16, marginTop: 28, marginBottom: 10 },

  // Senast spelade
  recentLoading: { marginVertical: 48 },

  // Hjulet. ScrollView klipper bort det som hamnar under kanten.
  wheel: { height: WHEEL_HEIGHT },
  wheelFade: { position: 'absolute', left: 0, right: 0, top: WHEEL_HEIGHT - WHEEL_FADE, height: WHEEL_FADE },
  wheelItem: { width: WHEEL_STEP, height: WHEEL_HEIGHT, alignItems: 'center', paddingTop: 8 },
  // Dras upp in i toningen, så att titeln hamnar nära omslaget.
  wheelInfo: { alignItems: 'center', paddingHorizontal: 32, marginTop: -WHEEL_FADE + 10 },
  wheelTitle: { fontSize: 17, fontWeight: '600' },
  wheelArtist: { fontSize: 15, marginTop: 1 },
  chooseButton: { height: 50, borderRadius: 25, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  chooseText: { fontSize: 17, fontWeight: '600' },

  // Omslag
  cover: { borderWidth: StyleSheet.hairlineWidth },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },

  // Sökresultat. Avdelaren börjar där texten börjar, som i iOS listor.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 17 },
  rowArtist: { fontSize: 15, marginTop: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 + 48 + 12 },

  empty: { fontSize: 15, paddingHorizontal: 16, paddingVertical: 12 },
  error: { fontSize: 15, paddingHorizontal: 16, marginBottom: 8 },

  // Rutan för att bekräfta
  popupRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  popupWrap: { width: '100%', maxWidth: 340 },
  popup: { borderRadius: 32, padding: 20, alignItems: 'center', overflow: 'hidden' },
  popupText: { alignSelf: 'stretch', alignItems: 'center', marginTop: 16 },
  popupTitle: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  popupArtist: { fontSize: 17, marginTop: 2 },
  popupNote: { fontSize: 13, textAlign: 'center', marginTop: 12 },
  popupButtons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 20 },
  popupButtonWrap: { flex: 1 },
  popupButton: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  popupButtonText: { fontSize: 17, fontWeight: '500' },
  confirmText: { fontWeight: '600' },
  hidden: { opacity: 0 },
  flyingCover: { position: 'absolute', overflow: 'hidden' },

  // Sökfältet längst ner
  bottomOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
});