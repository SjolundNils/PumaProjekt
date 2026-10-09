/**
 * search-test.tsx
 *
 * TESTSKÄRM. Ska tas bort innan appen är klar.
 *
 * Söker efter låtar och låter användaren välja dagens låt.
 *
 * Sökningen går via Edge Function search-tracks (se lib/spotifySearch.ts).
 * Funktionen söker mot Spotify med användarens sparade nyckel och förnyar
 * den vid behov, så appen behöver aldrig hantera Spotify-nycklar själv.
 * Om Spotify-kopplingen saknas eller har återkallats skickas användaren
 * till inloggningen.
 *
 * När en låt väljs sparas den i daily_songs. Datumet (song_date) sätts av
 * databasen, eftersom dagen byter klockan 04:00 svensk tid. Därefter synkas
 * spellistorna för alla grupper användaren är med i (lib/spotifyPlaylists.ts).
 * Regeln "en låt per dag" avgörs av databasen (felkod 23505).
 *
 * Sökfältet använder iOS Liquid Glass via expo-glass-effect och svävar
 * längst ner över listan, så att skivomslagen syns genom glaset när man
 * scrollar. På Android och iOS äldre än 26 används en vanlig grå bakgrund.
 */

import { syncPlaylists } from '@/lib/spotifyPlaylists';
import { searchTracks, SpotifyNotConnectedError, TrackHit } from '@/lib/spotifySearch';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { router } from 'expo-router';
import { useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Image,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Kontrolleras en gång när filen laddas. Är glaset inte tillgängligt
 * faller GlassView tillbaka till en genomskinlig View, så då lägger vi
 * på en egen bakgrund (styles.fallback).
 */
const glassSupported = isLiquidGlassAvailable();

/** Höjd på sökfältet och knappen. Används även för listans nedre marginal. */
const SEARCH_BAR_HEIGHT = 48;

export default function SearchTestScreen() {
	const [query, setQuery] = useState('');
	const [tracks, setTracks] = useState<TrackHit[]>([]);
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Behövs för att sökfältet inte ska hamna under hemindikatorn.
	const insets = useSafeAreaInsets();

	/**
	 * Skickar sökningen till Spotify och sparar resultatet.
	 */
	async function handleSearch() {
		const trimmed = query.trim();
		if (trimmed.length < 2 || loading) return;

		setLoading(true);
		setErrorMessage(null);

		try {
			setTracks(await searchTracks(trimmed));
		} catch (error) {
			if (error instanceof SpotifyNotConnectedError) {
				// Spotify-kopplingen saknas eller har återkallats: logga in igen
				router.replace('/login');
				return;
			}
			setErrorMessage(error instanceof Error ? error.message : 'Okänt fel');
		} finally {
			setLoading(false);
		}
	}

	async function chooseSong(track: TrackHit) {
		try {
			const { data: userData, error: userError } = await supabase.auth.getUser();
			if (userError || !userData.user) {
				Alert.alert('Du är inte inloggad');
				return;
			}

			// song_date skickas INTE med: databasen sätter dagens datum själv
			// (dagen byter klockan 04:00 svensk tid).
			const { error } = await supabase.from('daily_songs').insert({
				user_id: userData.user.id,
				spotify_track_id: track.id,
				track_name: track.name,
				artist_name: track.artist_name,
				image_url: track.image_url,
			});

			if (error) {
				// 23505 = regeln "en låt per dag" (daily_songs_one_per_day)
				if (error.code === '23505') {
					Alert.alert('Du har redan valt dagens låt');
				} else {
					console.log('Kunde inte spara låten:', error);
					Alert.alert('Kunde inte spara låten', error.message);
				}
				return;
			}

			// Lägger låten i spellistorna för alla grupper användaren är med i.
			// Misslyckas synken ska valet ändå gälla, och nattjobbet hinner ikapp.
			await syncPlaylists();
			Alert.alert('Klart', `${track.name} är din låt för idag`);
		} catch (error) {
			console.log('Fel när låten skulle sparas:', error);
			Alert.alert('Något gick fel', error instanceof Error ? error.message : 'Okänt fel');
		}
	}

	return (
		// Endast övre kanten här. Den nedre hanteras av sökfältet självt.
		<SafeAreaView style={styles.container} edges={['top']}>
			<Text style={styles.title}>Söktest</Text>
			{errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

			{/* Skjuter upp sökfältet när tangentbordet visas. */}
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<View style={styles.flex}>
					<FlatList
						data={tracks}
						keyExtractor={(track) => track.id}
						// Låter en tryckning på en rad fungera även när tangentbordet är uppe.
						keyboardShouldPersistTaps="handled"
						// Plats så att sista raden inte göms bakom sökfältet.
						contentContainerStyle={{
							paddingHorizontal: 16,
							paddingBottom: SEARCH_BAR_HEIGHT + 32 + insets.bottom,
						}}
						renderItem={({ item }) => (
							<Pressable style={styles.row} onPress={() => chooseSong(item)}>
								{item.image_url && <Image source={{ uri: item.image_url }} style={styles.cover} />}

								<View style={styles.rowText}>
									<Text style={styles.trackName} numberOfLines={1}>
										{item.name}
									</Text>
									<Text style={styles.artist} numberOfLines={1}>
										{item.artist_name}
									</Text>
								</View>
							</Pressable>
						)}
					/>

					{/*
          Svävande sökfält. pointerEvents="box-none" gör att tryck utanför
          själva fältet går igenom till listan bakom.
        */}
					<View
						style={[styles.searchOverlay, { paddingBottom: insets.bottom + 8 }]}
						pointerEvents="box-none"
					>
						{/* GlassContainer låter fältet och knappen smälta ihop visuellt. */}
						<GlassContainer spacing={10} style={styles.searchRow}>
							<GlassView
								style={[styles.searchField, !glassSupported && styles.fallback]}
								glassEffectStyle="regular"
							>
								<Ionicons name="search" size={18} color="#8e8e93" />
								<TextInput
									style={styles.input}
									value={query}
									onChangeText={setQuery}
									onSubmitEditing={handleSearch}
									placeholder="Sök efter en låt"
									placeholderTextColor="#8e8e93"
									returnKeyType="search"
									autoCorrect={false}
									clearButtonMode="while-editing"
								/>
							</GlassView>

							{/*
              isInteractive ger glaset iOS-reaktionen vid tryck. Den kan bara
              sättas vid montering. Använd inte opacity för att visa att
              knappen är inaktiv, det gör att glaset renderas fel.
            */}
							<GlassView
								style={[styles.searchButton, !glassSupported && styles.fallback]}
								glassEffectStyle="regular"
								isInteractive
							>
								<Pressable
									onPress={handleSearch}
									disabled={loading}
									style={styles.searchButtonInner}
									accessibilityRole="button"
									accessibilityLabel="Sök"
								>
									{loading ? (
										<ActivityIndicator />
									) : (
										<Ionicons name="arrow-forward" size={20} color="#000" />
									)}
								</Pressable>
							</GlassView>
						</GlassContainer>
					</View>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#fff' },
	flex: { flex: 1 },
	title: { fontSize: 24, fontWeight: '700', marginBottom: 12, paddingHorizontal: 16 },
	error: { color: '#c00', marginBottom: 12, paddingHorizontal: 16 },

	// Listan
	row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
	cover: { width: 48, height: 48, borderRadius: 4 },
	rowText: { flex: 1 },
	trackName: { fontSize: 16, fontWeight: '600' },
	artist: { fontSize: 14, color: '#666' },

	// Sökfältet
	searchOverlay: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		paddingHorizontal: 16,
	},
	searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	searchField: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		height: SEARCH_BAR_HEIGHT,
		borderRadius: SEARCH_BAR_HEIGHT / 2, // halva höjden ger kapselform
		paddingHorizontal: 16,
	},
	input: { flex: 1, fontSize: 17, paddingVertical: 0 },
	searchButton: {
		width: SEARCH_BAR_HEIGHT,
		height: SEARCH_BAR_HEIGHT,
		borderRadius: SEARCH_BAR_HEIGHT / 2,
	},
	searchButtonInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },

	// Används när Liquid Glass inte finns (Android, iOS < 26).
	fallback: { backgroundColor: 'rgba(240, 240, 240, 0.95)' },
});