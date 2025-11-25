import React, { useState, useEffect } from 'react';
import './LoginPage.css';
import { FaGoogle } from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';
import Spline from '@splinetool/react-spline';
import Slider from 'react-slick';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const teamMembers = [
  {
    name: "Jaswanth chitrada",
    photo: "https://via.placeholder.com/50",
    designation: "Lead Developer",
    role: "Full Stack"
  },
  {
    name: "rishiraj",
    photo: "https://via.placeholder.com/50",
    designation: "Lead Developer",
    role: "Full Stack"
  },{
    name: "rajkumar",
    photo: "https://via.placeholder.com/50",
    designation: "Lead Developer",
    role: "Full Stack"
  }
  
];

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    const tokenData = localStorage.getItem('tokenData');
    const userData = localStorage.getItem('userData');
    
    if (tokenData && userData) {
      try {
        // Verify the data is valid JSON
        JSON.parse(tokenData);
        JSON.parse(userData);
        navigate('/chat', { replace: true });
      } catch (error) {
        // If data is invalid, clear it
        localStorage.clear();
      }
    }

    // Check for error from auth callback
    if (location.state?.error) {
      setError(location.state.error);
      // Clear the error from location state
      window.history.replaceState({}, document.title);
    }
  }, [navigate, location]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== process.env.REACT_APP_FRONTEND_URL) return;
      
      if (event.data.type === 'oauth-success') {
        localStorage.setItem('tokenData', decodeURIComponent(event.data.tokenData));
        localStorage.setItem('userData', decodeURIComponent(event.data.userData));
        navigate('/chat', { replace: true });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  const handleScreenClick = () => {
    if (!isVisible) {
      setIsVisible(true);
    }
  };

  const handleGoogleSignIn = async (e) => {
    e.stopPropagation();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/auth/gmail/url');
      const data = await response.json();

      if (data.authUrl) {
        // Direct redirect instead of popup
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (error) {
      console.error('Auth URL error:', error);
      setError('Failed to start authentication');
      setIsLoading(false);
    }
  };

  const carouselSettings = {
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    fade: true
  };

  return (
    <div className="main-container" onClick={handleScreenClick}>
      <div className="spline-container">
        <Spline scene="https://prod.spline.design/WBuEyiX0myZH5EhA/scene.splinecode" />
      </div>
      
      <div className={`login-container ${isVisible ? 'visible' : ''}`}>
        <div className="login-box">
          <h1>SIGN <span>IN</span></h1>
          <div className="google-signin-container">
            <button 
              onClick={handleGoogleSignIn} 
              className="google-signin-btn"
              disabled={isLoading}
            >
              <FaGoogle className="google-icon" />
              {isLoading && <span className="loading-spinner"></span>}
            </button>
          </div>
          {error && (
            <div className="error-message" onClick={(e) => e.stopPropagation()}>
              {error}
            </div>
          )}
        </div>

        <div className="developer-info">
          <h3>TEAM</h3>
          <div className="team-carousel">
            <Slider {...carouselSettings}>
              {teamMembers.map((member, index) => (
                <div key={index} className="team-member">
                  <img src={member.photo} alt={member.name} className="member-photo" />
                  <h4>{member.name}</h4>
                  <p className="designation">{member.designation}</p>
                  <p className="role">{member.role}</p>
                </div>
              ))}
            </Slider>
          </div>
          <p className="copyright">© 2025 ArtifactAI Production</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 