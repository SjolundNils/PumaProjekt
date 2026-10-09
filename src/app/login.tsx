/**
 * login.tsx
 *
 * Inloggningsskärmen. Låter användaren logga in med Spotify och hanterar
 * de tre möjliga utfallen från signInWithSpotify:
 *   - signed_in:    användaren skickas vidare in i appen.
 *   - verify_email: ett meddelande visas om att e-postadressen måste
 *                   bekräftas innan inloggning är möjlig.
 *   - cancelled:    ingenting händer, användaren kan försöka igen.
 *
 * Utseendet är medvetet enkelt. Det ersätts av hi-fi-designen när
 * inloggningsflödet är verifierat.
 */
import { ThemedText } from '@/components/themed-text';
import { signInWithSpotify } from '@/lib/auth';
import { saveSpotifyTestToken } from '@/lib/spotifyTestToken';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

export default function LoginScreen() {
    // Sant medan inloggningen pågår. Används för att visa en laddningsindikator
    // och förhindra att användaren startar flera inloggningar samtidigt.
    const [loading, setLoading] = useState(false);

    // Sant när Supabase har skickat ett bekräftelsemejl som användaren
    // måste klicka på innan inloggning är möjlig.
    const [needsVerification, setNeedsVerification] = useState(false);

    /**
     * Startar inloggningen och agerar utifrån utfallet.
     */
    async function handleSignIn() {
        setLoading(true);
        try {
            const result = await signInWithSpotify();

            switch (result.status) {
                case 'signed_in':
                    // TEST: sparar Spotify-nyckeln för söktestet. Tas bort senare.
                    if (result.providerToken) {
                        await saveSpotifyTestToken(result.providerToken);
                    }
                    router.replace('/');
                    break;
                case 'verify_email':
                    setNeedsVerification(true);
                    break;
                case 'cancelled':
                    // Användaren stängde fönstret. Ingen åtgärd behövs.
                    break;
            }
        } catch (error) {
            // Oväntade fel, till exempel att kontot inte finns under
            // User Management i Spotifys utvecklarpanel.
            const message = error instanceof Error ? error.message : 'Okänt fel';
            Alert.alert('Inloggningen misslyckades', message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <ThemedText style={styles.title}>Daylist</ThemedText>
            <ThemedText style={styles.subtitle}>your daily track</ThemedText>
            <ThemedText style={styles.subtitle}>for all your friends to hear</ThemedText>

            {needsVerification && (
                <ThemedText style={styles.info}>
                    Vi har skickat ett bekräftelsemejl till adressen som hör till ditt
                    Spotify-konto. Klicka på länken i mejlet och logga sedan in igen.
                </ThemedText>
            )}

            <Pressable
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator />
                ) : (
                    <ThemedText style={styles.buttonText}>Logga in med Spotify</ThemedText>
                )}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
    title: {
        alignSelf: 'stretch',
        paddingHorizontal: 16,
        fontSize: 48,
        lineHeight: 56,
        fontWeight: '700',
    },
    subtitle: {
        alignSelf: 'stretch',
        paddingHorizontal: 16,
        fontSize: 24,
        lineHeight: 32,
        textAlign: 'left',
    },
    info: { textAlign: 'center', fontSize: 15, lineHeight: 21 },
    button: { backgroundColor: '#1DB954', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, minWidth: 220, alignItems: 'center' },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { fontSize: 16, fontWeight: '600' },
});