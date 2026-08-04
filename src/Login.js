// Login.js - Updated to use React Router navigation
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

function Login({ onLogin }) {
  const [formData, setFormData] = useState({
    username: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [users, setUsers] = useState([]);
  const [fetchingUsers, setFetchingUsers] = useState(true);

  const navigate = useNavigate(); // Add this for React Router navigation

  // Google Sheets Configuration
  const SPREADSHEET_ID = process.env.REACT_APP_LOGIN_SHEET_ID || '1iBDfsxA9XEC9nhQE-ALBYlyGRZWOaCYvWsnGfYYbr1I';
  const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk';
  const SHEET_NAME = 'DispatchCredentials'; // Sheet containing username, password and position

  // Fetch users from Google Sheets
  useEffect(() => {
    fetchUsersFromSheet();
  }, []);

  const getUserRole = (username, position) => {
    // First check position field from sheet
    if (position && position.trim()) {
      const lowerPosition = position.toLowerCase().trim();

      if (lowerPosition === 'administrator' || lowerPosition === 'admin') {
        return 'Administrator';
      } else if (lowerPosition === 'manager') {
        return 'Manager';
      } else if (lowerPosition === 'supervisor') {
        return 'Supervisor';
      } else if (lowerPosition === 'team member' || lowerPosition === 'employee') {
        return 'Team Member';
      }
    }

    // Fallback to username-based role detection if position is not specified
    const adminKeywords = ['admin', 'manager', 'director', 'owner', 'goyal'];
    const supervisorKeywords = ['supervisor', 'super', 'lead'];
    const teamKeywords = ['team', 'member', 'employee', 'staff', 'operator', 'paras'];

    const lowerUsername = username.toLowerCase();

    if (adminKeywords.some(keyword => lowerUsername.includes(keyword))) {
      return 'Administrator';
    } else if (supervisorKeywords.some(keyword => lowerUsername.includes(keyword))) {
      return 'Supervisor';
    } else if (teamKeywords.some(keyword => lowerUsername.includes(keyword))) {
      return 'Team Member';
    } else {
      return 'Team Member';
    }
  };

  const fetchUsersFromSheet = async () => {
    try {
      setFetchingUsers(true);
      const range = `${SHEET_NAME}!A:C`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.values && data.values.length > 1) {
        const headers = data.values[0];
        const rows = data.values.slice(1);

        const usernameIndex = headers.findIndex(h =>
          h && (h.toLowerCase().includes('username') ||
            h.toLowerCase().includes('user') ||
            h.toLowerCase() === 'username')
        );

        const passwordIndex = headers.findIndex(h =>
          h && (h.toLowerCase().includes('password') ||
            h.toLowerCase().includes('pass') ||
            h.toLowerCase() === 'password')
        );

        const positionIndex = headers.findIndex(h =>
          h && (h.toLowerCase().includes('position') ||
            h.toLowerCase().includes('role') ||
            h.toLowerCase() === 'position')
        );

        if (usernameIndex !== -1 && passwordIndex !== -1) {
          const usersList = rows.map(row => {
            const username = row[usernameIndex] || '';
            const password = row[passwordIndex] || '';
            const position = positionIndex !== -1 ? (row[positionIndex] || '') : '';
            const role = getUserRole(username, position);

            return {
              username: username,
              password: password,
              position: position || role,
              displayName: username,
              role: role
            };
          }).filter(user => user.username && user.password);

          setUsers(usersList);
          console.log('Users loaded:', usersList);
        } else {
          console.error('Could not find username/password columns');
          setError('Invalid sheet structure. Please check column headers.');
        }
      } else {
        console.error('No data found in sheet');
        setError('No user data found. Please contact administrator.');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load user data. Please try again later.');
    } finally {
      setFetchingUsers(false);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'Administrator': return '👑';
      case 'Manager': return '📊';
      case 'Supervisor': return '👔';
      case 'Team Member': return '👤';
      default: return '👨‍💼';
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Administrator': return '#8B5CF6';
      case 'Manager': return '#3B82F6';
      case 'Supervisor': return '#F59E0B';
      case 'Team Member': return '#10B981';
      default: return '#6B7280';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'username') {
      // When username changes, find the selected user
      const selectedUser = users.find(user => user.username === value);
      if (selectedUser) {
        setFormData({
          username: value,
          password: "" // Clear password when changing user
        });
      } else {
        setFormData({
          ...formData,
          [name]: value
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      setError("Please enter both username and password");
      return;
    }

    setLoading(true);

    await new Promise(resolve => setTimeout(resolve, 800));

    const matchedUser = users.find(
      user => user.username === formData.username
    );

    if (matchedUser && matchedUser.password === formData.password) {
      const userData = {
        username: matchedUser.username,
        fullName: matchedUser.displayName || matchedUser.username,
        role: matchedUser.role,
        position: matchedUser.position,
        loginTime: new Date().toISOString()
      };

      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userData", JSON.stringify(userData));

      setLoading(false);

      if (onLogin && typeof onLogin === 'function') {
        onLogin(userData);
      }

      // Dispatch custom event for auth change
      window.dispatchEvent(new Event('authChange'));

      // Use React Router navigation instead of window.location
      navigate('/', { replace: true });
    } else {
      setError("Invalid password. Please check your credentials and try again.");
      setLoading(false);
      setFormData(prev => ({ ...prev, password: "" }));
      setTimeout(() => {
        const passwordInput = document.querySelector('input[name="password"]');
        if (passwordInput) passwordInput.focus();
      }, 100);
    }
  };

  return (
    <div className="login-container-pro">
      {/* Animated Background */}
      <div className="login-bg-pro">
        <div className="bg-gradient-pro"></div>
        <div className="bg-particles-pro">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="login-content-pro">
        <div className="login-grid-pro">
          {/* Left Panel - Branding */}
          <div className="login-brand-pro">
            <div className="brand-card-pro">
              <div className="brand-icon-pro">
                <span className="icon-main">🚚</span>
                <span className="icon-ring"></span>
              </div>
              <h1 className="brand-title-pro">Dispatch Management System</h1>
              <p className="brand-subtitle-pro">
                Streamline your dispatch operations with our comprehensive management solution
              </p>

              <div className="brand-features-pro">
                <div className="feature-item-pro">
                  <span className="feature-icon">📊</span>
                  <div className="feature-text">
                    <h4>Real-time Tracking</h4>
                    <p>Monitor dispatch status instantly</p>
                  </div>
                </div>
                <div className="feature-item-pro">
                  <span className="feature-icon">📄</span>
                  <div className="feature-text">
                    <h4>Auto Report Generation</h4>
                    <p>Generate PDF & Excel reports automatically</p>
                  </div>
                </div>
                <div className="feature-item-pro">
                  <span className="feature-icon">🔍</span>
                  <div className="feature-text">
                    <h4>Advanced Search</h4>
                    <p>Search by item, lot number, and more</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Login Form */}
          <div className="login-form-pro">
            <div className="form-container-pro">
              <div className="form-header-pro">
                <div className="header-icon-pro">🔐</div>
                <h2>Welcome Back</h2>
                <p>Please sign in to continue to your dashboard</p>
              </div>

              {error && (
                <div className="error-alert-pro">
                  <span className="alert-icon">⚠️</span>
                  <span className="alert-text">{error}</span>
                  <button className="alert-close" onClick={() => setError("")}>×</button>
                </div>
              )}

              <form onSubmit={handleLogin} className="login-form-pro-ui">
                <div className="input-group-pro">
                  <label className="input-label-pro">
                    <span className="label-icon">👨‍💼</span>
                    Username
                  </label>
                  <select
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className="input-field-pro"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                    disabled={fetchingUsers}
                  >
                    <option value="">{fetchingUsers ? "Loading users..." : "Select username"}</option>
                    {users.map((user, index) => (
                      <option key={index} value={user.username}>
                        {user.username} - {getRoleIcon(user.role)} {user.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group-pro">
                  <label className="input-label-pro">
                    <span className="label-icon">🔒</span>
                    Password
                  </label>
                  <div className="password-field-pro" style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="input-field-pro"
                      placeholder="Enter your password"
                      autoComplete="off"
                      style={{
                        width: '100%',
                        padding: '12px',
                        paddingRight: '40px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                    <button
                      type="button"
                      className="password-toggle-pro"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '18px'
                      }}
                    >
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`login-btn-pro ${loading ? 'loading' : ''}`}
                  disabled={loading || fetchingUsers}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: loading || fetchingUsers ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner-pro"></span>
                      Verifying Password...
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <span className="btn-arrow">→</span>
                    </>
                  )}
                </button>
              </form>

              <div className="form-footer-pro" style={{ marginTop: '24px' }}>
                <div className="security-badge-pro" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#666'
                }}>
                  <span className="security-icon">🔒</span>
                  <span>Secure Login • Password is verified securely</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;