// Configuration
console.log('=== SCRIPT.JS LOADING ===');
const CORRECT_PASSWORD = 'fantasyorebro';
const ADMIN_PASSWORD = 'Pepsie10';
const FPL_API_BASE = 'https://fantasy.premierleague.com/api';
const LEAGUE_CODE = '46mnf2';

// Global flag to disable API calls for local development
const DISABLE_API_CALLS = false; // API enabled for deployment // Set to true for local development due to CORS, false when deployed

// Global data storage
let isLoggedIn = false;
let isAdminAuthenticated = false;
let currentGameweek = 1; // Start with GW1 for new season
let leagueData = {
    seasonTable: [],
    gameweekTable: [],
    highlights: {
        rocket: '',
        flop: '',
        captain: '',
        bench: ''
    },
    players: []
};
let bootstrapData = {};

// Prize Chart Variables
let prizeChart = null;
let prizeTotal = 4200; // Default prize total
let roastsExpanded = false; // Global state for roast expansion toggle

// Modular participant data - easy to edit manually
// TODO: After Gameweek 1, replace with FPL API integration using fplId
// 
// FPL API Integration Plan:
// 1. When fplId is set for a participant, fetch real data from:
//    - /entry/{fplId}/ (current season stats)
//    - /entry/{fplId}/history/ (historical data, best GW, last season rank)
// 2. Replace mock values with live data:
//    - totalPoäng: from current season total
//    - lastSeasonRank: from history data
//    - bestGameweek: calculated from historical gameweek points
// 3. Dynamic binding: when new players join and get linked to FPL ID,
//    their profile auto-updates with real stats
// Helper function to generate data URL for participant avatars
function generateAvatarDataURL(initial) {
    const svg = `<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="60" height="60" fill="#1e293b"/>
        <text x="30" y="35" font-family="Arial, sans-serif" font-size="24" fill="#06b6d4" text-anchor="middle" dy=".3em">${initial}</text>
    </svg>`;
    try {
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    } catch (error) {
        console.error('Error generating avatar URL:', error);
        // Fallback to a simple colored div
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMWUyOTNiIi8+Cjx0ZXh0IHg9IjMwIiB5PSIzNSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjMDZiNmQ0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+WDwvdGV4dD4KPC9zdmc+';
    }
}

