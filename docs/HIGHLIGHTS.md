# Veckans höjdpunkter (aggregates-only)

Det här är en minimal, säker implementation av "Veckans höjdpunkter" utan att störa tabellerna.

## Datakälla
- Bygger på de aggregat som redan tas fram för tabellerna (in-memory `window.__lastRows`).
- Inga nya API-anrop mot FPL. Ingen `picks`-hämtning i standardläget.
- Rank-delta beräknas lokalt utifrån totalpoäng före/efter senaste gameweek.

## Feature flags
- `src/config/features.js` exporterar `ENABLE_HIGHLIGHTS` (true som standard).
- Orchestratorn (`src/highlights/index.js`) kan även ta `context: { allowPicksInHighlights }` som parameter, men `picks` används inte i denna version.

## Aktivera rendering
Placera en mountpunkt i HTML nära GW-tabellen:

```html
<section id="weekly-highlights"></section>
```

Rendera (exempel):

```js
window.__renderHighlights__({
  gw: await getLatestGwOnce(),
  entryIds: window.ENTRY_IDS,
  mountSelector: '#weekly-highlights',
  context: { allowPicksInHighlights: false }
});
```

## Tester
Kör endast logiktester för highlights:

```bash
npm run test:hl
```

## Graceful degradation
- Misslyckas hämtning/beräkning eller saknas data, visas en dämpad banner: "Kunde inte hämta veckans höjdpunkter just nu." och tabeller påverkas inte.
- Saknas data per fack renderas en inaktiverad kortkomponent med texten "Data saknas denna vecka".
