/**
 * login.tsx
 *
 * Inloggningsskärmen. Låter användaren logga in med Spotify.
 *
 * Vid start kontrolleras inloggningsläget (se lib/session.ts):
 *   - ready:         Supabase-session och Spotify-koppling finns.
 *   - needs_spotify: användaren är inloggad i appen men Spotify-kopplingen
 *                    saknas eller har återkallats. En ny inloggning krävs.
 *   - signed_out:    ingen session.
 *
 * Utfallen från signInWithSpotify:
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
import {
    getSessionStatus,
    refreshSessionStatus,
    SessionStatus,
} from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


// Förbestämda album som visas innan användaren loggat in
const albums = [
    require('../../assets/images/login/LOG.jpg'),
    require('../../assets/images/login/image 12.jpg'),
    require('../../assets/images/login/image 13.jpg'),
    require('../../assets/images/login/LOG.jpg'),
    require('../../assets/images/login/image 14.jpg'),
    require('../../assets/images/login/image 15.jpg'),
    require('../../assets/images/login/image 16.jpg'),
    
];

const ALBUM_SIZE = 134;
const ALBUM_GAP = 18;

export default function LoginScreen() {
    // Sant medan inloggningen pågår. Används för att visa en laddningsindikator
    // och förhindra att användaren startar flera inloggningar samtidigt.
    const [loading, setLoading] = useState(false);

    // Inloggningsläget. 'loading' gäller tills första kontrollen är klar.
    const [status, setStatus] = useState<SessionStatus | 'loading'>('loading');

    // Sant när Supabase har skickat ett bekräftelsemejl som användaren
    // måste klicka på innan inloggning är möjlig.
    const [needsVerification, setNeedsVerification] = useState(false);

    // för album animationen
    const translateX = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let mounted = true;

        getSessionStatus()
            .then((result) => {
                if (mounted) setStatus(result);
            })
            .catch(() => {
                // Går det inte att avgöra visas inloggningsknappen
                if (mounted) setStatus('signed_out');
            });

        // Bara utloggning bevakas här. SIGNED_IN ignoreras med flit: den
        // utlöses mitt i inloggningen, innan Spotify-nyckeln är sparad, och
        // då skulle skärmen felaktigt visa "Already logged in".
        // Anropa inga supabase-funktioner inuti den här callbacken.
        const { data } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') setStatus('signed_out');
        });

        return () => {
            mounted = false;
            data.subscription.unsubscribe();
        };
    }, []);

    // Startar album animationen 
    useEffect(() => {
        const oneSetWidth =
            albums.length * (ALBUM_SIZE + ALBUM_GAP);

        const animation = Animated.loop(
            Animated.timing(translateX, {
                toValue: -oneSetWidth,
                duration: 18000,
                useNativeDriver: true,
            })
        );

        animation.start();

        return () => animation.stop();
    }, [translateX]);

    /**
     * Startar inloggningen och agerar utifrån utfallet.
     */
    async function handleSignIn() {
        setLoading(true);
        try {
            const result = await signInWithSpotify();

            switch (result.status) {
                case 'signed_in':
                    // Meddelar rotens vakt att Spotify nu är kopplat. Utan det
                    // skulle vakten skicka tillbaka användaren hit.
                    await refreshSessionStatus();
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
            // User Management i Spotifys utvecklarpanel, eller att
            // Spotify-nyckeln inte kunde sparas.
            const message = error instanceof Error ? error.message : 'Okänt fel';
            Alert.alert('Inloggningen misslyckades', message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>

            {/* Rörliga album längst upp */}
            <View style={styles.albumWindow}>
                <Animated.View
                    style={[
                        styles.albumRow,
                        {
                            transform: [{ translateX }],
                        },
                    ]}
                >
                    {[...albums, ...albums].map((album, index) => (
                        <Image
                            key={index}
                            source={album}
                            style={styles.albumCover}
                        />
                    ))}
                </Animated.View>
            </View>


            {/* Titel och slogan */}
            <View style={styles.hero}>
                <View style={styles.logoRow}>
                    <Image
                        source={require('../../assets/images/login/LOGA.png')}
                        style={styles.logo}
                    />
                    <ThemedText style={styles.title}>
                        Daylist
                    </ThemedText>
                </View>

                <ThemedText style={styles.subtitle}>
                    Your daily track
                </ThemedText>

                <ThemedText style={styles.subtitle}>
                    For all your friends to hear
                </ThemedText>
            </View>


            {/* Informationsmeddelanden */}
            <View style={styles.messageArea}>

                {needsVerification && (
                    <ThemedText style={styles.info}>
                        Vi har skickat ett bekräftelsemejl till adressen som hör
                        till ditt Spotify-konto. Klicka på länken i mejlet och
                        logga sedan in igen.
                    </ThemedText>
                )}

                {status === 'needs_spotify' &&
                    !needsVerification && (
                        <ThemedText style={styles.info}>
                            Din Spotify-koppling har gått ut. Logga in med Spotify
                            igen för att fortsätta.
                        </ThemedText>
                    )}

            </View>


            {/* Login längst ned */}
            <View style={styles.bottomSection}>

                {status === 'loading' ? (
                    <ActivityIndicator />
                ) : (
                    <Pressable
                        style={({ pressed }) => [
                            styles.spotifyButton,
                            pressed && styles.buttonPressed,
                            loading && styles.buttonDisabled,
                        ]}
                        onPress={handleSignIn}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000000" />
                        ) : (
                            <>
                                <FontAwesome
                                    name="spotify"
                                    size={17}
                                    color="#000000"
                                />

                                <ThemedText style={styles.buttonText}>
                                    Login with Spotify
                                </ThemedText>
                            </>
                        )}
                    </Pressable>
                )}

                <Pressable>
                    <ThemedText style={styles.noSpotify}>
                        Don't have Spotify?
                    </ThemedText>
                </Pressable>

            </View>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },

    // ALBUM KARUSELL
    albumWindow: {
        height: 165,
        overflow: 'hidden',
        justifyContent: 'center',
    },

    albumRow: {
        flexDirection: 'row',
        gap: ALBUM_GAP,
        width: '200%',
    },

    albumCover: {
        width: ALBUM_SIZE,
        height: ALBUM_SIZE,
        resizeMode: 'cover',

        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowRadius: 5,
        shadowOffset: {
            width: 0,
            height: 3,
        },

        elevation: 3,
    },

    // TITLE / HERO
    hero: {
        marginTop: 44,
        paddingHorizontal: 20,
    },

    logo: {
        width: 130,
        height: 130,
        resizeMode: 'contain',
        marginRight: 10,
    },

    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        alignSelf: 'stretch',
    },

    title: {
        fontSize: 48,
        lineHeight: 53,
        fontWeight: '800',
        letterSpacing: -1.8,
        color: '#000000',
    },

    subtitle: {
        marginTop: 5,
        fontSize: 17,
        lineHeight: 22,
        color: '#A5A5A5',
        fontWeight: '400',
    },

    // INFO
    messageArea: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 30,
    },

    info: {
        fontSize: 13,
        lineHeight: 18,
        color: '#777777',
        textAlign: 'center',
    },

    // log in knapp
    bottomSection: {
        alignItems: 'center',
        paddingBottom: 52,
        paddingHorizontal: 24,
    },

    spotifyButton: {
        width: 220,
        height: 48,

        borderRadius: 999,

        backgroundColor: '#1ED760',

        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',

        gap: 7,
    },

    buttonText: {
        color: '#000000',
        fontSize: 15,
        fontWeight: '600',
    },

    buttonPressed: {
        opacity: 0.8,
    },

    buttonDisabled: {
        opacity: 0.55,
    },

    noSpotify: {
        marginTop: 14,

        fontSize: 11,
        color: '#999999',

        textDecorationLine: 'underline',
    },

});


