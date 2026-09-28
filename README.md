# Kom igång med PumaProjekt

Den här guiden beskriver hur du sätter upp projektet på din egen dator så att du kan köra appen, logga in med Spotify och arbeta mot vår gemensamma Supabase-databas.

Räkna med 20–30 minuter första gången.

---

## Översikt

Projektet består av tre delar som hänger ihop:

| Del | Vad det är | Var det finns |
|---|---|---|
| **Appen** | React Native med Expo och Expo Router | Det här repot |
| **Backend** | Supabase: databas, inloggning och serverfunktioner | Supabase-projektet `cyhodcqfoxrulsmsoqeu` |
| **Spotify** | Inloggning och musikdata via Spotify Web API | Spotify-appen i Spotifys utvecklarpanel |

Du behöver åtkomst till alla tre. Delar av åtkomsten måste Nils (projektägaren) ge dig, se steg 2.

---

## 1. Förutsättningar

Installera följande om du inte redan har det:

- **Node.js** (LTS-versionen) – https://nodejs.org
- **Git**
- **VS Code** (rekommenderas)
- **Expo Go** på din iPhone, från App Store
- Ett **Spotify-konto** (gratiskonto räcker)

---

## 2. Be om åtkomst

Skicka följande till Nils:

1. **Den e-postadress som hör till ditt Spotify-konto** och ditt namn.
   Nils lägger till dig under *User Management* i Spotifys utvecklarpanel. Utan det kan du inte logga in i appen.
   Observera att Spotify begränsar appen till **max fem användare**, inklusive Nils.
2. **Den e-postadress du vill använda för Supabase.**
   Nils bjuder in dig till Supabase-organisationen så att du kan se databasen i dashboarden.

Du behöver också få följande från Nils, **i ett privat meddelande**:

- Supabase-projektets **URL**
- Supabase-projektets **publishable key**
- Supabase-projektets **databaslösenord** (behövs bara för Supabase CLI, se steg 5)

---

## 3. Hämta koden

Om du inte har repot sedan tidigare:

```bash
git clone https://github.com/SjolundNils/PumaProjekt.git
cd PumaProjekt
```

Om du redan har det:

```bash
git pull
```

Installera sedan alla paket:

```bash
npm install
```

---

## 4. Skapa din `.env`-fil

Appen läser Supabase-adressen och nyckeln från en fil som heter `.env`. Filen finns inte i repot, eftersom den inte ska ligga på GitHub. Du måste skapa din egen.

1. Kopiera `.env.example` i roten av projektet och döp kopian till `.env`.
2. Fyll i värdena du fick av Nils:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://cyhodcqfoxrulsmsoqeu.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_...
```

**Regler för `.env`:**

- Inga mellanslag runt `=` och inga citattecken.
- `EXPO_PUBLIC_SUPABASE_KEY` ska vara nyckeln som börjar med `sb_publishable_`. Använd **aldrig** den hemliga nyckeln (`sb_secret_...`). Den går förbi all säkerhet i databasen och får aldrig ligga i appen.
- `.env` får **aldrig** committas. Den står i `.gitignore`, så git ignorerar den automatiskt. Kontrollera med `git status` innan du committar att den inte är med.

---

## 5. Koppla Supabase CLI (valfritt men rekommenderat)

Supabase CLI används för att generera TypeScript-typer från databasen och, framöver, för migrationer. Du behöver inte det för att köra appen, men väl för att uppdatera typerna när databasen ändras.

```bash
npx supabase login
npx supabase link --project-ref cyhodcqfoxrulsmsoqeu
```

- `login` öppnar webbläsaren där du loggar in med ditt Supabase-konto.
- `link` frågar efter databaslösenordet. Använd det du fick av Nils.

Kopplingen sparas bara på din dator (i `supabase/.temp`, som är ignorerad av git). Därför måste varje person göra detta själv.

---

## 6. Starta appen

**Starta alltid med tunnel:**

```bash
npx expo start --tunnel
```

Varför tunnel? Utan den innehåller appens inloggningsadress datorns IP-adress, och Supabase blockerar sådana adresser. Inloggningen skickar dig då till en trasig `localhost`-sida istället för tillbaka till appen. Med tunnel får adressen ett domännamn, och då fungerar det.

Om du får felet `failed to start tunnel`, kör kommandot igen. Det fungerar oftast på andra eller tredje försöket.

När Expo har startat:

1. Öppna **Kameran** på din iPhone och skanna QR-koden i terminalen.
2. Appen öppnas i **Expo Go**.

---

## 7. Logga in första gången

1. Tryck på **Till inloggning** på startskärmen.
2. Tryck **Logga in med Spotify** och logga in med ditt Spotify-konto.
3. **Första gången** visas ett meddelande om att du måste bekräfta din e-post. Supabase har skickat ett mejl till adressen som hör till ditt Spotify-konto.
   Klicka på länken i mejlet. Du hamnar på en sida som inte laddar (`localhost`). **Det är väntat.** Det viktiga är att e-posten har bekräftats.
4. Gå tillbaka till appen och tryck **Logga in med Spotify** igen. Nu ska du komma in.

**Kontrollera att det fungerade:** i Supabase-dashboarden, under **Table Editor → profiles**, ska det nu finnas en rad med ditt Spotify-namn. Den skapas automatiskt vid första inloggningen.

---

## 8. Arbeta i projektet

### Projektstruktur

```
PumaProjekt/
├── src/
│   ├── app/                  ← Skärmar (Expo Router, filnamn = adress)
│   │   ├── _layout.tsx       ← Yttersta layouten (Stack)
│   │   ├── login.tsx         ← Inloggningsskärmen
│   │   └── (tabs)/           ← Appens huvuddel med flikar
│   ├── lib/
│   │   ├── supabase.ts       ← Supabase-klienten
│   │   ├── auth.ts           ← Inloggning och utloggning
│   │   ├── errors.ts         ← Hjälpfunktion för felmeddelanden
│   │   └── database.types.ts ← Genererade typer, ändra aldrig för hand
│   └── components/
├── supabase/                 ← Inställningar för Supabase CLI
├── .env                      ← Dina nycklar, inte i git
└── .env.example              ← Mall för .env
```

### Importer

Använd aliaset `@/`, som pekar på `src/`:

```ts
import { supabase } from '@/lib/supabase';
```

### När databasen har ändrats

Om någon har ändrat tabeller eller kolumner i Supabase måste TypeScript-typerna genereras om:

**Git Bash eller Kommandotolken:**
```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

