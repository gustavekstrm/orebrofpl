// Configuration
console.log('=== SCRIPT.JS LOADING ===');
const CORRECT_PASSWORD = 'fantasyorebro';
const ADMIN_PASSWORD = 'Pepsie10';
const FPL_API_BASE = 'https://fantasy.premierleague.com/api';
const LEAGUE_CODE = '46mnf2';

// Global flag to disable API calls for local development
const DISABLE_API_CALLS = false; // Set to false when deployed to a proper server

// Global data storage
let isLoggedIn = false;
let isAdminAuthenticated = false;
let currentGameweek = 38;
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
        favoritlag: 'Manchester United',
        fplId: 123456, // Sample FPL ID for testing
        profilRoast: 'Har haft fler minuspoäng än rena lakan den här säsongen.',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 12,
        bestGameweek: 98
    },
    {
        namn: 'Jakob Gårlin',
        totalPoäng: 2412,
        favoritlag: 'Liverpool',
        fplId: 234567, // Sample FPL ID for testing
        profilRoast: 'Enda som är sämre än din kaptensval är din senaste bortamatch.',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 8,
        bestGameweek: 87
    },
    {
        namn: 'Joel Segerlind',
        totalPoäng: 2389,
        favoritlag: 'Arsenal',
        fplId: null,
        profilRoast: 'Din transferstrategi liknar en blindfolded dart game.',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 15,
        bestGameweek: 92
    },
    {
        namn: 'Viggo Svedin',
        totalPoäng: 2356,
        favoritlag: 'Chelsea',
        fplId: null,
        profilRoast: 'Bench boost på GW1? Bara du som kan komma på det.',
        image: generateAvatarDataURL('V'),
        lastSeasonRank: 22,
        bestGameweek: 85
    },
    {
        namn: 'Julius Höglund',
        totalPoäng: 2321,
        favoritlag: 'Manchester City',
        fplId: null,
        profilRoast: 'Flest flaskor bubbel - förutom när det gäller kaptensval.',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 5,
        bestGameweek: 89
    },
    {
        namn: 'Erik Rotsenius',
        totalPoäng: 2289,
        favoritlag: 'Tottenham',
        fplId: null,
        profilRoast: 'Kaptenkaos är ditt mellannamn.',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 18,
        bestGameweek: 76
    },
    {
        namn: 'William Kuyumcu',
        totalPoäng: 2256,
        favoritlag: 'Newcastle',
        fplId: null,
        profilRoast: 'Bench Boost Fuskare deluxe edition.',
        image: generateAvatarDataURL('W'),
        lastSeasonRank: 25,
        bestGameweek: 82
    },
    {
        namn: 'Axel Ekström',
        totalPoäng: 2223,
        favoritlag: 'Aston Villa',
        fplId: null,
        profilRoast: 'Trigger Happy - mer transfers än poäng.',
        image: generateAvatarDataURL('A'),
        lastSeasonRank: 30,
        bestGameweek: 79
    },
    {
        namn: 'Gustav Ekström',
        totalPoäng: 2189,
        favoritlag: 'Brighton',
        fplId: null,
        profilRoast: 'Bench God - men bara när du inte använder Bench Boost.',
        image: generateAvatarDataURL('G'),
        lastSeasonRank: 28,
        bestGameweek: 75
    },
    {
        namn: 'Sigge Carlsson',
        totalPoäng: 2156,
        favoritlag: 'West Ham',
        fplId: null,
        profilRoast: 'Mest minuspoäng i ligan - grattis!',
        image: generateAvatarDataURL('S'),
        lastSeasonRank: 32,
        bestGameweek: 71
    },
    {
        namn: 'Johan Pauly',
        totalPoäng: 2123,
        favoritlag: 'Crystal Palace',
        fplId: null,
        profilRoast: 'Veckans Sopa - en titel du verkligen förtjänar.',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 35,
        bestGameweek: 68
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
        console.log('Fetching bootstrap data from FPL API...');
        const response = await fetch(`${FPL_API_BASE}/bootstrap-static/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        bootstrapData = data;
        console.log('Bootstrap data fetched successfully:', data);
        return data;
    } catch (error) {
        console.error('Error fetching bootstrap data:', error);
        return null;
    }
}

async function fetchPlayerData(fplId) {
    try {
        console.log(`Fetching player data for FPL ID: ${fplId}`);
        
        // Fetch current season data
        const currentResponse = await fetch(`${FPL_API_BASE}/entry/${fplId}/`);
        if (!currentResponse.ok) {
            throw new Error(`HTTP error! status: ${currentResponse.status}`);
        }
        const currentData = await currentResponse.json();
        
        // Fetch historical data
        const historyResponse = await fetch(`${FPL_API_BASE}/entry/${fplId}/history/`);
        if (!historyResponse.ok) {
            throw new Error(`HTTP error! status: ${historyResponse.status}`);
        }
        const historyData = await historyResponse.json();
        
        console.log(`Player data fetched for FPL ID ${fplId}:`, { currentData, historyData });
        return { currentData, historyData };
    } catch (error) {
        console.error(`Error fetching player data for FPL ID ${fplId}:`, error);
        return null;
    }
}

async function fetchGameweekPicks(fplId, gameweek) {
    try {
        console.log(`Fetching GW${gameweek} picks for FPL ID: ${fplId}`);
        const response = await fetch(`${FPL_API_BASE}/entry/${fplId}/event/${gameweek}/picks/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log(`GW${gameweek} picks fetched for FPL ID ${fplId}:`, data);
        return data;
    } catch (error) {
        console.error(`Error fetching GW${gameweek} picks for FPL ID ${fplId}:`, error);
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

// Function to update participantsData with real FPL data
async function updateParticipantsWithFPLData() {
    console.log('=== UPDATING PARTICIPANTS WITH FPL DATA ===');
    
    // First, fetch bootstrap data to get current gameweek
    const bootstrapData = await fetchBootstrapData();
    if (bootstrapData) {
        currentGameweek = bootstrapData.events.find(event => event.finished === false)?.id || 38;
        console.log('Current gameweek determined:', currentGameweek);
    }
    
    // Update each participant that has an FPL ID
    for (let i = 0; i < participantsData.length; i++) {
        const participant = participantsData[i];
        
        if (participant.fplId && participant.fplId !== null) {
            console.log(`Updating participant ${participant.namn} with FPL ID ${participant.fplId}`);
            
            const playerData = await fetchPlayerData(participant.fplId);
            if (playerData) {
                const { currentData, historyData } = playerData;
                
                // Update with real data
                participantsData[i] = {
                    ...participant, // Keep existing data (roasts, image, etc.)
                    namn: currentData.player_first_name + ' ' + currentData.player_last_name,
                    totalPoäng: currentData.summary_overall_points,
                    lastSeasonRank: historyData.past?.find(past => past.season_name === '2023/24')?.rank || participant.lastSeasonRank,
                    bestGameweek: Math.max(...historyData.current.map(gw => gw.points), 0)
                };
                
                console.log(`Updated ${participant.namn} with real data:`, participantsData[i]);
            }
        } else {
            console.log(`Participant ${participant.namn} has no FPL ID, keeping mock data`);
        }
    }
    
    // Save updated data to localStorage
    localStorage.setItem('fplParticipantsData', JSON.stringify(participantsData));
    console.log('Participants data updated and saved to localStorage');
}

// Function to calculate weekly highlights from real FPL data
async function calculateWeeklyHighlightsFromAPI() {
    console.log('=== CALCULATING WEEKLY HIGHLIGHTS FROM API ===');
    
    if (!bootstrapData || !bootstrapData.events) {
        console.log('No bootstrap data available, using fallback highlights');
        return;
    }
    
    const currentGW = currentGameweek;
    console.log(`Calculating highlights for GW${currentGW}`);
    
    const gwHighlights = {
        rocket: { player: null, points: 0 },
        flop: { player: null, points: 999 },
        captain: { player: null, captain: '', points: 0 },
        bench: { player: null, points: 0 }
    };
    
    // Get all participants with FPL IDs
    const participantsWithFPL = participantsData.filter(p => p.fplId && p.fplId !== null);
    
    for (const participant of participantsWithFPL) {
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
        }
    }
    
    // Update league data with calculated highlights
    leagueData.highlights = {
        rocket: gwHighlights.rocket.player ? `${gwHighlights.rocket.player.namn} - ${gwHighlights.rocket.points} poäng` : '',
        flop: gwHighlights.flop.player ? `${gwHighlights.flop.player.namn} - ${gwHighlights.flop.points} poäng` : '',
        captain: gwHighlights.captain.player ? `${gwHighlights.captain.player.namn} - ${gwHighlights.captain.captain} (${gwHighlights.captain.points} poäng)` : '',
        bench: gwHighlights.bench.player ? `${gwHighlights.bench.player.namn} - ${gwHighlights.bench.points} poäng` : ''
    };
    
    console.log('Weekly highlights calculated from API:', leagueData.highlights);
}

// Initialize FPL data
async function initializeFPLData() {
    if (DISABLE_API_CALLS) {
        console.log('API calls disabled, using fallback data');
        useFallbackData();
        return;
    }
    
    console.log('=== INITIALIZING FPL DATA ===');
    
    try {
        // Try to fetch real data from FPL API
        console.log('Attempting to fetch real data from FPL API...');
        
        // Update participants with real FPL data
        await updateParticipantsWithFPLData();
        
        // Calculate weekly highlights from real data
        await calculateWeeklyHighlightsFromAPI();
        
        // Generate league tables from real data
        await generateLeagueTablesFromAPI();
        
        console.log('FPL API data loaded successfully');
        
        // Populate UI with real data
        setTimeout(() => {
            populateTables();
            populateProfiles();
            updateHighlightsFromData();
        }, 100);
        
    } catch (error) {
        console.error('Error loading FPL API data, falling back to mock data:', error);
        useFallbackData();
    }
}

// Function to generate league tables from API data
async function generateLeagueTablesFromAPI() {
    console.log('=== GENERATING LEAGUE TABLES FROM API ===');
    
    if (!bootstrapData || !bootstrapData.events) {
        console.log('No bootstrap data available, using fallback tables');
        return;
    }
    
    // Get all participants with FPL IDs
    const participantsWithFPL = participantsData.filter(p => p.fplId && p.fplId !== null);
    
    // Generate season table from real data
    leagueData.seasonTable = participantsWithFPL
        .map(participant => ({
            position: 0, // Will be calculated after sorting
            name: participant.namn,
            points: participant.totalPoäng,
            gameweek: currentGameweek,
            managerId: participant.fplId
        }))
        .sort((a, b) => b.points - a.points)
        .map((player, index) => ({ ...player, position: index + 1 }));
    
    // Generate gameweek table from real data (if we have current GW data)
    if (currentGameweek > 0) {
        const gwData = [];
        for (const participant of participantsWithFPL) {
            const picksData = await fetchGameweekPicks(participant.fplId, currentGameweek);
            if (picksData) {
                gwData.push({
                    position: 0, // Will be calculated after sorting
                    name: participant.namn,
                    points: picksData.entry_history.points,
                    gameweek: currentGameweek,
                    managerId: participant.fplId
                });
            }
        }
        
        leagueData.gameweekTable = gwData
            .sort((a, b) => b.points - a.points)
            .map((player, index) => ({ ...player, position: index + 1 }));
    }
    
    console.log('League tables generated from API:', {
        seasonTable: leagueData.seasonTable,
        gameweekTable: leagueData.gameweekTable
    });
}

// Use fallback data when API is not available
function useFallbackData() {
    console.log('=== USING FALLBACK DATA ===');
    
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
            gameweek: 38,
            managerId: participant.fplId || (123456 + index) // Fallback ID if no FPL ID
        })),
        gameweekTable: participantsData.map((participant, index) => ({
            position: index + 1,
            name: participant.namn,
            points: Math.floor(Math.random() * 50) + 45, // Mock gameweek points
            gameweek: 38,
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
    
    // Set current gameweek
    currentGameweek = 38;
    
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

// Fetch bootstrap data (teams, players, events)
async function fetchBootstrapData() {
    try {
        const response = await fetch(`${FPL_API_BASE}/bootstrap-static/`);
        const data = await response.json();
        
        // Cache teams
        bootstrapData.teams = {};
        data.teams.forEach(team => {
            bootstrapData.teams[team.id] = {
                name: team.name,
                short_name: team.short_name,
                logo: team.code
            };
        });
        
        // Cache players
        bootstrapData.players = {};
        data.elements.forEach(player => {
            bootstrapData.players[player.id] = {
                name: player.web_name,
                total_points: player.total_points,
                team: player.team
            };
        });
        
        // Cache events
        bootstrapData.events = data.events;
        
        // Determine current gameweek
        const currentEvent = data.events.find(event => event.is_current);
        currentGameweek = currentEvent ? currentEvent.id : 1;
        
    } catch (error) {
        console.error('Error fetching bootstrap data:', error);
        throw error;
    }
}

// Fetch league data
async function fetchLeagueData() {
    try {
        const response = await fetch(`${FPL_API_BASE}/leagues-classic/${LEAGUE_CODE}/standings/`);
        const data = await response.json();
        
        // Process standings
        leagueData.seasonTable = data.standings.results.map((entry, index) => ({
            position: index + 1,
            name: entry.player_name,
            points: entry.total,
            gameweek: currentGameweek,
            managerId: entry.entry
        }));
        
        // Fetch manager history for each player
        for (let player of leagueData.seasonTable) {
            await fetchManagerHistory(player);
        }
        
        // Calculate gameweek scores
        calculateGameweekScores();
        
        // Update player profiles
        updatePlayerProfiles();
        
    } catch (error) {
        console.error('Error fetching league data:', error);
        throw error;
    }
}

// Fetch manager history
async function fetchManagerHistory(player) {
    try {
        const response = await fetch(`${FPL_API_BASE}/entry/${player.managerId}/history/`);
        const data = await response.json();
        
        // Extract gameweek points
        player.gameweekPoints = data.current.map(gw => gw.points);
        
        // Get last season rank
        player.lastSeasonRank = data.past.find(p => p.season_name === '2023/24')?.rank || 'N/A';
        
        // Get best gameweek
        const bestGW = data.current.reduce((best, current) => 
            current.points > best.points ? current : best);
        player.bestGameweek = bestGW.points;
        
    } catch (error) {
        console.error(`Error fetching history for ${player.name}:`, error);
    }
}

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
    const tbody = document.getElementById('gameweekTableBody');
    tbody.innerHTML = '';
    
    leagueData.gameweekTable.forEach(player => {
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
    const useMockData = !bootstrapData.players || Object.keys(bootstrapData.players).length === 0;
    
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
    console.log('leagueData.players:', leagueData.players);
    console.log('leagueData.players length:', leagueData.players ? leagueData.players.length : 'UNDEFINED');
    
    const profilesGrid = document.getElementById('profilesGrid');
    console.log('profilesGrid element:', profilesGrid);
    
    if (!profilesGrid) {
        console.error('CRITICAL ERROR: profilesGrid not found!');
        return;
    }
    
    if (!leagueData.players || leagueData.players.length === 0) {
        console.error('CRITICAL ERROR: leagueData.players is empty!');
        profilesGrid.innerHTML = '<div style="text-align: center; padding: 2rem; color: #94a3b8;">No participants available</div>';
        return;
    }
    
    profilesGrid.innerHTML = '';
    
    leagueData.players.forEach((player, index) => {
        console.log(`Creating profile card ${index + 1} for player:`, player);
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        
        // Get team icon from bootstrap data or use placeholder
        const teamIcon = bootstrapData.teams && bootstrapData.teams[player.team] 
            ? `https://resources.premierleague.com/premierleague/badges/t${bootstrapData.teams[player.team]}.png`
            : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMWUyOTNiIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmaWxsPSIjMDZiNmQ0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+4p2Q8L3RleHQ+Cjwvc3ZnPg==';
        
        playerCard.innerHTML = `
            <div class="player-header">
                <img src="${player.image}" alt="${player.name}" class="player-avatar">
                <div class="player-info">
                    <h3 title="Bästa GW någonsin: ${player.bestGameweek} poäng">
                        ${player.name}
                        <img src="${teamIcon}" alt="${player.team}" class="team-icon" />
                        <i class="fas fa-trophy" style="color: #f59e0b; font-size: 0.875rem;"></i>
                    </h3>
                    <p>${player.team}</p>
                </div>
            </div>
            <div class="player-stats">
                <div class="stat">
                    <span class="stat-label">Totala poäng</span>
                    <span class="stat-value">${player.points}</span>
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
    
    console.log('Profiles populated with', leagueData.players.length, 'cards');
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

// Generate gamified roast messages
function generateRoastMessages() {
    const roastGrid = document.getElementById('roastGrid');
    
    if (!roastGrid) {
        console.error('roastGrid element not found!');
        return;
    }
    
    roastGrid.innerHTML = '';
    
    // Check if we have real data or should use mock data
    const useMockData = !bootstrapData.players || Object.keys(bootstrapData.players).length === 0;
    
    if (useMockData) {
        
        // Function to get random participants for roasts
        function getRandomParticipants(count) {
            const shuffled = [...participantsData].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, count);
        }
        
        // Get random participants for different roast categories
        const randomParticipants = getRandomParticipants(5);
        
        // Use mock roast data with random participants (removed duplicates)
        const mockRoasts = [
            {
                type: 'bench-boost',
                title: 'Bench Boost Fuskare',
                message: `${randomParticipants[0]?.namn || 'William Kuyumcu'} aktiverade Bench Boost och fick 4 poäng från bänken. Pinsamt.`,
                player: randomParticipants[0]?.namn || 'William Kuyumcu',
                emoji: '🤡'
            },
            {
                type: 'minus',
                title: 'Mest Minuspoäng',
                message: `${randomParticipants[1]?.namn || 'Sigge Carlsson'} tog -16 i minuspoäng. Snälla radera appen.`,
                player: randomParticipants[1]?.namn || 'Sigge Carlsson',
                emoji: '🗑️'
            },
            {
                type: 'bench-explosion',
                title: 'Skön bänk kungen 🙄',
                message: `${randomParticipants[2]?.namn || 'Gustav Ekström'} hade 22p på bänken. Bästa bänken någonsin!`,
                player: randomParticipants[2]?.namn || 'Gustav Ekström',
                emoji: '🔥'
            }
        ];
        
        // Show all 3 roasts (no expansion needed)
        mockRoasts.forEach(roast => {
            const card = createRoastCard(roast);
            roastGrid.appendChild(card);
        });
        
        // No remaining roasts for expansion
        roastGrid.dataset.remainingRoasts = JSON.stringify([]);
    } else {
        console.log('Using real roast data');
        // Generate roasts from real data
        generateRealRoasts().then(realRoasts => {
            realRoasts.forEach(roast => {
                roastGrid.appendChild(createRoastCard(roast));
            });
        });
    }
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

// Generate real roasts from API data
async function generateRealRoasts() {
    const roasts = [];
    
    // Get participants with FPL IDs
    const participantsWithFPL = participantsData.filter(p => p.fplId && p.fplId !== null);
    
    if (participantsWithFPL.length === 0) {
        console.log('No participants with FPL IDs, using mock roasts');
        return [];
    }
    
    // Calculate various roast-worthy statistics
    const roastStats = [];
    
    for (const participant of participantsWithFPL) {
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
    }
    
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