// Strava OAuth Configuration
const CLIENT_ID = '186241';
// Update this URL after deploying to GitHub Pages
const REDIRECT_URI = 'https://adventurous-sloth.github.io/strava-kudos-2025/callback.html';

// Utility: Generate random string for PKCE
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

// Utility: Create SHA256 hash for PKCE challenge
async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64urlencode(hash);
}

// Utility: Base64 URL encode
function base64urlencode(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = '';
    bytes.forEach(byte => str += String.fromCharCode(byte));
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Start OAuth Flow (called from index.html)
async function startOAuth() {
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await sha256(codeVerifier);
    
    // Store verifier for later use in callback
    sessionStorage.setItem('code_verifier', codeVerifier);
    
    // Redirect to Strava authorization
    const authUrl = `https://www.strava.com/oauth/authorize?` +
        `client_id=${CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `approval_prompt=auto&` +
        `scope=activity:read_all&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=S256`;
    
    window.location.href = authUrl;
}

// Handle OAuth Callback (called from callback.html)
async function handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
        alert('Authorization failed: ' + error);
        window.location.href = 'index.html';
        return;
    }
    
    if (!code) {
        alert('No authorization code received');
        window.location.href = 'index.html';
        return;
    }
    
    const codeVerifier = sessionStorage.getItem('code_verifier');
    if (!codeVerifier) {
        alert('Missing code verifier - please try again');
        window.location.href = 'index.html';
        return;
    }
    
    try {
        // Exchange code for access token using PKCE
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                code: code,
                code_verifier: codeVerifier,
                grant_type: 'authorization_code'
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Token exchange failed');
        }
        
        // Store access token and athlete info
        sessionStorage.setItem('access_token', data.access_token);
        sessionStorage.setItem('athlete_name', `${data.athlete.firstname} ${data.athlete.lastname}`);
        
        // Clear code verifier
        sessionStorage.removeItem('code_verifier');
        
        // Redirect to review page
        window.location.href = 'review.html';
        
    } catch (error) {
        console.error('Error during token exchange:', error);
        alert('Failed to connect to Strava: ' + error.message);
        window.location.href = 'index.html';
    }
}

// Load Kudos Data (called from review.html)
async function loadKudosData() {
    const accessToken = sessionStorage.getItem('access_token');
    const athleteName = sessionStorage.getItem('athlete_name');
    
    if (!accessToken) {
        window.location.href = 'index.html';
        return;
    }
    
    // Display athlete name
    document.getElementById('athlete-name').textContent = athleteName;
    
    try {
        // Fetch activities from 2025
        const after = Math.floor(new Date('2025-01-01').getTime() / 1000);
        const before = Math.floor(new Date('2025-12-31T23:59:59').getTime() / 1000);
        
        const activitiesResponse = await fetch(
            `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=200`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );
        
        if (!activitiesResponse.ok) {
            throw new Error('Failed to fetch activities');
        }
        
        const activities = await activitiesResponse.json();
        
        // Check if user has too many activities
        if (activities.length === 200) {
            // Check if there's more
            const checkPage2 = await fetch(
                `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=1&page=2`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );
            const page2Data = await checkPage2.json();
            
            if (page2Data.length > 0) {
                showError('You have more than 199 activities in 2025. Unfortunately, this would exceed Strava\'s rate limits. Try again later in the year!');
                return;
            }
        }
        
        // Collect all kudos
        const kudosCounter = {};
        
        for (const activity of activities) {
            const kudosResponse = await fetch(
                `https://www.strava.com/api/v3/activities/${activity.id}/kudos`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );
            
            if (!kudosResponse.ok) {
                console.error(`Failed to fetch kudos for activity ${activity.id}`);
                continue;
            }
            
            const kudoers = await kudosResponse.json();
            
            for (const person of kudoers) {
                const name = `${person.firstname} ${person.lastname}`;
                kudosCounter[name] = (kudosCounter[name] || 0) + 1;
            }
        }
        
        // Sort by kudos count and get top 30
        const sortedKudos = Object.entries(kudosCounter)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30);
        
        const labels = sortedKudos.map(([name, _]) => name);
        const data = sortedKudos.map(([_, count]) => count);
        const totalKudos = Object.values(kudosCounter).reduce((sum, count) => sum + count, 0);
        
        // Display results
        displayResults(labels, data, activities.length, totalKudos);
        
    } catch (error) {
        console.error('Error loading kudos data:', error);
        showError('Error loading data: ' + error.message);
    }
}

// Display Results with Chart
function displayResults(labels, data, totalActivities, totalKudos) {
    // Hide loading, show results
    document.getElementById('loading').style.display = 'none';
    document.getElementById('results').style.display = 'block';
    
    // Update stats
    document.getElementById('total-activities').textContent = totalActivities;
    document.getElementById('total-kudos').textContent = totalKudos;
    
    // Create chart
    const ctx = document.getElementById('kudos-chart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Kudos Given',
                data: data,
                backgroundColor: '#667eea',
                borderColor: '#667eea',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Top Kudos Givers in 2025',
                    font: {
                        size: 18,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Show Error Message
function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.querySelector('.error-message').textContent = message;
}

// Set up Connect button on index page
if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
    window.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('connect-btn');
        if (btn) {
            btn.addEventListener('click', startOAuth);
        }
    });
}
