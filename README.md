# Strava Kudos 2025 - Client-Side App

A pure client-side web app to see who gave you the most kudos on Strava in 2025!

## Features
- 🔐 Secure OAuth with PKCE (no server needed!)
- 📊 Beautiful horizontal bar chart visualization
- 🎨 Purple gradient design
- 🆓 Completely free hosting on GitHub Pages
- 📱 Mobile responsive

## Deployment to GitHub Pages

### Step 1: Create a new branch for GitHub Pages

```bash
cd ~/Coding/strava-kudos-2025
git checkout -b gh-pages
```

### Step 2: Remove old files and add new ones

```bash
# Remove Python files (we don't need them anymore)
git rm app.py requirements.txt Procfile
git rm -r templates

# Copy the new HTML/JS/CSS files to the repo root
# (You'll do this in the next step)
```

### Step 3: Copy files from ~/strava-kudos-2025 directory

Copy these files to your repo:
- index.html
- callback.html
- review.html
- app.js
- styles.css

### Step 4: Update the REDIRECT_URI in app.js

Open `app.js` and change line 3 to:
```javascript
const REDIRECT_URI = 'https://adventurous-sloth.github.io/strava-kudos-2025/callback.html';
```

### Step 5: Commit and push

```bash
git add .
git commit -m "Convert to client-side app for GitHub Pages"
git push origin gh-pages
```

### Step 6: Enable GitHub Pages

1. Go to your GitHub repo: https://github.com/adventurous-sloth/strava-kudos-2025
2. Click **Settings** → **Pages** (in left sidebar)
3. Under "Source", select **Branch: gh-pages** → **/ (root)**
4. Click **Save**
5. Wait 1-2 minutes for deployment

Your site will be live at: **https://adventurous-sloth.github.io/strava-kudos-2025/**

### Step 7: Update Strava App Settings

1. Go to https://www.strava.com/settings/api
2. Update:
   - **Website**: `https://adventurous-sloth.github.io/strava-kudos-2025`
   - **Authorization Callback Domain**: `adventurous-sloth.github.io`
3. Click "Update"

### Step 8: Test it!

Visit https://adventurous-sloth.github.io/strava-kudos-2025 and click "Connect with Strava"!

## How It Works

- **No backend server** - Everything runs in your browser
- **PKCE OAuth** - Secure authentication without client secrets
- **Direct API calls** - Your browser talks directly to Strava's API
- **Session storage** - Access token stored temporarily in browser
- **GitHub Pages** - Free, fast, and reliable static hosting

## Files

- `index.html` - Landing page with "Connect with Strava" button
- `callback.html` - Handles OAuth redirect from Strava
- `review.html` - Displays your kudos statistics and chart
- `app.js` - All the JavaScript logic (OAuth, API calls, chart)
- `styles.css` - Styling (purple gradient, responsive design)

## Privacy & Security

- Your access token never leaves your browser
- Access token is stored in sessionStorage (cleared when you close the tab)
- No data is collected or stored by this app
- All API calls go directly from your browser to Strava

## Limitations

- Maximum 199 activities in 2025 (Strava rate limit protection)
- Access token expires after 6 hours (just refresh to reconnect)

## Troubleshooting

**"Authorization failed"**
- Make sure your Strava app callback domain is set correctly
- Check that the REDIRECT_URI in app.js matches your GitHub Pages URL

**"Failed to fetch activities"**
- Your access token may have expired - refresh the page to reconnect

**Blank page**
- Make sure GitHub Pages is enabled and deployed
- Check browser console (F12) for errors
