// participants.config.js
// Centralized configuration for Örebro FPL participants
// Extracted from participantsData array in script.js

window.LEAGUE_CODE = window.LEAGUE_CODE || "46mnf2";

// All 51 FPL IDs from the participantsData array
window.ENTRY_IDS = [
    1490173, // Melvin Yuksel
    1450793, // Jakob Gårlin
    133147,  // Joel A-Segerlind
    8759848, // Viggo Svedin
    2703061, // Julius Höglund
    2269283, // Erik Rotsenius
    5527279, // William Kuyumcu
    4096096, // Axel Ekström
    348966,  // Gustav Ekström
    2884065, // David Jansson
    412417,  // Alex Pettersson
    5990179, // Sigge Carlsson
    4382408, // Johan Pauly
    3666480, // Filip Nieminen
    78175,   // Edvin Möller
    1537567, // Johan Ivarsson
    6316536, // Jacob Åhlander
    1884529, // Victor Celik
    4413902, // Felix Möller
    4971106, // Markus Rosdahl
    5735314, // Tobias Pettersson
    908791,  // Robin Damström
    547800,  // David Alfredsson
    4294348, // Karl Weckström
    8456844, // Oliver S
    3017284, // Nisse Karlsson
    6176435, // Enis Krivdic
    35100,   // Sebbe Sundkvist
    1435536, // Leo Vasikisson
    6069375, // Gustaf Jorman Bergholm
    542217,  // Alex Bowern
    2563309, // David Ivarsson
    8779490, // Elton Vallberg
    141529,  // Noah Freij
    5378419, // WIlgot Rydborg
    1146757, // Edvin Mårtensson
    990189,  // Hugo Sundquist
    2009407, // Kevin Schultze
    2162629, // Adrian Torabi
    1289520, // Elias Sundh
    5746665, // Dimitris Bakalokos
    7634954, // Hugo Nilsson
    6001484, // Emil Vide
    1084577, // Max Rotschild Lundin
    190340,  // Melker Johansson
    1989237, // macsnizz Victor
    9180666, // Teodor Tjernberg
    759543,  // Simon Edberger Persson
    3030499, // Juan Pedersson
    3652477, // Wilmer Bremvik
    9340368  // Malte L
];

// Build tag for verification
window.__BUILD_TAG__ = 'v2.0';

// Manual ID→name mapping extracted from participantsData array
window.PARTICIPANT_OVERRIDES = {
  1490173: { displayName: "Melvin Yuksel", teamName: "Sunderland" },
  1450793: { displayName: "Jakob Gårlin", teamName: "Liverpool" },
  133147:  { displayName: "Joel A-Segerlind", teamName: "Arsenal" },
  8759848: { displayName: "Viggo Svedin", teamName: "Chelsea" },
  2703061: { displayName: "Julius Höglund", teamName: "Manchester City" },
  2269283: { displayName: "Erik Rotsenius", teamName: "Tottenham" },
  5527279: { displayName: "William Kuyumcu", teamName: "Newcastle" },
  4096096: { displayName: "Axel Ekström", teamName: "Aston Villa" },
  348966:  { displayName: "Gustav Ekström", teamName: "Arsenal" },
  2884065: { displayName: "David Jansson", teamName: "Ipswich" },
  412417:  { displayName: "Alex Pettersson", teamName: "Tottenham" },
  5990179: { displayName: "Sigge Carlsson", teamName: "West Ham" },
  4382408: { displayName: "Johan Pauly", teamName: "Crystal Palace" },
  3666480: { displayName: "Filip Nieminen", teamName: "" },
  78175:   { displayName: "Edvin Möller", teamName: "" },
  1537567: { displayName: "Johan Ivarsson", teamName: "" },
  6316536: { displayName: "Jacob Åhlander", teamName: "" },
  1884529: { displayName: "Victor Celik", teamName: "" },
  4413902: { displayName: "Felix Möller", teamName: "" },
  4971106: { displayName: "Markus Rosdahl", teamName: "" },
  5735314: { displayName: "Tobias Pettersson", teamName: "" },
  908791:  { displayName: "Robin Damström", teamName: "" },
  547800:  { displayName: "David Alfredsson", teamName: "" },
  4294348: { displayName: "Karl Weckström", teamName: "" },
  8456844: { displayName: "Oliver S", teamName: "" },
  3017284: { displayName: "Nisse Karlsson", teamName: "" },
  6176435: { displayName: "Enis Krivdic", teamName: "" },
  35100:   { displayName: "Sebbe Sundkvist", teamName: "" },
  1435536: { displayName: "Leo Vasikisson", teamName: "" },
  6069375: { displayName: "Gustaf Jorman Bergholm", teamName: "" },
  542217:  { displayName: "Alex Bowern", teamName: "" },
  2563309: { displayName: "David Ivarsson", teamName: "" },
  8779490: { displayName: "Elton Vallberg", teamName: "" },
  141529:  { displayName: "Noah Freij", teamName: "" },
  5378419: { displayName: "WIlgot Rydborg", teamName: "" },
  1146757: { displayName: "Edvin Mårtensson", teamName: "" },
  990189:  { displayName: "Hugo Sundquist", teamName: "" },
  2009407: { displayName: "Kevin Schultze", teamName: "" },
  2162629: { displayName: "Adrian Torabi", teamName: "" },
  1289520: { displayName: "Elias Sundh", teamName: "" },
  5746665: { displayName: "Dimitris Bakalokos", teamName: "" },
  7634954: { displayName: "Hugo Nilsson", teamName: "" },
  6001484: { displayName: "Emil Vide", teamName: "" },
  1084577: { displayName: "Max Rotschild Lundin", teamName: "" },
  190340:  { displayName: "Melker Johansson", teamName: "" },
  1989237: { displayName: "macsnizz Victor", teamName: "" },
  9180666: { displayName: "Teodor Tjernberg", teamName: "" },
  759543:  { displayName: "Simon Edberger Persson", teamName: "" },
  3030499: { displayName: "Juan Pedersson", teamName: "" },
  3652477: { displayName: "Wilmer Bremvik", teamName: "" },
  9340368: { displayName: "Malte L", teamName: "" }
};

console.log('[participants.config] Loaded', window.ENTRY_IDS.length, 'entry IDs');
console.log('[participants.config] League code:', window.LEAGUE_CODE);
console.log('[participants.config] Participant overrides:', Object.keys(window.PARTICIPANT_OVERRIDES).length, 'entries');
