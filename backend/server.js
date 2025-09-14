const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

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
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.settings.basic'
  ].join(' ');

// Generate OAuth2 URL
app.get('/auth/gmail/url', async (req, res) => {
  console.log('Client ID:', process.env.GOOGLE_CLIENT_ID);
  console.log('Redirect URI:', process.env.GOOGLE_REDIRECT_URI);
  
  try {
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + 
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state: 'state_parameter_passthrough_value'
      }).toString();

    console.log('Generated URL:', authUrl); // Debug log
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
  
  if (error) {
    console.error('OAuth Error:', error);
    return res.status(400).json({ error: error });
  }

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    let { access_token, refresh_token, expires_in } = tokenResponse.data;
    let created_at = Date.now();

    // Get user info using access token
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { email, name, picture } = userInfoResponse.data;

    // Check if token is expired before sending to n8n
    if (isTokenExpired(created_at, expires_in)) {
      console.log('Token expired, refreshing...');
      try {
        const refreshData = await refreshAccessToken(refresh_token);
        access_token = refreshData.access_token;
        expires_in = refreshData.expires_in;
        created_at = Date.now();
        console.log('Token refreshed successfully');
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        // Continue with existing token if refresh fails
      }
    }

    // Send to n8n webhook
    try {
      const n8nResponse = await axios.post('http://localhost:5678/webhook/c2028c38-c50b-40c6-8f88-c34c14fef1a8', {
        access_token,
        refresh_token,
        email,
        name,
        expires_in,
        created_at,
        timestamp: new Date().toISOString(),
        prompt: "send a email to jaswanthchitrada45@gmail.com i usually adress him as lavdekebal wish him a happy married life"
      });

      console.log('n8n webhook response:', n8nResponse.data);
    } catch (webhookError) {
      console.error('Failed to send to n8n webhook:', webhookError);
    }

    res.json({
      success: true,
      message: 'Authentication successful and data sent to n8n',
      tokens: {
        access_token,
        refresh_token,
        expires_in,
        created_at
      },
      user: {
        email,
        name,
        picture
      }
    });

  } catch (error) {
    console.error('OAuth callback error:', error.response?.data || error);
    res.status(500).json({ 
      error: 'OAuth callback failed', 
      details: error.message 
    });
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

// Google OAuth route
app.get('/auth/google', (req, res) => {
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + 
    new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.REDIRECT_URI,
      response_type: 'code',
      scope: 'email profile',
      access_type: 'offline',
      prompt: 'consent'
    }).toString();

  res.json({ url: authUrl });
});

// Callback route
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: process.env.REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    // Get user info
    const userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });

    res.json(userInfo.data);
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});