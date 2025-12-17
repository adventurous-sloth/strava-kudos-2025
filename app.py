from flask import Flask, redirect, request, session, render_template, jsonify
import requests
from datetime import datetime
from collections import Counter
import os

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Fix session cookie settings for localhost OAuth
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False

CLIENT_ID = '186241'
CLIENT_SECRET = os.environ.get('CLIENT_SECRET', '3b28b9b435663c66d0479030a5e2f0d25f9295ea')
REDIRECT_URI = os.environ.get('REDIRECT_URI', 'http://localhost:5000/auth/callback')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/login')
def login():
    auth_url = (
        f"https://www.strava.com/oauth/authorize?"
        f"client_id={CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={REDIRECT_URI}&"
        f"approval_prompt=auto&"
        f"scope=activity:read_all"
    )
    return redirect(auth_url)

@app.route('/auth/callback')
def callback():
    print("=== CALLBACK ROUTE HIT ===")  # Add this
    print(f"Request args: {request.args}")  # Add this
    
    code = request.args.get('code')
    
    if not code:
        print("No code received!")  # Add this
        return "Authorization failed", 400
    
    print(f"Code received: {code}")  # Add this
    
    # Exchange code for token
    response = requests.post(
        'https://www.strava.com/oauth/token',
        data={
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'code': code,
            'grant_type': 'authorization_code'
        }
    )
    
    print(f"Strava response: {response.status_code}")  # Add this
    
    tokens = response.json()
    session['access_token'] = tokens['access_token']
    session['athlete_name'] = f"{tokens['athlete']['firstname']} {tokens['athlete']['lastname']}"
    
    return redirect('/review')

@app.route('/review')
def review():
    if 'access_token' not in session:
        return redirect('/login')
    
    return render_template('review.html', athlete_name=session.get('athlete_name'))

@app.route('/api/kudos-data')
def kudos_data():
    if 'access_token' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    access_token = session['access_token']
    headers = {'Authorization': f'Bearer {access_token}'}
    
    # Jan 1, 2025 and Dec 31, 2025 as Unix timestamps
    after = int(datetime(2025, 1, 1).timestamp())
    before = int(datetime(2025, 12, 31, 23, 59, 59).timestamp())
    
    # First, check how many activities they have
    initial_response = requests.get(
        'https://api.strava.com/v3/athlete/activities',
        headers=headers,
        params={
            'after': after,
            'before': before,
            'per_page': 200,
            'page': 1
        }
    )
    
    initial_activities = initial_response.json()
    
    # If they got 200 results, they might have more
    if len(initial_activities) == 200:
        # Check if there's a second page
        second_page = requests.get(
            'https://api.strava.com/v3/athlete/activities',
            headers=headers,
            params={
                'after': after,
                'before': before,
                'per_page': 1,
                'page': 2
            }
        )
        
        if second_page.json():  # If there's anything on page 2
            return jsonify({
                'error': 'too_many_activities',
                'message': 'You have more than 199 activities in 2025. Unfortunately, this would exceed our rate limits. Please contact us for a custom solution!'
            }), 400
    
    # They have 199 or fewer, proceed!
    all_activities = initial_activities
    
    # Collect all kudos
    all_kudos = Counter()
    
    for activity in all_activities:
        activity_id = activity['id']
        
        # Get kudos for this activity
        kudos_response = requests.get(
            f'https://api.strava.com/v3/activities/{activity_id}/kudos',
            headers=headers
        )
        
        kudoers = kudos_response.json()
        
        for person in kudoers:
            name = f"{person['firstname']} {person['lastname']}"
            all_kudos[name] += 1
    
    # Get top 30 kudos-givers
    top_kudos = all_kudos.most_common(30)
    
    return jsonify({
        'labels': [name for name, _ in top_kudos],
        'data': [count for _, count in top_kudos],
        'total_activities': len(all_activities),
        'total_kudos': sum(all_kudos.values())
    })

if __name__ == '__main__':
    app.run(debug=True)