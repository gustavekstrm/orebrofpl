# Fantasy Premier League - Privat Liga

En modern, responsiv webbplats för en privat Fantasy Premier League-liga med svenskt innehåll och FPL-inspirerad design.

## 🚀 Funktioner

### ✅ Implementerade funktioner

- **Password Protection** - Enkel lösenordsskydd för webbplatsen
- **Responsive Design** - Fullt mobilanpassad med CSS Grid/Flexbox
- **Modern UI** - FPL-inspirerad design med mörkblå, lila och cyan toner
- **Svenskt innehåll** - All text på svenska för användarna

### 📋 Sektioner

1. **Startsida** - Välkomstmeddelande och anslutningsinstruktioner
2. **Tabeller** - Säsongstabell och senaste omgången med Chart.js-diagram
3. **Veckans höjdpunkter** - Redigerbara fält för "Raket", "Sopa" och "Sämsta Kapten"
4. **Profiler** - Spelarprofiler med bilder, poäng och favoritlag

### 🎨 Design

- Mörk tema med FPL-inspirerade färger
- Gradient bakgrunder och moderna kort
- Hover-effekter och animationer
- Clean typografi med Inter-font

## 🛠️ Installation

1. **Ladda ner filerna**

   ```bash
   git clone [repository-url]
   cd fpl-website
   ```

2. **Öppna i webbläsare**

   - Öppna `index.html` i din webbläsare
   - Eller starta en lokal server:

   ```bash
   python -m http.server 8000
   # eller
   npx serve .
   ```

3. **Logga in**
   - Standard lösenord: `fpl2024`
   - Ändra lösenordet i `script.js` rad 2

## ⚙️ Konfiguration

### Ändra lösenord

```javascript
// I script.js, rad 2
const CORRECT_PASSWORD = "ditt-nya-lösenord";
```

### Uppdatera ligadata

Redigera `leagueData`-objektet i `script.js`:

```javascript
let leagueData = {
  seasonTable: [
    { position: 1, name: "Ditt Namn", points: 2456, gameweek: 38 },
    // Lägg till fler spelare...
  ],
  // ... andra data
};
```

### FPL API Integration (framtida)

Webbplatsen har platshållare för FPL API-integration:

- Liga-kod: `46mnf2`
- API-endpoint: `https://fantasy.premierleague.com/api/leagues-classic/46mnf2/standings/`

## 📱 Responsive Design

Webbplatsen är fullt responsiv och fungerar på:

- **Desktop** - Full funktionalitet med alla sektioner
- **Tablet** - Anpassad layout för medelstora skärmar
- **Mobile** - Optimerad för små skärmar med touch-navigation

## 🎯 Användning

### För ligaadministratörer

1. **Uppdatera tabeller** - Redigera data i `script.js`
2. **Veckans höjdpunkter** - Använd formuläret på webbplatsen
3. **Lägg till profiler** - Använd "Lägg till ny profil"-formuläret

### För spelare

1. **Logga in** med lösenordet du fick
2. **Bläddra mellan sektioner** med navigationen
3. **Visa tabeller** och ranking över tid
4. **Kolla profiler** för alla deltagare

## 🔧 Teknisk information

### Filer

- `index.html` - Huvudstruktur och innehåll
- `styles.css` - Styling och responsiv design
- `script.js` - JavaScript-funktionalitet och datahantering

### Externa beroenden

- **Chart.js** - För ranking-diagram
- **Font Awesome** - Ikoner
- **Google Fonts (Inter)** - Typografi

### Lokal lagring

- Användar-inloggning sparas i `localStorage`
- Liga-data sparas i `localStorage` för persistent data

## 🎨 Anpassning

### Färger

Ändra CSS-variabler i `styles.css`:

```css
:root {
  --primary-blue: #1e3a8a;
  --secondary-blue: #3b82f6;
  --accent-purple: #8b5cf6;
  --accent-cyan: #06b6d4;
  /* ... fler färger */
}
```

### Innehåll

All text på svenska finns i `index.html`. Ändra:

- Välkomstmeddelanden
- Instruktioner
- Prispott-beskrivningar
- Formulärlabels

## 🚀 Framtida förbättringar

### Planerade funktioner

- [ ] **FPL API-integration** - Automatisk datahämtning
- [ ] **Live uppdateringar** - Real-time poänguppdateringar
- [ ] **Cup-tävling** - Separata cup-tabeller
- [ ] **Push-notifikationer** - Vecko-uppdateringar
- [ ] **Admin-panel** - Enklare datahantering

### Tekniska förbättringar

- [ ] **Backend-integration** - Server-side datahantering
- [ ] **Databas** - Persistent data storage
- [ ] **Autentisering** - Säker användarhantering
- [ ] **Caching** - Prestandaoptimering

## 📞 Support

För frågor eller support:

1. Kontrollera README först
2. Kontrollera browser-konsolen för fel
3. Kontakta utvecklaren

## 📄 Licens

Detta projekt är skapat för privat användning i Fantasy Premier League-ligan.

---

**Fantastisk säsong och lycka till i Fantasy Premier League!** ⚽🏆
