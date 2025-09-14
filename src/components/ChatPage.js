import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import './ChatPage.css';
import Spline from '@splinetool/react-spline';
import { FaUser, FaSignOutAlt } from 'react-icons/fa';

const ChatPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    // Get data from URL on initial load
    const tokenData = searchParams.get('tokenData');
    const userData = searchParams.get('userData');

    if (tokenData && userData) {
      // Store in localStorage
      localStorage.setItem('tokenData', decodeURIComponent(tokenData));
      localStorage.setItem('userData', decodeURIComponent(userData));
      
      try {
        // Parse user data safely
        const parsedUserData = JSON.parse(decodeURIComponent(userData));
        setUserData(parsedUserData);
        
        // Set welcome message
        setMessages([{
          type: 'ai',
          content: `Welcome ${parsedUserData.name || 'User'}! How can I assist you today?`
        }]);
      } catch (error) {
        console.error('Error parsing user data:', error);
        navigate('/', { replace: true });
        return;
      }

      // Clean URL
      navigate('/chat', { replace: true });
    } else {
      // Check localStorage if no URL params
      const storedTokenData = localStorage.getItem('tokenData');
      const storedUserData = localStorage.getItem('userData');

      if (!storedTokenData || !storedUserData) {
        navigate('/', { replace: true });
        return;
      }

      try {
        const parsedUserData = JSON.parse(storedUserData);
        setUserData(parsedUserData);
        setMessages([{
          type: 'ai',
          content: `Welcome back ${parsedUserData.name || 'User'}! How can I assist you today?`
        }]);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        navigate('/', { replace: true });
        return;
      }
    }
  }, [navigate, searchParams]);

  const handleLogout = () => {
    localStorage.removeItem('tokenData');
    localStorage.removeItem('userData');
    navigate('/', { replace: true });
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    try {
      setIsLoading(true);
      setError(null);

      const tokenData = localStorage.getItem('tokenData');
      const userData = localStorage.getItem('userData');

      if (!tokenData || !userData) {
        navigate('/', { replace: true });
        return;
      }

      // Add user message to chat
      const newMessages = [
        ...messages,
        { type: 'user', content: inputMessage }
      ];
      setMessages(newMessages);
      setInputMessage('');

      // Parse user data safely
      let parsedUserData;
      try {
        parsedUserData = JSON.parse(userData);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('tokenData');
        localStorage.removeItem('userData');
        navigate('/', { replace: true });
        return;
      }

      // Send to backend
      const response = await fetch('http://localhost:5000/chat/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData}`
        },
        body: JSON.stringify({
          prompt: inputMessage,
          email: parsedUserData.email || '',
          name: parsedUserData.name || ''
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) {
          localStorage.removeItem('tokenData');
          localStorage.removeItem('userData');
          navigate('/', { replace: true });
          return;
        }
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      console.log('Response data:', data); // Debug log

      // Add AI response to chat - FIXED: Handle object responses properly
      if (data && typeof data === 'object' && 'response' in data) {
        // Ensure response is a string, not an object
        const responseContent = typeof data.response === 'object' 
          ? JSON.stringify(data.response) 
          : String(data.response);
          
        setMessages(prev => [...prev, {
          type: 'ai',
          content: responseContent
        }]);
      } else {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response format');
      }

    } catch (error) {
      console.error('Chat error:', error);
      setError('Failed to send message');
      setMessages(prev => [...prev, {
        type: 'ai',
        content: 'Sorry, there was an error processing your message. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!userData) return null;

  // Render message content safely
  const renderMessageContent = (content) => {
    if (typeof content === 'object') {
      return JSON.stringify(content);
    }
    return content;
  };

  return (
    <div className="chat-page">
      <div className="spline-container">
        <Spline scene="https://prod.spline.design/PXtgGSaCZZioVljE/scene.splinecode" />
      </div>

      <nav className="chat-navbar">
        <div className="nav-brand">MIVE AI</div>
        <div className="nav-user">
          <div className="user-info">
            <img src={userData.picture || '/default-avatar.png'} alt={userData.name || 'User'} className="user-avatar" />
            <span className="user-name">{userData.name || 'User'}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <FaSignOutAlt />
          </button>
        </div>
      </nav>
      
      <div className="chat-interface">
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.type === 'user' ? 'user-message' : 'ai-message'}`}
            >
              {message.type === 'ai' && (
                <div className="message-avatar">
                  <img src="/eve-avatar.png" alt="EVE" />
                </div>
              )}
              <div className="message-content">
                {renderMessageContent(message.content)}
              </div>
              {message.type === 'user' && (
                <div className="message-avatar">
                  <img src={userData.picture || '/default-avatar.png'} alt={userData.name || 'User'} />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="message ai-message">
              <div className="message-avatar">
                <img src="/eve-avatar.png" alt="EVE" />
              </div>
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
        </div>

        <div className="chat-input-container">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button 
            onClick={sendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="send-button"
          >
            SEND
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;