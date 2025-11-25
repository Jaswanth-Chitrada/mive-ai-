const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const path = require('path');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
  }),
  storageBucket: "artifact-5c220.firebasestorage.app"
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('build')); // If you're serving the React build

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// OAuth2 Configuration
const SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

// Generate OAuth2 URL
app.get('/auth/gmail/url', async (req, res) => {
  try {
    // Remove quotes from environment variables if they exist
    const redirectUri = process.env.GOOGLE_REDIRECT_URI.replace(/"/g, '');
    
    console.log('Generating OAuth URL with:', {
      clientId: process.env.GOOGLE_CLIENT_ID,
      redirectUri: redirectUri,
      frontendUrl: process.env.REACT_APP_FRONTEND_URL
    });

    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + 
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri, // Use cleaned redirectUri
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent'
      }).toString();

    console.log('Generated auth URL:', authUrl);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// Helper function to check if token is expired
const isTokenExpired = (created_at, expires_in) => {
  const expiryTime = created_at + (expires_in * 1000); // convert to milliseconds
  return Date.now() >= expiryTime;
};

// Helper function to refresh token
const refreshAccessToken = async (refresh_token) => {
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token'
    });
    return response.data;
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw error;
  }
};

// Handle OAuth2 callback
app.get('/auth/gmail/callback', async (req, res) => {
  const { code, error } = req.query;
  
  // Remove quotes from environment variables
  const frontendUrl = process.env.REACT_APP_FRONTEND_URL.replace(/"/g, '');
  const redirectUri = process.env.GOOGLE_REDIRECT_URI.replace(/"/g, '');
  
  if (error) {
    console.error('OAuth Error:', error);
    return res.redirect(`${frontendUrl}/login?error=Authentication failed`);
  }

  if (!code) {
    console.error('No code provided');
    return res.redirect(`${frontendUrl}/login?error=No code provided`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri, // Use cleaned redirectUri
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const created_at = Date.now();

    // Get user info
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    // Store tokens and user info
    const userData = {
      email: userInfoResponse.data.email,
      name: userInfoResponse.data.name,
      picture: userInfoResponse.data.picture
    };

    const tokenData = {
      access_token,
      refresh_token,
      expires_in,
      created_at
    };

    // Encode data for URL
    const encodedTokenData = encodeURIComponent(JSON.stringify(tokenData));
    const encodedUserData = encodeURIComponent(JSON.stringify(userData));

    // Construct redirect URL
    const redirectUrl = `${frontendUrl}/chat?tokenData=${encodedTokenData}&userData=${encodedUserData}`;
    console.log('Redirecting to:', redirectUrl);

    return res.redirect(redirectUrl);

  } catch (error) {
    console.error('Callback error:', error.response?.data || error);
    return res.redirect(`${frontendUrl}/login?error=Authentication failed`);
  }
});

// Add this after your Firebase Admin initialization
const db = admin.firestore();

// Modify the storeUserTokens function to use a different collection
async function storeUserTokens(userId, tokens) {
  try {
    // Store in a 'gmail_tokens' collection instead
    await db.collection('gmail_tokens').doc(userId).set({
      ...tokens,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error storing tokens:', error);
    // Instead of throwing, return success without token storage
    // This allows the flow to continue even if Firestore fails
    console.log('Proceeding without token storage');
  }
}

// Refresh token endpoint
app.post('/auth/gmail/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Get stored refresh token (implement based on your database)
    const userTokens = await getUserTokens(userId);
    
    if (!userTokens?.refresh_token) {
      return res.status(400).json({ error: 'No refresh token available' });
    }

    // Exchange refresh token for new access token
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      refresh_token: userTokens.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token'
    });

    const { access_token, expires_in } = response.data;

    // Store new access token
    await storeUserTokens(userId, {
      access_token,
      expires_in,
      refresh_token: userTokens.refresh_token,
      created_at: Date.now()
    });

    res.json({ access_token, expires_in });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Routes
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userRecord = await admin.auth().createUser({
      email,
      password,
    });
    res.status(201).json({ userId: userRecord.uid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/login', async (req, res) => {
  // Note: Client-side Firebase Auth should handle login
  // This endpoint can be used for additional server-side logic
  res.status(200).json({ message: 'Use Firebase client SDK for authentication' });
});

// Protected route example
app.get('/chat', authenticateToken, (req, res) => {
  // Only authenticated users can access this route
  res.json({ message: 'Welcome to the chat!', userId: req.user.uid });
});

// OAuth callback route
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { token } = req.query;
    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(token);
    // You can add additional user data to your database here
    res.status(200).json({ 
      userId: decodedToken.uid,
      email: decodedToken.email
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user profile route
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await admin.auth().getUser(req.user.uid);
    res.json({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Temporary testing endpoint for Google OAuth (REMOVE IN PRODUCTION)
app.get('/auth/google/test', async (req, res) => {
  try {
    const accessToken = req.headers.authorization.split(' ')[1];
    
    // Use axios instead of fetch
    const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const googleUserInfo = response.data;
    
    // Create or get Firebase user
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUserByEmail(googleUserInfo.email);
    } catch (error) {
      // If user doesn't exist, create one
      firebaseUser = await admin.auth().createUser({
        email: googleUserInfo.email,
        displayName: googleUserInfo.name,
        photoURL: googleUserInfo.picture
      });
    }
    
    // Create a Firebase custom token
    const firebaseToken = await admin.auth().createCustomToken(firebaseUser.uid);
    
    res.json({
      firebaseToken,
      user: {
        uid: firebaseUser.uid,
        email: googleUserInfo.email,
        name: googleUserInfo.name,
        picture: googleUserInfo.picture
      }
    });
    
  } catch (error) {
    console.error('OAuth Test Error:', error.response?.data || error.message);
    res.status(400).json({ error: error.message });
  }
});

// Chat endpoint
app.post('/chat/prompt', async (req, res) => {
  try {
    const { prompt, email, name } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get token data from request
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tokenData = JSON.parse(authHeader.split(' ')[1]);
    const { access_token, refresh_token, expires_in, created_at } = tokenData;

    // Send to n8n webhook
    const n8nResponse = await axios.post(
      'http://localhost:5678/webhook/n8n',
      {
        access_token,
        refresh_token,
        email,
        name,
        expires_in,
        created_at,
        prompt,
        timestamp: new Date().toISOString()
      }
    );

    console.log('n8n Response:', n8nResponse.data);

    // Handle n8n response
    let response;

if (n8nResponse.data.output) {
  response = n8nResponse.data.output;
} else if (n8nResponse.data.myField) {
  response = n8nResponse.data.myField;
} else if (typeof n8nResponse.data === 'string') {
  response = n8nResponse.data;
} else if (n8nResponse.data.message) {
  response = n8nResponse.data.message;
} else {
  response = 'Received your message!';
}


    res.json({ response });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      response: 'Sorry, I encountered an error processing your message.' 
    });
  }
});

app.get('*', (req, res, next) => {
  if (req.url.startsWith('/auth') || req.url.startsWith('/api')) {
    next();
  } else {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