// 4. Fallback: if fplId is null, continue using mock/manual values
const participantsData = [
    {
        namn: 'Melvin Yuksel',
        totalPoäng: 2456,
        favoritlag: 'Sunderland',
        fplId: 1490173, // Real FPL ID
        profilRoast: 'Har haft fler minuspoäng än rena lakan den här säsongen.',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 12,
        bestGameweek: 98
    },
    {
        namn: 'Jakob Gårlin',
        totalPoäng: 2412,
        favoritlag: 'Liverpool',
        fplId: 1450793, // Real FPL ID
        profilRoast: 'Enda som är sämre än din kaptensval är din senaste bortamatch.',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 8,
        bestGameweek: 87
    },
    {
        namn: 'Joel A-Segerlind',
        totalPoäng: 2389,
        favoritlag: 'Arsenal',
        fplId: 133147, // Real FPL ID
        profilRoast: 'Din transferstrategi liknar en blindfolded dart game.',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 15,
        bestGameweek: 92
    },
    {
        namn: 'Viggo Svedin',
        totalPoäng: 2356,
        favoritlag: 'Chelsea',
        fplId: 8759848, // Real FPL ID
        profilRoast: 'Bench boost på GW1? Bara du som kan komma på det.',
        image: generateAvatarDataURL('V'),
        lastSeasonRank: 22,
        bestGameweek: 85
    },
    {
        namn: 'Julius Höglund',
        totalPoäng: 2321,
        favoritlag: 'Manchester City',
        fplId: 2703061, // Real FPL ID
        profilRoast: 'Flest flaskor bubbel - förutom när det gäller kaptensval.',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 5,
        bestGameweek: 89
    },
    {
        namn: 'Erik Rotsenius',
        totalPoäng: 2289,
        favoritlag: 'Tottenham',
        fplId: 2269283, // Real FPL ID
        profilRoast: 'Kaptenkaos är ditt mellannamn.',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 18,
        bestGameweek: 76
    },
    {
        namn: 'William Kuyumcu',
        totalPoäng: 2256,
        favoritlag: 'Newcastle',
        fplId: 5527279, // Real FPL ID
        profilRoast: 'Bench Boost Fuskare deluxe edition.',
        image: generateAvatarDataURL('W'),
        lastSeasonRank: 25,
        bestGameweek: 82
    },
    {
        namn: 'Axel Ekström',
        totalPoäng: 2223,
        favoritlag: 'Aston Villa',
        fplId: 4096096, // Real FPL ID
        profilRoast: 'Trigger Happy - mer transfers än poäng.',
        image: generateAvatarDataURL('A'),
        lastSeasonRank: 30,
        bestGameweek: 79
    },
    {
        namn: 'Gustav Ekström',
        totalPoäng: 2189,
        favoritlag: 'Arsenal',
        fplId: 348966, // Real FPL ID
        profilRoast: 'Bench God - men bara när du inte använder Bench Boost.',
        image: generateAvatarDataURL('G'),
        lastSeasonRank: 28,
        bestGameweek: 75
    },
    {
        namn: 'David Jansson',
        totalPoäng: 2100,
        favoritlag: 'Ipswich',
        fplId: 2884065, // Real FPL ID
        profilRoast: 'Nykomling i ligan - hoppas du klarar dig!',
        image: generateAvatarDataURL('D'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Alex Pettersson',
        totalPoäng: 2050,
        favoritlag: 'Tottenham',
        fplId: 412417, // Real FPL ID
        profilRoast: 'Spurs supporter - förklarar allt!',
        image: generateAvatarDataURL('A'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Sigge Carlsson',
        totalPoäng: 2156,
        favoritlag: 'West Ham',
        fplId: 5990179, // Real FPL ID
        profilRoast: 'Mest minuspoäng i ligan - grattis!',
        image: generateAvatarDataURL('S'),
        lastSeasonRank: 32,
        bestGameweek: 71
    },
    {
        namn: 'Johan Pauly',
        totalPoäng: 2123,
        favoritlag: 'Crystal Palace',
        fplId: 4382408, // Real FPL ID
        profilRoast: 'Veckans Sopa - en titel du verkligen förtjänar.',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 35,
        bestGameweek: 68
    },
    {
        namn: 'Filip Nieminen',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 3666480, // Real FPL ID
        profilRoast: 'Ny deltagare - välkommen till kaoset!',
        image: generateAvatarDataURL('F'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Edvin Möller',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 78175, // Real FPL ID
        profilRoast: 'Ny deltagare - hoppas du överlever!',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Johan Ivarsson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1537567, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Jacob Åhlander',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 6316536, // Real FPL ID
        profilRoast: 'Ny deltagare - välkommen!',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Victor Celik',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1884529, // Real FPL ID
        profilRoast: 'Ny deltagare - kör hårt!',
        image: generateAvatarDataURL('V'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Felix Möller',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 4413902, // Real FPL ID
        profilRoast: 'Ny deltagare - spela smart!',
        image: generateAvatarDataURL('F'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Markus Rosdahl',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 4971106, // Real FPL ID
        profilRoast: 'Ny deltagare - gör ditt bästa!',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Tobias Pettersson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 5735314, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('T'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Robin Damström',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 908791, // Real FPL ID
        profilRoast: 'Ny deltagare - kör på!',
        image: generateAvatarDataURL('R'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'David Alfredsson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 547800, // Real FPL ID
        profilRoast: 'Ny deltagare - spela klokt!',
        image: generateAvatarDataURL('D'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Karl Weckström',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 4294348, // Real FPL ID
        profilRoast: 'Ny deltagare - gör det bra!',
        image: generateAvatarDataURL('K'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Oliver S',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 8456844, // Real FPL ID
        profilRoast: 'Ny deltagare - välkommen!',
        image: generateAvatarDataURL('O'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Nisse Karlsson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 3017284, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('N'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Enis Krivdic',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 6176435, // Real FPL ID
        profilRoast: 'Ny deltagare - kör hårt!',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Sebbe Sundkvist',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 35100, // Real FPL ID
        profilRoast: 'Ny deltagare - spela smart!',
        image: generateAvatarDataURL('S'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Leo Vasikisson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1435536, // Real FPL ID
        profilRoast: 'Ny deltagare - gör ditt bästa!',
        image: generateAvatarDataURL('L'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Gustaf Jorman Bergholm',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 6069375, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('G'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Alex Bowern',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 542217, // Real FPL ID
        profilRoast: 'Ny deltagare - välkommen!',
        image: generateAvatarDataURL('A'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'David Ivarsson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 2563309, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('D'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Elton Vallberg',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 8779490, // Real FPL ID
        profilRoast: 'Ny deltagare - kör hårt!',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Noah Freij',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 141529, // Real FPL ID
        profilRoast: 'Ny deltagare - spela smart!',
        image: generateAvatarDataURL('N'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'WIlgot Rydborg',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 5378419, // Real FPL ID
        profilRoast: 'Ny deltagare - gör ditt bästa!',
        image: generateAvatarDataURL('W'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Edvin Mårtensson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1146757, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Hugo Sundquist',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 990189, // Real FPL ID
        profilRoast: 'Ny deltagare - kör på!',
        image: generateAvatarDataURL('H'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Kevin Schultze',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 2009407, // Real FPL ID
        profilRoast: 'Ny deltagare - spela klokt!',
        image: generateAvatarDataURL('K'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Adrian Torabi',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 2162629, // Real FPL ID
        profilRoast: 'Ny deltagare - gör det bra!',
        image: generateAvatarDataURL('A'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Elias Sundh',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1289520, // Real FPL ID
        profilRoast: 'Ny deltagare - välkommen!',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Dimitris Bakalokos',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 5746665, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('D'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Hugo Nilsson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 7634954, // Real FPL ID
        profilRoast: 'Ny deltagare - kör hårt!',
        image: generateAvatarDataURL('H'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Emil Vide',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 6001484, // Real FPL ID
        profilRoast: 'Ny deltagare - spela smart!',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Max Rotschild Lundin',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1084577, // Real FPL ID
        profilRoast: 'Ny deltagare - gör ditt bästa!',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Melker Johansson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 190340, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'macsnizz Victor',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1989237, // Real FPL ID
        profilRoast: 'Ny deltagare - kör på!',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Teodor Tjernberg',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 9180666, // Real FPL ID
        profilRoast: 'Ny deltagare - spela klokt!',
        image: generateAvatarDataURL('T'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Simon Edberger Persson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 759543, // Real FPL ID
        profilRoast: 'Ny deltagare - gör det bra!',
        image: generateAvatarDataURL('S'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Juan Pedersson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 3030499, // Real FPL ID
        profilRoast: 'Ny deltagare - välkommen!',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Wilmer Bremvik',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 3652477, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('W'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Malte L',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 9340368, // Real FPL ID
        profilRoast: 'Ny deltagare - kör hårt!',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    }
];

// Bootstrap data cache

// FPL API Integration for individual participants
async function fetchParticipantFPLData(participant) {
    // Disabled for local development to avoid CORS issues
    console.log(`API calls disabled for local development. Using mock data for ${participant.namn}`);
    return participant;
    
    /* 
    // API calls disabled for local development due to CORS restrictions
    // Uncomment when deployed to a proper server
    if (!participant.fplId) {
        console.log(`No FPL ID for ${participant.namn}, using mock data`);
        return participant;
    }
    
    try {
        // Fetch current season data
        const currentResponse = await fetch(`${FPL_API_BASE}/entry/${participant.fplId}/`);
        const currentData = await currentResponse.json();
        
        // Fetch historical data
        const historyResponse = await fetch(`${FPL_API_BASE}/entry/${participant.fplId}/history/`);
        const historyData = await historyResponse.json();
        
        // Update participant with real data
        const updatedParticipant = {
            ...participant,
            totalPoäng: currentData.summary_overall_points || participant.totalPoäng,
            lastSeasonRank: historyData.past?.find(p => p.season_name === '2023/24')?.rank || participant.lastSeasonRank,
            bestGameweek: Math.max(...historyData.current?.map(gw => gw.points) || [participant.bestGameweek])
        };
        
        console.log(`Updated ${participant.namn} with real FPL data`);
        return updatedParticipant;
        
    } catch (error) {
        console.error(`Error fetching FPL data for ${participant.namn}:`, error);
        return participant; // Return original data on error
    }
    */
}

// Function to update all participants with FPL data
async function updateParticipantsWithFPLData() {
    console.log('Updating participants with FPL data...');
    
    const updatedParticipants = [];
    for (const participant of participantsData) {
        const updated = await fetchParticipantFPLData(participant);
        updatedParticipants.push(updated);
    }
    
    // Update the global participantsData array
    participantsData.length = 0;
    participantsData.push(...updatedParticipants);
    
    // Regenerate league data
    useFallbackData();
    
    // Update UI
    populateProfiles();
    populateTables();
    updateHighlightsFromData();
}

// Admin Panel Functions
function showAdminPasswordPrompt() {
    console.log('showAdminPasswordPrompt called');
    console.log('ADMIN_PASSWORD:', ADMIN_PASSWORD);
    
    try {
        const password = prompt('Ange adminlösenord:');
        console.log('Password entered:', password ? '***' : 'null');
        
        if (password === ADMIN_PASSWORD) {
            isAdminAuthenticated = true;
            console.log('Admin authentication successful');
            showAdminPanel();
        } else if (password !== null) {
            console.log('Admin authentication failed - wrong password');
            alert('Felaktigt lösenord!');
        } else {
            console.log('Admin authentication cancelled');
        }
    } catch (error) {
        console.error('Error in showAdminPasswordPrompt:', error);
        alert('Fel vid admin-inloggning: ' + error.message);
    }
}

function showAdminPanel() {
    if (!isAdminAuthenticated) {
        console.log('Admin panel requested but not authenticated');
        showAdminPasswordPrompt();
        return;
    }
    
    console.log('Showing admin panel');
    const adminModal = document.getElementById('adminModal');
    adminModal.classList.add('show');
    populateAdminParticipantsList();
    
    // Show prize total input for admin
    showPrizeTotalInput();
}

function hideAdminPanel() {
    const adminModal = document.getElementById('adminModal');
    adminModal.classList.remove('show');
    hideAddParticipantForm();
    
    // Hide prize total input when admin panel is closed
    hidePrizeTotalInput();
}

function populateAdminParticipantsList() {
    const adminList = document.getElementById('adminParticipantsList');
    if (!adminList) return;
    
    adminList.innerHTML = '';
    
    // Update current prize total display
    const currentPrizeTotal = document.getElementById('currentPrizeTotal');
    if (currentPrizeTotal) {
        currentPrizeTotal.textContent = prizeTotal;
    }
    
    participantsData.forEach((participant, index) => {
        const card = document.createElement('div');
        card.className = 'admin-participant-card';
        
        // Add warning classes for missing data
        if (!participant.fplId) {
            card.classList.add('warning');
        }
        if (!participant.profilRoast || participant.profilRoast.trim() === '') {
            card.classList.add('error');
        }
        
        card.innerHTML = `
            <div class="admin-participant-header">
                <h3 class="admin-participant-name">${participant.namn}</h3>
                <div class="admin-participant-actions">
                    <button class="admin-btn primary" onclick="saveParticipantChanges(${index})">
                        <i class="fas fa-save"></i> Spara
                    </button>
                    <button class="admin-btn secondary" onclick="deleteParticipant(${index})">
                        <i class="fas fa-trash"></i> Ta bort
                    </button>
                </div>
            </div>
            <div class="admin-participant-fields">
                <div class="admin-field">
                    <label>Namn:</label>
                    <input type="text" value="${participant.namn}" onchange="updateParticipantField(${index}, 'namn', this.value)">
                </div>
                <div class="admin-field">
                    <label>Favoritlag:</label>
                    <input type="text" value="${participant.favoritlag}" onchange="updateParticipantField(${index}, 'favoritlag', this.value)">
                </div>
                <div class="admin-field">
                    <label>FPL ID:</label>
                    <input type="number" value="${participant.fplId || ''}" placeholder="Lämna tomt om okänt" onchange="updateParticipantField(${index}, 'fplId', this.value ? parseInt(this.value) : null)">
                </div>
                <div class="admin-field">
                    <label>Profilroast:</label>
                    <textarea onchange="updateParticipantField(${index}, 'profilRoast', this.value)" placeholder="En rolig kommentar om deltagaren...">${participant.profilRoast || ''}</textarea>
                </div>
                <div class="admin-field">
                    <label>Profilbild URL:</label>
                    <input type="url" value="${participant.image || ''}" placeholder="https://..." onchange="updateParticipantField(${index}, 'image', this.value)">
                </div>
                <div class="admin-field">
                    <label>Totala poäng:</label>
                    <input type="number" value="${participant.totalPoäng}" onchange="updateParticipantField(${index}, 'totalPoäng', parseInt(this.value))">
                </div>
                <div class="admin-field">
                    <label>Förra årets placering:</label>
                    <input type="number" value="${participant.lastSeasonRank}" onchange="updateParticipantField(${index}, 'lastSeasonRank', parseInt(this.value))">
                </div>
                <div class="admin-field">
                    <label>Bästa GW någonsin:</label>
                    <input type="number" value="${participant.bestGameweek}" onchange="updateParticipantField(${index}, 'bestGameweek', parseInt(this.value))">
                </div>
            </div>
        `;
        
        adminList.appendChild(card);
    });
}

function updateParticipantField(index, field, value) {
    if (index >= 0 && index < participantsData.length) {
        participantsData[index][field] = value;
        
        // Update the card styling based on new values
        const card = document.querySelector(`#adminParticipantsList .admin-participant-card:nth-child(${index + 1})`);
        if (card) {
            card.classList.remove('warning', 'error');
            
            if (!participantsData[index].fplId) {
                card.classList.add('warning');
            }
            if (!participantsData[index].profilRoast || participantsData[index].profilRoast.trim() === '') {
                card.classList.add('error');
            }
        }
    }
}

function saveParticipantChanges(index) {
    if (index >= 0 && index < participantsData.length) {
        // Save to localStorage immediately
        try {
            localStorage.setItem('fplParticipantsData', JSON.stringify(participantsData));
            
            // Show save confirmation
            const saveButton = document.querySelector(`[onclick="saveParticipantChanges(${index})"]`);
            if (saveButton) {
                const originalText = saveButton.textContent;
                saveButton.textContent = 'Ändringar sparade!';
                saveButton.style.background = '#10b981';
                setTimeout(() => {
                    saveButton.textContent = originalText;
                    saveButton.style.background = '';
                }, 2000);
            }
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            alert('Kunde inte spara ändringar. Försök igen.');
            return;
        }
        
        // Regenerate league data with updated participants
        useFallbackData();
        
        // Update UI
        populateProfiles();
        populateTables();
        updateHighlightsFromData();
    }
}

function deleteParticipant(index) {
    if (confirm(`Är du säker på att du vill ta bort ${participantsData[index].namn}?`)) {
        participantsData.splice(index, 1);
        
        // Save to localStorage immediately
        try {
            localStorage.setItem('fplParticipantsData', JSON.stringify(participantsData));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            alert('Kunde inte spara ändringar. Försök igen.');
            return;
        }
        
        populateAdminParticipantsList();
        
        // Regenerate league data
        useFallbackData();
        
        // Update UI
        populateProfiles();
        populateTables();
        updateHighlightsFromData();
        
        alert('Deltagare borttagen!');
    }
}

function showAddParticipantForm() {
    const form = document.getElementById('addParticipantForm');
    form.classList.remove('hidden');
    
    // Clear form fields
    document.getElementById('newName').value = '';
    document.getElementById('newTeam').value = '';
    document.getElementById('newFplId').value = '';
    document.getElementById('newRoast').value = '';
    document.getElementById('newImage').value = '';
}

function hideAddParticipantForm() {
    const form = document.getElementById('addParticipantForm');
    form.classList.add('hidden');
}

function addNewParticipant(event) {
    event.preventDefault();
    
    const name = document.getElementById('newName').value.trim();
    const team = document.getElementById('newTeam').value.trim();
    const fplId = document.getElementById('newFplId').value ? parseInt(document.getElementById('newFplId').value) : null;
    const roast = document.getElementById('newRoast').value.trim();
    const image = document.getElementById('newImage').value.trim();
    
    if (!name || !team) {
        alert('Namn och favoritlag är obligatoriska!');
        return;
    }
    
    const newParticipant = {
        namn: name,
        totalPoäng: 2000, // Default starting points
        favoritlag: team,
        fplId: fplId,
        profilRoast: roast || '',
        image: image || generateAvatarDataURL(name.charAt(0)),
        lastSeasonRank: 50, // Default rank
        bestGameweek: 60 // Default best GW
    };
    
    participantsData.push(newParticipant);
    
    // Save to localStorage immediately
    try {
        localStorage.setItem('fplParticipantsData', JSON.stringify(participantsData));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        alert('Kunde inte spara ändringar. Försök igen.');
        return;
    }
    
    // Hide form and refresh admin list
    hideAddParticipantForm();
    populateAdminParticipantsList();
    
    // Regenerate league data
    useFallbackData();
    
    // Update UI
    populateProfiles();
    populateTables();
    updateHighlightsFromData();
    
    alert('Ny deltagare tillagd!');
}

function exportParticipantsData() {
    const dataStr = JSON.stringify(participantsData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'participants-data.json';
    link.click();
    
    URL.revokeObjectURL(url);
    alert('Data exporterad som participants-data.json');
}

function saveToLocalStorage() {
    try {
        localStorage.setItem('fplParticipantsData', JSON.stringify(participantsData));
        
        // Show save confirmation
        const saveButton = document.querySelector('[onclick="saveToLocalStorage()"]');
        if (saveButton) {
            const originalText = saveButton.textContent;
            saveButton.textContent = 'Data sparad!';
            saveButton.style.background = '#10b981';
            setTimeout(() => {
                saveButton.textContent = originalText;
                saveButton.style.background = '';
            }, 2000);
        } else {
            alert('Data sparad till localStorage!');
        }
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        alert('Kunde inte spara till localStorage. Data för stor?');
    }
}

// Load data from localStorage on page load
function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem('fplParticipantsData');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            if (Array.isArray(parsedData) && parsedData.length > 0) {
                // Clear existing data and load from localStorage
                participantsData.splice(0, participantsData.length, ...parsedData);
                console.log('Loaded participants data from localStorage:', participantsData.length, 'participants');
                return true; // Indicate that data was loaded
            }
        }
        console.log('No saved data found in localStorage, using default data');
        return false; // Indicate that no data was loaded
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return false;
    }
}

// Export admin functions to global scope for HTML onclick handlers
window.showAdminPanel = showAdminPanel;
window.hideAdminPanel = hideAdminPanel;
window.showAddParticipantForm = showAddParticipantForm;
window.hideAddParticipantForm = hideAddParticipantForm;
window.addNewParticipant = addNewParticipant;
window.exportParticipantsData = exportParticipantsData;
window.saveToLocalStorage = saveToLocalStorage;
window.saveParticipantChanges = saveParticipantChanges;
window.deleteParticipant = deleteParticipant;
window.updateParticipantField = updateParticipantField;
window.showPrizeTotalInput = showPrizeTotalInput;
window.hidePrizeTotalInput = hidePrizeTotalInput;
window.hideAdminPrizeInput = hideAdminPrizeInput;
window.updatePrizeTotal = updatePrizeTotal;
window.showAllParticipants = showAllParticipants;
window.removeParticipant = removeParticipant;
window.testButton = testButton;

// Alternative admin access function (for debugging)
window.openAdmin = function() {
    console.log('Admin access requested via console function');
    console.log('showAdminPasswordPrompt function exists:', typeof showAdminPasswordPrompt);
    console.log('ADMIN_PASSWORD:', ADMIN_PASSWORD);
    showAdminPasswordPrompt();
};

// Test function to check if admin functions are working
window.testAdmin = function() {
    console.log('=== ADMIN FUNCTION TEST ===');
    console.log('showAdminPasswordPrompt:', typeof showAdminPasswordPrompt);
    console.log('showAdminPanel:', typeof showAdminPanel);
    console.log('ADMIN_PASSWORD:', ADMIN_PASSWORD);
    console.log('isAdminAuthenticated:', isAdminAuthenticated);
    console.log('adminModal element:', document.getElementById('adminModal'));
    
    // Try to show admin panel directly
    try {
        showAdminPasswordPrompt();
    } catch (error) {
        console.error('Error calling showAdminPasswordPrompt:', error);
    }
};

// Test function to verify global scope access
window.testPrizeFunction = function() {
    console.log('testPrizeFunction called - global scope is working');
    showPrizeTotalInput();
};

// Prize Chart Functions
function initializePrizeChart() {
    // Load saved prize total from localStorage
    const savedTotal = localStorage.getItem('fplPrizeTotal');
    if (savedTotal) {
        prizeTotal = parseInt(savedTotal);
    }
    
    // Create the prize chart
    createPrizeChart();
    updatePrizeBreakdown();
    
    // Add event listener for prize total input (only visible to admin)
    const prizeTotalInput = document.getElementById('prizeTotal');
    if (prizeTotalInput) {
        // Set the value if we have a saved total
        if (savedTotal) {
            prizeTotalInput.value = prizeTotal;
        }
        
        prizeTotalInput.addEventListener('input', function() {
            prizeTotal = parseInt(this.value) || 0;
            localStorage.setItem('fplPrizeTotal', prizeTotal.toString());
            updatePrizeChart();
            updatePrizeBreakdown();
            console.log('Prize total updated to:', prizeTotal);
        });
    }
    
    // Hide prize total input by default (only admin can see it)
    hidePrizeTotalInput();
}

function createPrizeChart() {
    const ctx = document.getElementById('prizeChart');
    if (!ctx) return;
    
    const chartData = {
                    labels: ['1:a', '2:a', '3:a', 'Cupen'],
        datasets: [{
            data: [50, 25, 15, 10],
            backgroundColor: [
                '#8b5cf6', // Purple
                '#1e40af', // Dark blue
                '#06b6d4', // Light blue
                '#ec4899'  // Pink
            ],
            borderColor: [
                '#7c3aed',
                '#1e3a8a',
                '#0891b2',
                '#db2777'
            ],
            borderWidth: 3,
            hoverBorderWidth: 5,
            hoverOffset: 10
        }]
    };
    
    const config = {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const percentage = context.parsed;
                            const amount = Math.round((prizeTotal * percentage) / 100);
                            return `${context.label}: ${percentage}% (${amount} kr)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1000,
                easing: 'easeOutQuart'
            },
            cutout: '60%'
        }
    };
    
    if (prizeChart) {
        prizeChart.destroy();
    }
    
    prizeChart = new Chart(ctx, config);
}

function updatePrizeChart() {
    if (prizeChart) {
        // Update tooltip with new amounts
        prizeChart.options.plugins.tooltip.callbacks.label = function(context) {
            const percentage = context.parsed;
            const amount = Math.round((prizeTotal * percentage) / 100);
            return `${context.label}: ${percentage}% (${amount} kr)`;
        };
        prizeChart.update('none'); // Update without animation for smooth number changes
    }
    
    // Update the current prize total display in admin panel
    const currentPrizeTotal = document.getElementById('currentPrizeTotal');
    if (currentPrizeTotal) {
        currentPrizeTotal.textContent = prizeTotal;
    }
}

function updatePrizeBreakdown() {
    const breakdown = document.getElementById('prizeBreakdown');
    if (!breakdown) return;
    
    const prizes = [
        { label: '1:a', percentage: 50 },
        { label: '2:a', percentage: 25 },
        { label: '3:a', percentage: 15 },
        { label: 'Cupen', percentage: 10 }
    ];
    
    breakdown.innerHTML = '';
    
    prizes.forEach(prize => {
        const amount = Math.round((prizeTotal * prize.percentage) / 100);
        const item = document.createElement('div');
        item.className = 'prize-breakdown-item';
        item.innerHTML = `
            <div class="prize-breakdown-label">${prize.label}</div>
            <div class="prize-breakdown-amount" data-amount="${amount}">${amount} kr</div>
            <div class="prize-breakdown-percentage">${prize.percentage}%</div>
        `;
        breakdown.appendChild(item);
    });
    
    // Animate the amounts
    animateNumbers();
}

function animateNumbers() {
    const amountElements = document.querySelectorAll('.prize-breakdown-amount');
    
    amountElements.forEach(element => {
        const targetAmount = parseInt(element.dataset.amount);
        const currentAmount = 0;
        const duration = 1000; // 1 second
        const steps = 60;
        const increment = targetAmount / steps;
        let currentStep = 0;
        
        const timer = setInterval(() => {
            currentStep++;
            const currentValue = Math.round(increment * currentStep);
            
            if (currentStep >= steps) {
                element.textContent = `${targetAmount} kr`;
                clearInterval(timer);
            } else {
                element.textContent = `${currentValue} kr`;
            }
        }, duration / steps);
    });
}

function showPrizeTotalInput() {
    console.log('showPrizeTotalInput function called');
    
    const adminPrizeInput = document.getElementById('adminPrizeTotalInput');
    console.log('adminPrizeInput element:', adminPrizeInput);
    
    if (adminPrizeInput) {
        // Show the admin prize input field
        adminPrizeInput.classList.remove('hidden');
        
        // Set the current value in the input field
        const inputField = document.getElementById('adminPrizeTotal');
        if (inputField) {
            inputField.value = prizeTotal;
            inputField.focus();
            inputField.select();
            console.log('Admin prize input field shown and focused');
        }
        
        console.log('Admin prize total input field shown');
    } else {
        console.log('adminPrizeInput element not found!');
    }
}

// Simple test function that should always work
function testButton() {
    console.log('Test button clicked!');
    alert('Button is working!');
}

function hidePrizeTotalInput() {
    const prizeTotalInput = document.getElementById('prizeTotalInput');
    if (prizeTotalInput) {
        prizeTotalInput.style.display = 'none';
    }
}

function hideAdminPrizeInput() {
    const adminPrizeInput = document.getElementById('adminPrizeTotalInput');
    if (adminPrizeInput) {
        adminPrizeInput.classList.add('hidden');
    }
}

function updatePrizeTotal() {
    const inputField = document.getElementById('adminPrizeTotal');
    if (inputField && inputField.value) {
        const newTotal = parseInt(inputField.value);
        if (newTotal >= 0) {
            prizeTotal = newTotal;
            
            // Update the chart
            updatePrizeChart();
            
            // Update the current prize total display in admin panel
            const currentPrizeTotal = document.getElementById('currentPrizeTotal');
            if (currentPrizeTotal) {
                currentPrizeTotal.textContent = newTotal;
            }
            
            // Save to localStorage
            localStorage.setItem('fplPrizeTotal', newTotal.toString());
            
            // Hide the input field
            hideAdminPrizeInput();
            
            console.log('Prize total updated to:', newTotal);
        }
    }
}

// Chart instance

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOM CONTENT LOADED ===');
    console.log('DISABLE_API_CALLS:', DISABLE_API_CALLS);
    console.log('FPL_API_BASE:', FPL_API_BASE);
    console.log('LEAGUE_CODE:', LEAGUE_CODE);
    
    // Add data source indicator immediately
    addDataSourceIndicator();
    
    checkLoginStatus();
    setupEventListeners();
    loadFromLocalStorage(); // Load saved participant data
    
    // Add Enter key handler for password input
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                checkPassword();
            }
        });
    }
});

// FPL API Integration Functions
async function fetchBootstrapData() {
    try {
        console.log('🔄 Fetching bootstrap data from FPL API...');
        console.log('📡 API URL:', `${FPL_API_BASE}/bootstrap-static/`);
        
        const response = await fetch(`${FPL_API_BASE}/bootstrap-static/`);
        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Bootstrap data fetched successfully!');
        console.log('📊 Data structure:', {
            events: data.events?.length || 0,
            teams: data.teams?.length || 0,
            elements: data.elements?.length || 0
        });
        
        bootstrapData = data;
        return data;
    } catch (error) {
        console.error('❌ Error fetching bootstrap data:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            type: error.name
        });
        
        // Check for specific error types
        if (error.message.includes('CORS') || error.message.includes('Access-Control-Allow-Origin')) {
            console.log('⚠️ CORS error detected in bootstrap fetch');
            throw new Error('CORS policy blocks API calls from public hosting');
        } else if (error.message.includes('Failed to fetch')) {
            console.log('⚠️ Network error detected in bootstrap fetch');
            throw new Error('Network error - FPL API may be temporarily unavailable');
        } else {
            throw error;
        }
    }
}

async function fetchPlayerData(fplId) {
    try {
        console.log(`🔄 Fetching player data for FPL ID: ${fplId}`);
        
        // Fetch current season data
        const currentUrl = `${FPL_API_BASE}/entry/${fplId}/`;
        console.log(`📡 Current season URL: ${currentUrl}`);
        
        const currentResponse = await fetch(currentUrl);
        console.log(`📡 Current response status: ${currentResponse.status}`);
        
        if (!currentResponse.ok) {
            throw new Error(`Current season HTTP error! status: ${currentResponse.status}`);
        }
        const currentData = await currentResponse.json();
        console.log(`✅ Current season data for FPL ID ${fplId}:`, currentData);
        
        // Fetch historical data
        const historyUrl = `${FPL_API_BASE}/entry/${fplId}/history/`;
        console.log(`📡 History URL: ${historyUrl}`);
        
        const historyResponse = await fetch(historyUrl);
        console.log(`📡 History response status: ${historyResponse.status}`);
        
        if (!historyResponse.ok) {
            throw new Error(`History HTTP error! status: ${historyResponse.status}`);
        }
        const historyData = await historyResponse.json();
        console.log(`✅ History data for FPL ID ${fplId}:`, historyData);
        
        console.log(`✅ Player data fetched successfully for FPL ID ${fplId}`);
        return { currentData, historyData };
    } catch (error) {
        console.error(`❌ Error fetching player data for FPL ID ${fplId}:`, error);
        console.error(`❌ Error details:`, {
            message: error.message,
            stack: error.stack
        });
        return null;
    }
}

async function fetchGameweekPicks(fplId, gameweek) {
    try {
        console.log(`🔄 Fetching GW${gameweek} picks for FPL ID: ${fplId}`);
        const response = await fetch(`${FPL_API_BASE}/entry/${fplId}/event/${gameweek}/picks/`);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log(`⚠️ GW${gameweek} data not available for FPL ID ${fplId} (404)`);
                return null;
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
        
        const data = await response.json();
        console.log(`✅ GW${gameweek} picks fetched for FPL ID ${fplId}`);
        return data;
    } catch (error) {
        // Check for CORS errors specifically
        if (error.message.includes('CORS') || error.message.includes('Access-Control-Allow-Origin')) {
            console.log(`⚠️ CORS blocked GW${gameweek} picks for FPL ID ${fplId} - this is expected on public hosting`);
            return null;
        } else {
            console.error(`❌ Error fetching GW${gameweek} picks for FPL ID ${fplId}:`, error);
        }
        return null;
    }
}

async function fetchLeagueData() {
    try {
        console.log('Fetching league data from FPL API...');
        const response = await fetch(`${FPL_API_BASE}/leagues-classic/${LEAGUE_CODE}/standings/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('League data fetched successfully:', data);
        return data;
    } catch (error) {
        console.error('Error fetching league data:', error);
        return null;
    }
}

// Function to update participantsData with real FPL data - API-Only Mode
async function updateParticipantsWithFPLData() {
    console.log('=== UPDATING PARTICIPANTS WITH FPL DATA (API-ONLY) ===');
    console.log('Initial participantsData:', participantsData);
    
    // Count participants with FPL IDs
    const participantsWithFPL = participantsData.filter(p => p.fplId && p.fplId !== null);
    console.log(`📊 Found ${participantsWithFPL.length} participants with FPL IDs`);
    
    if (participantsWithFPL.length === 0) {
        throw new Error('No participants with FPL IDs found. Cannot proceed with API-only mode.');
    }
    
    // Update each participant with real FPL data
    for (let i = 0; i < participantsData.length; i++) {
        const participant = participantsData[i];
        
        if (participant.fplId && participant.fplId !== null) {
            console.log(`🔄 Updating participant ${participant.namn} with FPL ID ${participant.fplId}`);
            
            const playerData = await fetchPlayerData(participant.fplId);
            if (playerData) {
                const { currentData, historyData } = playerData;
                console.log(`✅ FPL data received for ${participant.namn}`);
                
                // Update with real data while preserving custom fields
                participantsData[i] = {
                    ...participant, // Keep existing custom data (roasts, image, favoritlag, etc.)
                    namn: currentData.player_first_name + ' ' + currentData.player_last_name,
                    totalPoäng: currentData.summary_overall_points,
                    lastSeasonRank: historyData.past?.find(past => past.season_name === '2023/24')?.rank || 'N/A',
                    bestGameweek: Math.max(...historyData.current.map(gw => gw.points), 0)
                };
                
                console.log(`✅ Updated ${participant.namn} with real data:`, participantsData[i]);
            } else {
                console.log(`❌ Failed to fetch FPL data for ${participant.namn} (ID: ${participant.fplId})`);
                // In API-only mode, we should throw an error if we can't fetch data
                throw new Error(`Failed to fetch FPL data for ${participant.namn} (ID: ${participant.fplId})`);
            }
        } else {
            console.log(`❌ Participant ${participant.namn} has no FPL ID - this should not happen in API-only mode`);
            throw new Error(`Participant ${participant.namn} has no FPL ID. All participants must have valid FPL IDs in API-only mode.`);
        }
    }
    
    // Save updated data to localStorage
    localStorage.setItem('fplParticipantsData', JSON.stringify(participantsData));
    console.log('💾 Participants data updated and saved to localStorage');
    console.log('📊 Final participantsData:', participantsData);
}

// Function to calculate weekly highlights from real FPL data - API-Only Mode
async function calculateWeeklyHighlightsFromAPI() {
    console.log('=== CALCULATING WEEKLY HIGHLIGHTS FROM API (API-ONLY) ===');
    
    if (!bootstrapData || !bootstrapData.events) {
        throw new Error('No bootstrap data available. Cannot calculate highlights in API-only mode.');
    }
    
    const currentGW = currentGameweek;
    console.log(`🔄 Calculating highlights for GW${currentGW}`);
    
    const gwHighlights = {
        rocket: { player: null, points: 0 },
        flop: { player: null, points: 999 },
        captain: { player: null, captain: '', points: 0 },
        bench: { player: null, points: 0 }
    };
    
    // Get all participants (should all have FPL IDs in API-only mode)
    const allParticipants = participantsData.filter(p => p.fplId && p.fplId !== null);
    
    if (allParticipants.length === 0) {
        throw new Error('No participants with FPL IDs found. Cannot calculate highlights.');
    }
    
    console.log(`📊 Calculating highlights for ${allParticipants.length} participants`);
    
    for (const participant of allParticipants) {
        const picksData = await fetchGameweekPicks(participant.fplId, currentGW);
        if (picksData) {
            const gwPoints = picksData.entry_history.points;
            const captain = picksData.picks.find(pick => pick.is_captain)?.element || null;
            const benchPoints = picksData.picks.filter(pick => pick.position > 11).reduce((sum, pick) => sum + (pick.multiplier > 0 ? pick.points : 0), 0);
            
            // Update highlights
            if (gwPoints > gwHighlights.rocket.points) {
                gwHighlights.rocket = { player: participant, points: gwPoints };
            }
            if (gwPoints < gwHighlights.flop.points) {
                gwHighlights.flop = { player: participant, points: gwPoints };
            }
            if (benchPoints > gwHighlights.bench.points) {
                gwHighlights.bench = { player: participant, points: benchPoints };
            }
            
            // Captain highlight (lowest captain points)
            if (captain && gwPoints < gwHighlights.captain.points) {
                const captainName = bootstrapData.elements.find(el => el.id === captain)?.web_name || 'Unknown';
                gwHighlights.captain = { player: participant, captain: captainName, points: gwPoints };
            }
        } else {
            console.log(`⚠️ No gameweek data for ${participant.namn} (GW${currentGW})`);
        }
    }
    
    // Update league data with calculated highlights
    leagueData.highlights = {
        rocket: gwHighlights.rocket.player ? `${gwHighlights.rocket.player.namn} - ${gwHighlights.rocket.points} poäng` : 'Ingen data tillgänglig',
        flop: gwHighlights.flop.player ? `${gwHighlights.flop.player.namn} - ${gwHighlights.flop.points} poäng` : 'Ingen data tillgänglig',
        captain: gwHighlights.captain.player ? `${gwHighlights.captain.player.namn} - ${gwHighlights.captain.captain} (${gwHighlights.captain.points} poäng)` : 'Ingen data tillgänglig',
        bench: gwHighlights.bench.player ? `${gwHighlights.bench.player.namn} - ${gwHighlights.bench.points} poäng` : 'Ingen data tillgänglig'
    };
    
    console.log('✅ Weekly highlights calculated from API:', leagueData.highlights);
}

// Initialize FPL data - API-Only Mode
async function initializeFPLData() {
    console.log('=== INITIALIZING FPL DATA (API-ONLY MODE) ===');
    console.log('DISABLE_API_CALLS:', DISABLE_API_CALLS);
    
    if (DISABLE_API_CALLS) {
        console.log('❌ API calls disabled for local development (CORS restriction)');
        updateDataSourceIndicator('📊 Mock Data (Local Dev)', '#f59e0b', '#000');
        useFallbackData();
        return;
    }
    
    console.log('✅ API-ONLY MODE: Fetching real data from FPL API...');
    
    try {
        // Step 1: Fetch bootstrap data and determine current gameweek
        console.log('🔄 Step 1: Fetching bootstrap data...');
        const bootstrapData = await fetchBootstrapData();
        if (!bootstrapData) {
            throw new Error('Failed to fetch bootstrap data from FPL API');
        }
        
        // Determine current gameweek from bootstrap data
        const currentEvent = bootstrapData.events.find(event => event.is_current);
        if (currentEvent) {
            currentGameweek = currentEvent.id;
            console.log(`✅ Current gameweek determined: ${currentGameweek}`);
        } else {
            // Check for the next upcoming gameweek
            const nextEvent = bootstrapData.events.find(event => !event.finished);
            if (nextEvent) {
                currentGameweek = nextEvent.id;
                console.log(`✅ Next upcoming gameweek: ${currentGameweek}`);
            } else {
                // Fallback to latest finished gameweek
                const latestEvent = bootstrapData.events
                    .filter(event => event.finished)
                    .sort((a, b) => b.id - a.id)[0];
                if (latestEvent) {
                    currentGameweek = latestEvent.id;
                    console.log(`✅ Using latest finished gameweek: ${currentGameweek}`);
                } else {
                    currentGameweek = 1;
                    console.log(`⚠️ No gameweek data found, defaulting to GW1`);
                }
            }
        }
        
        console.log(`📅 Available events:`, bootstrapData.events.map(e => ({ id: e.id, name: e.name, finished: e.finished, is_current: e.is_current })));
        
        // Step 2: Update all participants with real FPL data
        console.log('🔄 Step 2: Updating all participants with real FPL data...');
        await updateParticipantsWithFPLData();
        
        // Step 3: Generate league tables from real data
        console.log('🔄 Step 3: Generating league tables from real data...');
        await generateLeagueTablesFromAPI();
        
        // Step 4: Calculate weekly highlights from real data
        console.log('🔄 Step 4: Calculating weekly highlights from real data...');
        await calculateWeeklyHighlightsFromAPI();
        
        // Step 5: Generate roasts from real data
        console.log('🔄 Step 5: Generating roasts from real data...');
        await generateRealRoasts();
        
        console.log('✅ FPL API data loaded successfully!');
        console.log('📊 Final leagueData:', leagueData);
        console.log('👥 Final participantsData:', participantsData);
        
        // Update data source indicator
        updateDataSourceIndicator('🌐 Live FPL Data', '#10b981', '#fff');
        
        // Populate UI with real data
        setTimeout(() => {
            console.log('🔄 Populating UI with real data...');
            populateTables();
            populateProfiles();
            updateHighlightsFromData();
            generateRoastMessages();
        }, 100);
        
    } catch (error) {
        console.error('❌ CRITICAL ERROR: FPL API is unreachable:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            type: error.name
        });
        
        // Check if it's a CORS error
        if (error.message.includes('CORS') || error.message.includes('Access-Control-Allow-Origin')) {
            console.log('⚠️ CORS error detected - this is expected on public hosting');
            updateDataSourceIndicator('⚠️ CORS Blocked', '#f59e0b', '#000');
            showAPIErrorNotification('CORS policy blocks API calls from public hosting. This is normal for public websites. Using fallback data.');
        } else if (error.message.includes('Network error')) {
            console.log('⚠️ Network error detected - FPL API may be temporarily unavailable');
            updateDataSourceIndicator('⚠️ Network Error', '#f59e0b', '#000');
            showAPIErrorNotification('Network error - FPL API may be temporarily unavailable. Using fallback data.');
        } else {
            updateDataSourceIndicator('❌ API Error', '#ef4444', '#fff');
            showAPIErrorNotification(`API Error: ${error.message}. Using fallback data.`);
        }
        
        // Use fallback data
        console.log('🔄 Using fallback data due to API failure...');
        useFallbackData();
    }
}

// Function to generate league tables from API data - API-Only Mode
async function generateLeagueTablesFromAPI() {
    console.log('=== GENERATING LEAGUE TABLES FROM API (API-ONLY) ===');
    
    if (!bootstrapData || !bootstrapData.events) {
        throw new Error('No bootstrap data available. Cannot generate league tables in API-only mode.');
    }
    
    // Get all participants (should all have FPL IDs in API-only mode)
    const allParticipants = participantsData.filter(p => p.fplId && p.fplId !== null);
    
    if (allParticipants.length === 0) {
        throw new Error('No participants with FPL IDs found. Cannot generate league tables.');
    }
    
    console.log(`📊 Generating tables for ${allParticipants.length} participants`);
    
    // Generate season table from real data
    leagueData.seasonTable = allParticipants
        .map(participant => ({
            position: 0, // Will be calculated after sorting
            name: participant.namn,
            points: participant.totalPoäng,
            gameweek: currentGameweek,
            managerId: participant.fplId
        }))
        .sort((a, b) => b.points - a.points)
        .map((player, index) => ({ ...player, position: index + 1 }));
    
    // Generate gameweek table from real data
    console.log(`🔄 Fetching gameweek ${currentGameweek} data for all participants...`);
    const gwData = [];
    
    for (const participant of allParticipants) {
        const picksData = await fetchGameweekPicks(participant.fplId, currentGameweek);
        if (picksData && picksData.entry_history) {
            gwData.push({
                position: 0, // Will be calculated after sorting
                name: participant.namn,
                points: picksData.entry_history.points,
                gameweek: currentGameweek,
                managerId: participant.fplId
            });
            console.log(`✅ Added ${participant.namn} with ${picksData.entry_history.points} points`);
        } else {
            console.log(`⚠️ No gameweek data for ${participant.namn} (GW${currentGameweek}) - using season total`);
            // Use season total points if gameweek data unavailable
            gwData.push({
                position: 0,
                name: participant.namn,
                points: participant.totalPoäng || 0,
                gameweek: currentGameweek,
                managerId: participant.fplId
            });
        }
    }
    
    leagueData.gameweekTable = gwData
        .sort((a, b) => b.points - a.points)
        .map((player, index) => ({ ...player, position: index + 1 }));
    
    console.log('✅ League tables generated from API:', {
        seasonTable: leagueData.seasonTable.length,
        gameweekTable: leagueData.gameweekTable.length
    });
}

// Use fallback data when API is completely unreachable (last resort)
function useFallbackData() {
    console.log('=== USING FALLBACK DATA (API UNAVAILABLE) ===');
    
    // Determine the appropriate indicator text
    let indicatorText = '📊 Mock Data';
    let indicatorColor = '#f59e0b';
    let textColor = '#000';
    
    if (DISABLE_API_CALLS) {
        indicatorText = '📊 Mock Data (Local Dev)';
    } else {
        indicatorText = '📊 Mock Data (API Failed)';
    }
    
    updateDataSourceIndicator(indicatorText, indicatorColor, textColor);
    
    // Try to load from localStorage first if we haven't already
    if (participantsData.length === 0) {
        console.log('No participants data found, attempting to load from localStorage...');
        loadFromLocalStorage();
    }
    
    console.log('participantsData length:', participantsData.length);
    console.log('participantsData:', participantsData);
    
    // Validate participantsData
    if (!participantsData || participantsData.length === 0) {
        console.error('CRITICAL ERROR: participantsData is empty or undefined!');
        alert('CRITICAL ERROR: participantsData is empty or undefined!');
        return;
    }
    
    // Clear bootstrap data to ensure mock roasts are used
    bootstrapData = {
        teams: {},
        players: {},
        events: []
    };
    
    // Generate fallback data from modular participant data
    leagueData = {
        seasonTable: participantsData.map((participant, index) => ({
            position: index + 1,
            name: participant.namn,
            points: participant.totalPoäng,
            gameweek: currentGameweek,
            managerId: participant.fplId || (123456 + index) // Fallback ID if no FPL ID
        })),
        gameweekTable: participantsData.map((participant, index) => ({
            position: index + 1,
            name: participant.namn,
            points: Math.floor(Math.random() * 50) + 45, // Mock gameweek points
            gameweek: currentGameweek,
            managerId: participant.fplId || (123456 + index)
        })).sort((a, b) => b.points - a.points).map((player, index) => ({ ...player, position: index + 1 })),
        highlights: {
            rocket: 'Melvin Yuksel - 89 poäng',
            flop: 'Johan Pauly - 45 poäng',
            captain: 'Erik Rotsenius - Harry Kane (2 poäng)',
            bench: 'Jakob Gårlin - 15 poäng'
        },
        players: participantsData.map(participant => ({
            name: participant.namn,
            image: participant.image,
            points: participant.totalPoäng,
            team: participant.favoritlag,
            lastSeasonRank: participant.lastSeasonRank,
            bestGameweek: participant.bestGameweek,
            managerId: participant.fplId || null,
            profilRoast: participant.profilRoast
        }))
    };
    
    console.log('Generated leagueData:', leagueData);
    console.log('Season table length:', leagueData.seasonTable.length);
    console.log('Gameweek table length:', leagueData.gameweekTable.length);
    console.log('Players length:', leagueData.players.length);
    
    // Set current gameweek (should already be set to 1, but ensure it's correct)
    if (currentGameweek !== 1) {
        currentGameweek = 1;
        console.log('Updated currentGameweek to 1 for new season');
    }
    
    // Initialize prize chart
    console.log('Initializing prize chart...');
    initializePrizeChart();
    
    // Update the UI with fallback data - with a small delay to ensure DOM is ready
    console.log('=== POPULATING UI ===');
    setTimeout(() => {
        // Ensure main content is visible for population
        const mainContent = document.getElementById('mainContent');
        if (mainContent && mainContent.classList.contains('hidden')) {
            console.log('Making main content visible for data population...');
            mainContent.classList.remove('hidden');
        }
        
        console.log('Populating tables...');
        populateTables();
        console.log('Populating profiles...');
        populateProfiles();
        console.log('Updating highlights...');
        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
            updateHighlightsFromData();
        }, 200);
        console.log('=== UI POPULATION COMPLETE ===');
        
        // Show info message about fallback data
        showFallbackInfo();
    }, 100);
}

// Show info about fallback data
function showFallbackInfo() {
    const infoDiv = document.createElement('div');
    infoDiv.id = 'fallbackInfo';
    infoDiv.innerHTML = `
        <div class="fallback-info">
            <i class="fas fa-info-circle"></i>
            <p>Visar exempeldata tills FPL-säsongen startar. Live-data kommer att laddas automatiskt när säsongen börjar.</p>
            <button onclick="this.parentElement.parentElement.remove()">Stäng</button>
        </div>
    `;
    document.body.appendChild(infoDiv);
}

// Show loading state
function showLoadingState() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingOverlay';
    loadingDiv.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>Hämtar FPL-data...</p>
        </div>
    `;
    document.body.appendChild(loadingDiv);
}

// Hide loading state
function hideLoadingState() {
    const loadingDiv = document.getElementById('loadingOverlay');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Show error state
function showErrorState() {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'errorOverlay';
    errorDiv.innerHTML = `
        <div class="error-content">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Fel vid hämtning av data</h3>
            <p>Kunde inte hämta FPL-data. Försök igen senare.</p>
            <button onclick="location.reload()">Ladda om</button>
        </div>
    `;
    document.body.appendChild(errorDiv);
}

// Check if user is already logged in
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('fplLoggedIn');
    if (isLoggedIn === 'true') {
        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
            showMainContent();
        }, 100);
    }
}

// Password check function
function checkPassword() {
    const passwordInput = document.getElementById('passwordInput');
    const password = passwordInput.value.trim(); // Remove whitespace
    
    console.log('Password entered:', password);
    console.log('Correct password:', CORRECT_PASSWORD);
    console.log('Password match:', password === CORRECT_PASSWORD);
    
    if (password === CORRECT_PASSWORD) {
        console.log('Password correct! Logging in...');
        localStorage.setItem('fplLoggedIn', 'true');
        showMainContent();
        passwordInput.value = '';
    } else {
        console.log('Password incorrect!');
        alert('Fel lösenord! Kontakta mig för att få rätt lösenord.');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// Show main content after successful login
function showMainContent() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainContent').classList.remove('hidden');
    
    // Initialize FPL data when user logs in
    console.log('Initializing FPL data after login...');
    initializeFPLData();
}

// Add data source indicator to the page
function addDataSourceIndicator() {
    // Remove existing indicator if it exists
    const existingIndicator = document.getElementById('dataSourceIndicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'dataSourceIndicator';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #1e293b;
        color: #06b6d4;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        z-index: 1000;
        border: 1px solid #334155;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: all 0.3s ease;
    `;
    indicator.textContent = '🔄 Loading...';
    indicator.onclick = testAPIConnection;
    
    // Add to body so it's always visible
    document.body.appendChild(indicator);
    
    // Update indicator based on data source immediately
    if (DISABLE_API_CALLS) {
        indicator.textContent = '📊 Mock Data (Local Dev)';
        indicator.style.background = '#f59e0b';
        indicator.style.color = '#000';
    } else {
        indicator.textContent = '🌐 Live FPL Data';
        indicator.style.background = '#10b981';
        indicator.style.color = '#fff';
    }
}

// Test API connection manually
async function testAPIConnection() {
    console.log('🧪 MANUAL API TEST TRIGGERED');
    
    // Check if API calls are disabled
    if (DISABLE_API_CALLS) {
        console.log('🧪 API calls are disabled for local development');
        alert('API calls are currently disabled for local development.\n\nTo test API integration:\n1. Run: node deploy.js\n2. Deploy to a proper web server\n3. API will work when hosted (not file://)');
        return;
    }
    
    try {
        console.log('🧪 Testing bootstrap API...');
        const bootstrapTest = await fetch(`${FPL_API_BASE}/bootstrap-static/`);
        console.log('🧪 Bootstrap response status:', bootstrapTest.status);
        
        if (bootstrapTest.ok) {
            const bootstrapData = await bootstrapTest.json();
            console.log('🧪 Bootstrap test successful:', {
                events: bootstrapData.events?.length || 0,
                teams: bootstrapData.teams?.length || 0
            });
        } else {
            throw new Error(`Bootstrap API returned status: ${bootstrapTest.status}`);
        }
        
        console.log('🧪 Testing player API for ID 1490173 (Melvin Yuksel)...');
        const playerTest = await fetch(`${FPL_API_BASE}/entry/1490173/`);
        console.log('🧪 Player response status:', playerTest.status);
        
        if (playerTest.ok) {
            const playerData = await playerTest.json();
            console.log('🧪 Player test successful:', {
                name: `${playerData.player_first_name} ${playerData.player_last_name}`,
                points: playerData.summary_overall_points,
                season: '2024/25'
            });
        } else {
            throw new Error(`Player API returned status: ${playerTest.status}`);
        }
        
        console.log('🧪 Testing current gameweek picks...');
        const picksTest = await fetch(`${FPL_API_BASE}/entry/1490173/event/${currentGameweek}/picks/`);
        console.log('🧪 Picks response status:', picksTest.status);
        
        if (picksTest.ok) {
            const picksData = await picksTest.json();
            console.log('🧪 Picks test successful:', {
                gameweek: picksData.entry_history.event,
                points: picksData.entry_history.points
            });
        } else {
            console.log('⚠️ Picks API returned status:', picksTest.status, '- this may be normal for new season');
        }
        
        alert('✅ API test successful!\n\nFPL API is working correctly.\nCheck console for detailed results.');
        
    } catch (error) {
        console.error('🧪 API test failed:', error);
        
        if (error.message.includes('CORS')) {
            alert('❌ API test failed due to CORS restrictions.\n\nThis is expected when running locally.\nDeploy to a proper web server to enable API integration.');
        } else {
            alert(`❌ API test failed!\n\nError: ${error.message}\n\nCheck console for detailed error information.`);
        }
    }
}

// Update data source indicator
function updateDataSourceIndicator(text, bgColor, textColor) {
    const indicator = document.getElementById('dataSourceIndicator');
    if (indicator) {
        indicator.textContent = text;
        indicator.style.background = bgColor;
        indicator.style.color = textColor;
    }
}

// Show API error notification to admin
function showAPIErrorNotification(errorMessage = 'Unknown error') {
    const notification = document.createElement('div');
    notification.id = 'apiErrorNotification';
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ef4444;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        text-align: center;
        max-width: 400px;
    `;
    notification.innerHTML = `
        <div style="margin-bottom: 0.5rem;">⚠️ FPL API Error</div>
        <div style="font-size: 0.9rem; font-weight: normal;">
            Unable to fetch real-time data from FPL API.<br>
            Error: ${errorMessage}<br>
            Using fallback data. Check console for details.
        </div>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 1rem;
            background: white;
            color: #ef4444;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
        ">OK</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 10000);
}

// Note: Duplicate API functions removed - using the ones defined earlier in the file

// Calculate gameweek scores
function calculateGameweekScores() {
    leagueData.gameweekTable = leagueData.seasonTable.map(player => ({
        ...player,
        points: player.gameweekPoints ? player.gameweekPoints[player.gameweekPoints.length - 1] : 0
    })).sort((a, b) => b.points - a.points);
    
    // Update positions
    leagueData.gameweekTable.forEach((player, index) => {
        player.position = index + 1;
    });
}

// Update player profiles
function updatePlayerProfiles() {
    leagueData.players = leagueData.seasonTable.map(player => ({
        name: player.name,
        image: generateAvatarDataURL(player.name.charAt(0)),
        points: player.points,
        team: 'Manchester United', // This would be fetched from team data
        lastSeasonRank: player.lastSeasonRank,
        bestGameweek: player.bestGameweek,
        managerId: player.managerId
    }));
}



// Save data (admin function)
function saveData() {
    localStorage.setItem('leagueData', JSON.stringify(leagueData));
}

// Admin panel constants

// Function to check if user is currently authenticated as admin
function isUserAdmin() {
    return isAdminAuthenticated || (document.getElementById('adminModal') && document.getElementById('adminModal').classList.contains('show'));
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Admin panel keyboard shortcut (Shift + A)
    document.addEventListener('keydown', function(e) {
        console.log('Key pressed:', e.key, 'Shift:', e.shiftKey);
        if (e.shiftKey && e.key === 'A') {
            console.log('Admin shortcut detected!');
            e.preventDefault();
            showAdminPasswordPrompt();
        }
    });
    
    // Close admin panel when clicking outside
    document.addEventListener('click', function(e) {
        const adminModal = document.getElementById('adminModal');
        if (e.target === adminModal) {
            hideAdminPanel();
        }
    });
    
    console.log('Event listeners set up successfully');
}

// Navigation functions
function showSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
    
    // Show selected section
    document.getElementById(sectionName).classList.add('active');
    
    // Update navigation buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    

    
    // Generate roast messages when highlights section is shown
    if (sectionName === 'highlights') {
        console.log('Highlights section shown, generating roast messages...');
        setTimeout(() => {
            generateRoastMessages();
            generateBeerLevels();
            updateWallOfFameShame();
        }, 100);
    }
}

function showTable(tableType) {
    // Hide all table containers
    const tableContainers = document.querySelectorAll('.table-container');
    tableContainers.forEach(container => container.classList.remove('active'));
    
    // Show selected table
    document.getElementById(tableType + 'Table').classList.add('active');
    
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

// Populate tables with data
function populateTables() {
    populateSeasonTable();
    populateGameweekTable();
}

function populateSeasonTable() {
    console.log('=== POPULATE SEASON TABLE ===');
    console.log('leagueData.seasonTable:', leagueData.seasonTable);
    console.log('leagueData.seasonTable length:', leagueData.seasonTable ? leagueData.seasonTable.length : 'UNDEFINED');
    
    const tbody = document.getElementById('seasonTableBody');
    console.log('seasonTableBody element:', tbody);
    
    if (!tbody) {
        console.error('CRITICAL ERROR: seasonTableBody not found!');
        return;
    }
    
    if (!leagueData.seasonTable || leagueData.seasonTable.length === 0) {
        console.error('CRITICAL ERROR: leagueData.seasonTable is empty!');
        tbody.innerHTML = '<tr><td colspan="4">No data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    leagueData.seasonTable.forEach((player, index) => {
        console.log(`Creating row ${index + 1} for player:`, player);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${player.position}</td>
            <td>${player.name}</td>
            <td>${player.points}</td>
            <td>${player.gameweek}</td>
        `;
        tbody.appendChild(row);
    });
    
    console.log('Season table populated with', leagueData.seasonTable.length, 'rows');
}

function populateGameweekTable() {
    console.log('=== POPULATE GAMEWEEK TABLE ===');
    console.log('leagueData.gameweekTable:', leagueData.gameweekTable);
    console.log('leagueData.gameweekTable length:', leagueData.gameweekTable ? leagueData.gameweekTable.length : 'UNDEFINED');
    
    const tbody = document.getElementById('gameweekTableBody');
    console.log('gameweekTableBody element:', tbody);
    
    if (!tbody) {
        console.error('CRITICAL ERROR: gameweekTableBody not found!');
        return;
    }
    
    if (!leagueData.gameweekTable || leagueData.gameweekTable.length === 0) {
        console.error('CRITICAL ERROR: leagueData.gameweekTable is empty!');
        tbody.innerHTML = '<tr><td colspan="4">No gameweek data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    leagueData.gameweekTable.forEach((player, index) => {
        console.log(`Creating GW row ${index + 1} for player:`, player);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${player.position}</td>
            <td>${player.name}</td>
            <td>${player.points}</td>
            <td>${player.gameweek}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Update gameweek label
    const gameweekLabel = document.getElementById('currentGameweekLabel');
    if (gameweekLabel) {
        gameweekLabel.textContent = `Gameweek ${currentGameweek}`;
    }
    
    console.log('Gameweek table populated with', leagueData.gameweekTable.length, 'rows');
}









// Update highlights from gameweek data
async function updateHighlightsFromData() {
    console.log('=== UPDATE HIGHLIGHTS FROM DATA ===');
    console.log('leagueData.gameweekTable:', leagueData.gameweekTable);
    console.log('leagueData.gameweekTable.length:', leagueData.gameweekTable ? leagueData.gameweekTable.length : 'UNDEFINED');
    
    // Check if DOM elements exist
    const weeklyRocketElement = document.getElementById('weeklyRocket');
    const weeklyFlopElement = document.getElementById('weeklyFlop');
    
    console.log('weeklyRocket element:', weeklyRocketElement);
    console.log('weeklyFlop element:', weeklyFlopElement);
    
    if (!weeklyRocketElement || !weeklyFlopElement) {
        console.error('CRITICAL ERROR: Highlight DOM elements not found!');
        return;
    }
    
    // Check if we have real data or should use mock data
    // In API-only mode, we should always use real data if available
    const useMockData = DISABLE_API_CALLS || !leagueData.gameweekTable || leagueData.gameweekTable.length === 0;
    
    if (useMockData) {
        console.log('=== DEBUGGING WEEKLY HIGHLIGHTS ===');
        console.log('Using mock data for highlights');
        console.log('participantsData length:', participantsData.length);
        console.log('participantsData names:', participantsData.map(p => p.namn));
        
        // Check if participantsData is available
        if (!participantsData || participantsData.length === 0) {
            console.error('CRITICAL ERROR: participantsData is empty or undefined!');
            weeklyRocketElement.textContent = 'Ingen data tillgänglig';
            weeklyFlopElement.textContent = 'Ingen data tillgänglig';
            return;
        }
        
        // Use random participants for mock highlights
        const shuffledParticipants = [...participantsData].sort(() => 0.5 - Math.random());
        console.log('shuffledParticipants names:', shuffledParticipants.map(p => p.namn));
        
        // Generate realistic gameweek points (30-85 range for a single week)
        const rocketPoints = Math.floor(Math.random() * 55) + 30; // 30-85 points
        const flopPoints = Math.floor(Math.random() * 25) + 15; // 15-40 points
        
        // Veckans Raket - Random participant with high gameweek points
        const rocket = shuffledParticipants[0];
        console.log('Setting rocket:', rocket.namn, 'with points:', rocketPoints);
        weeklyRocketElement.textContent = `${rocket.namn} - ${rocketPoints} poäng`;
        
        // Veckans Sopa - Random participant with low gameweek points
        const flop = shuffledParticipants[1];
        console.log('Setting flop:', flop.namn, 'with points:', flopPoints);
        weeklyFlopElement.textContent = `${flop.namn} - ${flopPoints} poäng`;
        
        console.log('Final weeklyRocketElement.textContent:', weeklyRocketElement.textContent);
        console.log('Final weeklyFlopElement.textContent:', weeklyFlopElement.textContent);
        
        // Force a test to see if the element is being updated
        setTimeout(() => {
            console.log('After 1 second - weeklyFlopElement.textContent:', weeklyFlopElement.textContent);
            console.log('After 1 second - weeklyFlopElement.innerHTML:', weeklyFlopElement.innerHTML);
        }, 1000);
        
        // Mock captain data
        const captain = shuffledParticipants[2];
        document.getElementById('weeklyCaptain').textContent = `${captain.namn} - Haaland (2 poäng)`;
        
    } else {
        // Use real data from leagueData
        if (!leagueData.gameweekTable || leagueData.gameweekTable.length === 0) {
            console.error('CRITICAL ERROR: No gameweek data available!');
            return;
        }
        
        // Veckans Raket - Highest gameweek points
        const rocket = leagueData.gameweekTable[0];
        console.log('Rocket player:', rocket);
        weeklyRocketElement.textContent = `${rocket.name} - ${rocket.points} poäng`;
        
        // Veckans Sopa - Lowest gameweek points
        const flop = leagueData.gameweekTable[leagueData.gameweekTable.length - 1];
        console.log('Flop player:', flop);
        weeklyFlopElement.textContent = `${flop.name} - ${flop.points} poäng`;
        
        // Use fallback captain and bench data if API is not available
        if (bootstrapData.players && Object.keys(bootstrapData.players).length > 0) {
            await fetchCaptainAndBenchData();
        } else {
            // Use fallback highlights
            document.getElementById('weeklyCaptain').textContent = leagueData.highlights.captain;
        }
    }
    
    console.log('About to call generateRoastMessages');
    // Generate gamified roast messages
    generateRoastMessages();
    generateBeerLevels();
    updateWallOfFameShame();
}

// Fetch captain and bench data for the current gameweek
async function fetchCaptainAndBenchData() {
    // Disabled for local development to avoid CORS issues
    console.log('API calls disabled for local development. Using mock captain and bench data');
    
    /* 
    // API calls disabled for local development due to CORS restrictions
    // Uncomment when deployed to a proper server
    try {
        const captainPromises = leagueData.gameweekTable.map(async (player) => {
            try {
                const response = await fetch(`${FPL_API_BASE}/entry/${player.managerId}/event/${currentGameweek}/picks/`);
                const data = await response.json();
                
                // Find captain (multiplier = 2)
                const captain = data.picks.find(pick => pick.multiplier === 2);
                const captainPlayer = bootstrapData.players[captain?.element];
                
                // Calculate bench points
                const benchPicks = data.picks.filter(pick => pick.position > 11);
                const benchPoints = benchPicks.reduce((total, pick) => {
                    const player = bootstrapData.players[pick.element];
                    return total + (player?.total_points || 0);
                }, 0);
                
                return {
                    name: player.name,
                    captain: captainPlayer?.name || 'Okänd',
                    captainPoints: captainPlayer?.total_points || 0,
                    benchPoints: benchPoints,
                    managerId: player.managerId
                };
            } catch (error) {
                console.error(`Error fetching picks for ${player.name}:`, error);
                return null;
            }
        });
        
        const captainData = (await Promise.all(captainPromises)).filter(Boolean);
        
        if (captainData.length > 0) {
            // Veckans Sämsta Kapten - Lowest captain points
            const worstCaptain = captainData.reduce((worst, current) => 
                current.captainPoints < worst.captainPoints ? current : worst);
            document.getElementById('weeklyCaptain').textContent = 
                `${worstCaptain.name} - ${worstCaptain.captain} (${worstCaptain.captainPoints} poäng)`;
            
            // Bäst bänk - Highest bench points
            const bestBench = captainData.reduce((best, current) => 
                current.benchPoints > best.benchPoints ? current : best);
            document.getElementById('weeklyBench').textContent = 
                `${bestBench.name} - ${bestBench.benchPoints} poäng`;
        }
        
    } catch (error) {
        console.error('Error fetching captain and bench data:', error);
    }
    */
}

// Update highlights (admin function - commented out for regular users)
function updateHighlights() {
    const rocket = document.getElementById('rocketInput').value;
    const flop = document.getElementById('flopInput').value;
    const captain = document.getElementById('captainInput').value;
    
    if (rocket) {
        leagueData.highlights.rocket = rocket;
        document.getElementById('weeklyRocket').textContent = rocket;
        document.getElementById('rocketInput').value = '';
    }
    
    if (flop) {
        leagueData.highlights.flop = flop;
        document.getElementById('weeklyFlop').textContent = flop;
        document.getElementById('flopInput').value = '';
    }
    
    if (captain) {
        leagueData.highlights.captain = captain;
        document.getElementById('weeklyCaptain').textContent = captain;
        document.getElementById('captainInput').value = '';
    }
    
    saveData();
}

// Populate player profiles
function populateProfiles() {
    console.log('=== POPULATE PROFILES ===');
    console.log('participantsData:', participantsData);
    console.log('participantsData length:', participantsData ? participantsData.length : 'UNDEFINED');
    
    const profilesGrid = document.getElementById('profilesGrid');
    console.log('profilesGrid element:', profilesGrid);
    
    if (!profilesGrid) {
        console.error('CRITICAL ERROR: profilesGrid not found!');
        return;
    }
    
    if (!participantsData || participantsData.length === 0) {
        console.error('CRITICAL ERROR: participantsData is empty!');
        profilesGrid.innerHTML = '<div style="text-align: center; padding: 2rem; color: #94a3b8;">No participants available</div>';
        return;
    }
    
    profilesGrid.innerHTML = '';
    
    participantsData.forEach((player, index) => {
        console.log(`Creating profile card ${index + 1} for player:`, player);
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        
        // Get team icon from bootstrap data or use placeholder
        const teamIcon = bootstrapData.teams && bootstrapData.teams[player.team] 
            ? `https://resources.premierleague.com/premierleague/badges/t${bootstrapData.teams[player.team]}.png`
            : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMWUyOTNiIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmaWxsPSIjMDZiNmQ0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+4p2Q8L3RleHQ+Cjwvc3ZnPg==';
        
        playerCard.innerHTML = `
            <div class="player-header">
                <img src="${player.image}" alt="${player.namn}" class="player-avatar">
                <div class="player-info">
                    <h3 title="Bästa GW någonsin: ${player.bestGameweek} poäng">
                        ${player.namn}
                        ${player.favoritlag ? `<span class="team-name">(${player.favoritlag})</span>` : ''}
                        <i class="fas fa-trophy" style="color: #f59e0b; font-size: 0.875rem;"></i>
                    </h3>
                    <p>${player.favoritlag || 'Inget favoritlag'}</p>
                </div>
            </div>
            <div class="player-stats">
                <div class="stat">
                    <span class="stat-label">Totala poäng</span>
                    <span class="stat-value">${player.totalPoäng}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Förra årets placering</span>
                    <span class="stat-value">${player.lastSeasonRank}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Bästa GW någonsin</span>
                    <span class="stat-value">${player.bestGameweek}</span>
                </div>
            </div>
            ${player.profilRoast ? `
            <div class="player-roast">
                <p>${player.profilRoast}</p>
            </div>
            ` : ''}
        `;
        profilesGrid.appendChild(playerCard);
    });
    
    console.log('Profiles populated with', participantsData.length, 'cards');
}

// Add player (admin function - commented out for regular users)
function addPlayer() {
    const name = document.getElementById('playerName').value;
    const image = document.getElementById('playerImage').value;
    const points = parseInt(document.getElementById('playerPoints').value);
    const team = document.getElementById('playerTeam').value;
    
    if (name && points >= 0 && team) {
        const newPlayer = {
            name: name,
            image: image || generateAvatarDataURL(name.charAt(0)),
            points: points,
            team: team,
            lastSeasonRank: 'N/A',
            bestGameweek: 0
        };
        
        leagueData.players.push(newPlayer);
        populateProfiles();
        saveData();
        
        // Clear form
        document.getElementById('playerName').value = '';
        document.getElementById('playerImage').value = '';
        document.getElementById('playerPoints').value = '';
        document.getElementById('playerTeam').value = '';
    }
}

// Copy league code to clipboard
function copyLeagueCode() {
    const leagueCode = document.getElementById('leagueCode').textContent;
    const copyFeedback = document.getElementById('copyFeedback');
    
    navigator.clipboard.writeText(leagueCode).then(() => {
        // Show feedback
        copyFeedback.classList.remove('hidden');
        
        // Hide feedback after 3 seconds
        setTimeout(() => {
            copyFeedback.classList.add('hidden');
        }, 3000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('Kunde inte kopiera koden. Kopiera manuellt: 46mnf2');
    });
}

// Generate gamified roast messages - API-Only Mode
function generateRoastMessages() {
    const roastGrid = document.getElementById('roastGrid');
    
    if (!roastGrid) {
        console.error('roastGrid element not found!');
        return;
    }
    
    roastGrid.innerHTML = '';
    
    // In API-only mode, we always use real data
    console.log('🔄 Generating roast messages from API data...');
    
    // Generate roasts from real data
    generateRealRoasts().then(realRoasts => {
        if (realRoasts && realRoasts.length > 0) {
            realRoasts.forEach(roast => {
                roastGrid.appendChild(createRoastCard(roast));
            });
            console.log(`✅ Displayed ${realRoasts.length} roasts from API data`);
        } else {
            // Fallback message if no roasts generated
            const fallbackCard = createRoastCard({
                type: 'fallback',
                title: 'Ingen data tillgänglig',
                message: 'Kunde inte ladda roast-data från FPL API just nu.',
                player: 'System',
                emoji: '⚠️'
            });
            roastGrid.appendChild(fallbackCard);
            console.log('⚠️ No roasts generated, showing fallback message');
        }
    }).catch(error => {
        console.error('❌ Error generating roasts:', error);
        // Show error message
        const errorCard = createRoastCard({
            type: 'error',
            title: 'API Fel',
            message: 'Kunde inte ladda roast-data från FPL API.',
            player: 'System',
            emoji: '❌'
        });
        roastGrid.appendChild(errorCard);
    });
}

// Create roast card element
function createRoastCard(roast) {
    const card = document.createElement('div');
    card.className = `roast-card ${roast.type}`;
    card.innerHTML = `
        <div class="roast-title">
            ${roast.title} <span class="roast-emoji">${roast.emoji}</span>
        </div>
        <div class="roast-message">
            ${roast.message.replace(roast.player, `<span class="roast-player">${roast.player}</span>`)}
        </div>
    `;
    return card;
}

// Generate real roasts from API data - API-Only Mode
async function generateRealRoasts() {
    console.log('=== GENERATING REAL ROASTS FROM API (API-ONLY) ===');
    
    const roasts = [];
    
    // Get all participants (should all have FPL IDs in API-only mode)
    const allParticipants = participantsData.filter(p => p.fplId && p.fplId !== null);
    
    if (allParticipants.length === 0) {
        throw new Error('No participants with FPL IDs found. Cannot generate roasts in API-only mode.');
    }
    
    console.log(`📊 Generating roasts for ${allParticipants.length} participants`);
    
    // Calculate various roast-worthy statistics
    const roastStats = [];
    
    for (const participant of allParticipants) {
        const picksData = await fetchGameweekPicks(participant.fplId, currentGameweek);
        if (picksData) {
            const gwPoints = picksData.entry_history.points;
            const captain = picksData.picks.find(pick => pick.is_captain);
            const captainPoints = captain ? captain.points * captain.multiplier : 0;
            const benchPoints = picksData.picks.filter(pick => pick.position > 11).reduce((sum, pick) => sum + (pick.multiplier > 0 ? pick.points : 0), 0);
            const transfers = picksData.entry_history.event_transfers;
            const transferCost = picksData.entry_history.event_transfers_cost;
            
            roastStats.push({
                participant,
                gwPoints,
                captainPoints,
                benchPoints,
                transfers,
                transferCost
            });
        } else {
            console.log(`⚠️ No gameweek data for ${participant.namn} (GW${currentGameweek})`);
        }
    }
    
    // Generate roasts based on real data
    if (roastStats.length > 0) {
        // Worst gameweek performance
        const worstPlayer = roastStats.reduce((worst, current) => 
            current.gwPoints < worst.gwPoints ? current : worst
        );
        
        roasts.push({
            type: 'sopa',
            title: 'Veckans Sopa',
            message: `${worstPlayer.participant.namn} fick bara ${worstPlayer.gwPoints} poäng den här veckan. Pinsamt.`,
            player: worstPlayer.participant.namn,
            emoji: '🍺🚫'
        });
        
        // Worst captain choice
        const worstCaptain = roastStats.reduce((worst, current) => 
            current.captainPoints < worst.captainPoints ? current : worst
        );
        
        if (worstCaptain.captainPoints < 4) {
            roasts.push({
                type: 'captain',
                title: 'Kaptenmiss',
                message: `${worstCaptain.participant.namn} kapten fick bara ${worstCaptain.captainPoints} poäng. Kaptenkaos!`,
                player: worstCaptain.participant.namn,
                emoji: '❗'
            });
        }
        
        // Most transfers (wasteful)
        const transferHappy = roastStats.reduce((most, current) => 
            current.transfers > most.transfers ? current : most
        );
        
        if (transferHappy.transfers > 2) {
            roasts.push({
                type: 'transfers',
                title: 'Transfer Happy',
                message: `${transferHappy.participant.namn} gjorde ${transferHappy.transfers} transfers (-${transferHappy.transferCost} poäng). Trigger happy!`,
                player: transferHappy.participant.namn,
                emoji: '🔄'
            });
        }
        
        // Best bench points (if significant)
        const bestBench = roastStats.reduce((best, current) => 
            current.benchPoints > best.benchPoints ? current : best
        );
        
        if (bestBench.benchPoints > 10) {
            roasts.push({
                type: 'bench',
                title: 'Skön bänk kungen 🙄',
                message: `${bestBench.participant.namn} hade ${bestBench.benchPoints}p på bänken. Bästa bänken någonsin!`,
                player: bestBench.participant.namn,
                emoji: '🔥'
            });
        }
    }
    
    console.log(`✅ Generated ${roasts.length} roasts from API data`);
    return roasts;
}

// Toggle roast expansion
function toggleRoasts() {
    console.log('toggleRoasts called, roastsExpanded:', roastsExpanded);
    const roastGrid = document.getElementById('roastGrid');
    const expandBtn = document.getElementById('expandRoastsBtn');
    
    if (!roastGrid || !expandBtn) {
        console.error('Required elements not found for toggleRoasts');
        return;
    }
    
    const remainingRoasts = JSON.parse(roastGrid.dataset.remainingRoasts || '[]');
    console.log('remainingRoasts:', remainingRoasts);
    
    if (!roastsExpanded && remainingRoasts.length > 0) {
        // Expand
        console.log('Expanding roasts...');
        remainingRoasts.forEach(roast => {
            roastGrid.appendChild(createRoastCard(roast));
        });
        expandBtn.innerHTML = '<i class="fas fa-chevron-up"></i><span>Visa färre</span>';
        expandBtn.classList.add('expanded');
        roastsExpanded = true;
    } else {
        // Collapse
        console.log('Collapsing roasts...');
        const cards = roastGrid.querySelectorAll('.roast-card');
        for (let i = 3; i < cards.length; i++) {
            cards[i].remove();
        }
        expandBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>Visa fler horribla insatser</span>';
        expandBtn.classList.remove('expanded');
        roastsExpanded = false;
    }
}

// Generate beer levels
function generateBeerLevels() {
    const beerGrid = document.getElementById('beerGrid');
    beerGrid.innerHTML = '';
    
    // Check if we have real data or should use mock data
    const useMockData = !bootstrapData.players || Object.keys(bootstrapData.players).length === 0;
    
    if (useMockData) {
        // Use mock beer data
        const mockBeerLevels = [
            {
                level: '🟢',
                message: 'Du förtjänar en iskall öl!',
                player: 'Melvin Yuksel',
                type: 'green'
            },
            {
                level: '🟡',
                message: 'Du förtjänar... en alkoholfri.',
                player: 'Jakob Gårlin',
                type: 'yellow'
            },
            {
                level: '🔴',
                message: 'Du förtjänar inte en öl denna vecka.',
                player: 'Johan Pauly',
                type: 'red'
            }
        ];
        
        mockBeerLevels.forEach(beer => {
            beerGrid.appendChild(createBeerCard(beer));
        });
    } else {
        // Generate beer levels from real data
        const realBeerLevels = generateRealBeerLevels();
        realBeerLevels.forEach(beer => {
            beerGrid.appendChild(createBeerCard(beer));
        });
    }
}

// Create beer card element
function createBeerCard(beer) {
    const card = document.createElement('div');
    card.className = `beer-card ${beer.type}`;
    card.innerHTML = `
        <div class="beer-level">${beer.level}</div>
        <div class="beer-message">${beer.message}</div>
        <div class="beer-player">${beer.player}</div>
    `;
    return card;
}

// Generate real beer levels from API data
function generateRealBeerLevels() {
    const beerLevels = [];
    
    if (leagueData.gameweekTable.length > 0) {
        // Top performer gets green
        const topPlayer = leagueData.gameweekTable[0];
        beerLevels.push({
            level: '🟢',
            message: 'Du förtjänar en iskall öl!',
            player: topPlayer.name,
            type: 'green'
        });
        
        // Middle performer gets yellow
        const middleIndex = Math.floor(leagueData.gameweekTable.length / 2);
        const middlePlayer = leagueData.gameweekTable[middleIndex];
        beerLevels.push({
            level: '🟡',
            message: 'Du förtjänar... en alkoholfri.',
            player: middlePlayer.name,
            type: 'yellow'
        });
        
        // Worst performer gets red
        const worstPlayer = leagueData.gameweekTable[leagueData.gameweekTable.length - 1];
        beerLevels.push({
            level: '🔴',
            message: 'Du förtjänar inte en öl denna vecka.',
            player: worstPlayer.name,
            type: 'red'
        });
    }
    
    return beerLevels;
}

// Update wall of fame/shame
function updateWallOfFameShame() {
    const fameStats = document.getElementById('fameStats');
    const shameStats = document.getElementById('shameStats');
    
    // Check if we have real data or should use mock data
    const useMockData = !bootstrapData.players || Object.keys(bootstrapData.players).length === 0;
    
    if (useMockData) {
        // Use mock wall data
        fameStats.innerHTML = `
            <div class="wall-stat">
                <span class="wall-stat-label">Veckans Raket</span>
                <span class="wall-stat-value">Melvin Yuksel (3)</span>
            </div>
            <div class="wall-stat">
                <span class="wall-stat-label">Bästa GW någonsin</span>
                <span class="wall-stat-value">98p - Melvin Yuksel</span>
            </div>
            <div class="wall-stat">
                                        <span class="wall-stat-label">Flest flaskor bubbel</span>
                <span class="wall-stat-value">Julius Höglund</span>
            </div>
        `;
        
        shameStats.innerHTML = `
            <div class="wall-stat">
                <span class="wall-stat-label">Veckans Sopa</span>
                <span class="wall-stat-value">Johan Pauly (5)</span>
            </div>
            <div class="wall-stat">
                <span class="wall-stat-label">Sämsta Kapten</span>
                <span class="wall-stat-value">Erik Rotsenius (4)</span>
            </div>
            <div class="wall-stat">
                <span class="wall-stat-label">Mest Minuspoäng</span>
                <span class="wall-stat-value">Sigge Carlsson (-16p)</span>
            </div>
        `;
    } else {
        // Generate real wall data
        const fameData = generateRealFameStats();
        const shameData = generateRealShameStats();
        
        fameStats.innerHTML = fameData;
        shameStats.innerHTML = shameData;
    }
}

// Generate real fame stats
function generateRealFameStats() {
    // Count gameweeks over 100 points for each participant
    const participantStats = participantsData.map(participant => {
        // For mock data, generate random number of 100+ point gameweeks
        const highScoreWeeks = Math.floor(Math.random() * 8) + 1; // 1-8 weeks
        return {
            name: participant.namn,
            highScoreWeeks: highScoreWeeks
        };
    });
    
    // Find participant with most 100+ point gameweeks
    const mostBubbles = participantStats.reduce((max, current) => 
        current.highScoreWeeks > max.highScoreWeeks ? current : max);
    
    return `
        <div class="wall-stat">
            <span class="wall-stat-label">Veckans Raket</span>
            <span class="wall-stat-value">${leagueData.gameweekTable[0]?.name || 'N/A'} (1)</span>
        </div>
        <div class="wall-stat">
            <span class="wall-stat-label">Flest flaskor bubbel</span>
            <span class="wall-stat-value">${mostBubbles.name} (${mostBubbles.highScoreWeeks})</span>
        </div>
    `;
}

// Generate real shame stats
function generateRealShameStats() {
    // Placeholder for real shame stats
    return `
        <div class="wall-stat">
            <span class="wall-stat-label">Veckans Sopa</span>
            <span class="wall-stat-value">${leagueData.gameweekTable[leagueData.gameweekTable.length - 1]?.name || 'N/A'} (1)</span>
        </div>
    `;
}

// Auto-refresh data every 5 minutes (optional)
setInterval(() => {
    // Refresh data periodically
    console.log('Auto-refresh not implemented yet');
}, 300000);

// Export functions to window for global access
window.checkPassword = checkPassword;
window.showSection = showSection;
window.showTable = showTable;
window.logout = logout;
window.copyLeagueCode = copyLeagueCode;
window.toggleRoasts = toggleRoasts;

window.showAdminPasswordPrompt = showAdminPasswordPrompt;
window.hideAdminPanel = hideAdminPanel;
window.updateParticipantField = updateParticipantField;
window.saveParticipantChanges = saveParticipantChanges;
window.deleteParticipant = deleteParticipant;
window.showAddParticipantForm = showAddParticipantForm;
window.hideAddParticipantForm = hideAddParticipantForm;
window.addNewParticipant = addNewParticipant;
window.exportParticipantsData = exportParticipantsData;
window.saveToLocalStorage = saveToLocalStorage;
window.showPrizeTotalInput = showPrizeTotalInput;
window.hidePrizeTotalInput = hidePrizeTotalInput;
window.hideAdminPrizeInput = hideAdminPrizeInput;
window.updatePrizeTotal = updatePrizeTotal;





console.log('=== SCRIPT.JS LOADED COMPLETELY ===');

// Add a simple global test function that should always be available
window.testScriptLoaded = function() {
    console.log('Script is loaded!');
    console.log('ADMIN_PASSWORD:', ADMIN_PASSWORD);
    console.log('participantsData length:', participantsData.length);
    return 'Script loaded successfully';
};

// Add direct admin access that doesn't rely on function exports
window.adminLogin = function() {
    console.log('Direct admin login attempt');
    const password = prompt('Ange adminlösenord:');
    if (password === 'Pepsie10') {
        console.log('Admin login successful');
        // Try to show admin panel directly
        const adminModal = document.getElementById('adminModal');
        if (adminModal) {
            adminModal.classList.add('show');
            console.log('Admin panel should now be visible');
        } else {
            console.error('Admin modal not found');
        }
    } else {
        console.log('Admin login failed');
        alert('Felaktigt lösenord!');
    }
};