**PowerShell:**
```powershell
npx supabase gen types typescript --linked | Out-File -Encoding utf8 src/lib/database.types.ts
```

Använd inte `>` i PowerShell. Det sparar filen i en kodning som TypeScript inte kan läsa.

Committa den uppdaterade typfilen så att alla har samma typer.

### Regler för databasen

- **Säg till i gruppen innan du ändrar i databasen.** Vi delar samma databas, så en ändring slår igenom för alla direkt.
- **Ändra aldrig något i schemat `auth`.** Supabase sköter det själv.
- **Alla tabeller har RLS (Row Level Security) påslaget.** En tabell utan policyer är helt låst för appen. Får du tomma svar eller fel om *row-level security* saknas troligen en policy.

---

## Testskärmar

Följande filer är tillfälliga och ska tas bort eller ersättas innan appen är klar:

| Fil | Syfte |
|---|---|
| `src/app/search-test.tsx` | Testar sökning i Spotify Web API |
| `src/app/profile-test.tsx` | Testar att läsa och ändra profilen |
| `src/lib/spotifyTestToken.ts` | Sparar Spotify-nyckeln lokalt för testerna |
| Länkarna i `src/app/(tabs)/index.tsx` | Snabbåtkomst till testskärmarna |

Spotify-nyckeln som testskärmarna använder slutar fungera efter cirka en timme. Får du felet att nyckeln har gått ut, logga in igen.

---

## Felsökning

| Problem | Trolig orsak | Lösning |
|---|---|---|
| Efter inloggning hamnar du på en `localhost`-sida | Expo startades utan tunnel | Starta med `npx expo start --tunnel` |
| Inloggningen misslyckas med 403 eller att kontot inte är godkänt | Du står inte under *User Management* i Spotify | Be Nils lägga till dig |
| `Invalid supabaseUrl` | `.env` saknas, ligger på fel ställe eller har fel värden | Kontrollera steg 4 och starta om med `npx expo start --tunnel -c` |
| `supabaseKey is required` | Variabelnamnet i `.env` stämmer inte med koden | Namnet ska vara exakt `EXPO_PUBLIC_SUPABASE_KEY` |
| Rödmarkerad adress vid `<Link href="...">` | Expo har inte registrerat en ny skärm än | Starta om Expo |
| Tomma svar från databasen | RLS-policy saknas för tabellen | Säg till i gruppen |
| `Database error saving new user` vid inloggning | Fel i triggern som skapar profiler | Kolla **Logs → Postgres** i Supabase |
| GitHub stoppar pushen med *Push cannot contain secrets* | `.env` har råkat committas | Klicka **inte** på länken som tillåter hemligheten. Säg till i gruppen |
| `failed to start tunnel` | Tillfälligt fel hos tunneltjänsten | Kör kommandot igen |
| Konstiga fel efter ändringar | Gammal cache | Starta om med `npx expo start --tunnel -c` |
