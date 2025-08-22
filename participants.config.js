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
window.__BUILD_TAG__ = 'v1.0';

console.log('[participants.config] Loaded', window.ENTRY_IDS.length, 'entry IDs');
console.log('[participants.config] League code:', window.LEAGUE_CODE);
