import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sendInitialMessage = async (tokenData, userData) => {
    try {
      const response = await fetch('http://localhost:5000/chat/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData}`
        },
        body: JSON.stringify({
          prompt: "hi",
          email: JSON.parse(userData).email,
          name: JSON.parse(userData).name
        })
      });

      const data = await response.json();
      if (data && data.response) {
        // Store the initial message in localStorage
        localStorage.setItem('initialMessage', data.response);
      }
    } catch (error) {
      console.error('Error sending initial message:', error);
    }
  };

  useEffect(() => {
    const tokenData = searchParams.get('tokenData');
    const userData = searchParams.get('userData');
    const error = searchParams.get('error');

    if (error) {
      console.error('Auth error:', error);
      navigate('/', { state: { error }, replace: true });
      return;
    }

    if (tokenData && userData) {
      try {
        // Clear any existing data
        localStorage.clear();
        
        // Store new data
        localStorage.setItem('tokenData', decodeURIComponent(tokenData));
        localStorage.setItem('userData', decodeURIComponent(userData));
        
        // Send initial message
        sendInitialMessage(decodeURIComponent(tokenData), decodeURIComponent(userData))
          .then(() => {
            // Navigate to chat
            navigate('/chat', { replace: true });
          });
      } catch (error) {
        console.error('Error storing auth data:', error);
        navigate('/', { 
          state: { error: 'Failed to complete authentication' }, 
          replace: true 
        });
      }
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate, searchParams]);

  return <div>Completing authentication...</div>;
};

export default AuthCallback; 