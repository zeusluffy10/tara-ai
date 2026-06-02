from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()

@router.get("/privacy", response_class=HTMLResponse)
def privacy_policy():
    return """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>TARA-AI Privacy Policy</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1a1a2e;
      line-height: 1.7;
    }
    h1 { color: #1557C0; font-size: 28px; }
    h2 { color: #1557C0; font-size: 20px; margin-top: 32px; }
    p { margin: 12px 0; }
    .updated { color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <h1>TARA-AI Privacy Policy</h1>
  <p class="updated">Last updated: June 2, 2025</p>

  <p>TARA-AI ("we", "our", or "us") is committed to protecting your privacy.
  This Privacy Policy explains how we handle information when you use our
  mobile application TARA-AI ("the App").</p>

  <h2>1. Information We Collect</h2>
  <p><strong>Location Data:</strong> The App accesses your device's GPS location
  solely to provide turn-by-turn navigation directions. Location data is used
  only in real-time during active navigation and is never stored on our servers
  or shared with third parties.</p>
  <p>We do not collect any other personal information such as your name, email
  address, phone number, or payment information.</p>

  <h2>2. How We Use Your Information</h2>
  <p>Your location is used exclusively to:</p>
  <ul>
    <li>Calculate walking routes from your current position to your destination</li>
    <li>Provide real-time turn-by-turn voice navigation in Filipino</li>
    <li>Estimate your arrival time</li>
  </ul>

  <h2>3. Data Storage</h2>
  <p>TARA-AI does not store your location data on any server. All navigation
  processing happens in real-time and location data is discarded immediately
  after use. Saved Places (such as Home) are stored locally on your device only
  using AsyncStorage and are never transmitted to our servers.</p>

  <h2>4. Third-Party Services</h2>
  <p>The App uses the following third-party services:</p>
  <ul>
    <li><strong>Google Maps Platform</strong> — for mapping, routing, and place
    search. Subject to Google's Privacy Policy.</li>
    <li><strong>OpenAI</strong> — for text-to-speech voice guidance in Filipino.
    Only the navigation instruction text is sent, never personal data.</li>
  </ul>

  <h2>5. Children's Privacy</h2>
  <p>TARA-AI is designed for senior citizens and general users aged 4 and above.
  We do not knowingly collect personal information from children under 13.</p>

  <h2>6. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. We will notify users
  of any significant changes by updating the date at the top of this page.</p>

  <h2>7. Contact Us</h2>
  <p>If you have any questions about this Privacy Policy, please contact us at:
  <br/><strong>tara.ai.navigation@gmail.com</strong></p>

  <p style="margin-top:40px; color:#888; font-size:13px;">
  &copy; 2025 TARA-AI. All rights reserved.
  </p>
</body>
</html>
"""
