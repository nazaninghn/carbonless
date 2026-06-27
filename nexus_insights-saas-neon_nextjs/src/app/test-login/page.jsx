'use client';

import { useState } from 'react';

/**
 * Minimal test login page — no dependencies, no contexts, just raw fetch.
 * Use this to debug login issues.
 * URL: http://localhost:3000/test-login
 */
export default function TestLoginPage() {
  const [username, setUsername] = useState('test');
  const [password, setPassword] = useState('Test1234');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setResult('Sending...');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email: username, password }),
      });

      const data = await res.json().catch(() => ({}));
      
      if (res.ok) {
        // Store token
        if (data.access) {
          localStorage.setItem('_ca', data.access);
        }
        // Set cookies
        document.cookie = 'carbonless_auth=1; path=/; SameSite=Lax; Max-Age=86400';
        document.cookie = 'carbonless_mode_chosen=1; path=/; SameSite=Lax';
        
        setResult(`✅ SUCCESS! Token received. Redirecting in 2s...\n\nAccess: ${data.access?.substring(0, 30)}...`);
        
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      } else {
        setResult(`❌ FAILED (${res.status}): ${JSON.stringify(data)}`);
      }
    } catch (err) {
      setResult(`❌ ERROR: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    document.cookie = 'carbonless_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'carbonless_mode_chosen=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = '_carbonless_refresh=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    localStorage.removeItem('_ca');
    setResult('🗑️ All cookies and tokens cleared. Try login again.');
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: '40px', maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>🔐 Test Login</h1>
      
      <button onClick={clearAll} style={{ 
        marginBottom: '20px', padding: '8px 16px', 
        background: '#ff4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' 
      }}>
        Clear All Cookies & Tokens
      </button>

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Username:</label>
          <input 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Password:</label>
          <input 
            type="password"
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            padding: '10px 24px', background: '#4CAF50', color: 'white', 
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' 
          }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      {result && (
        <pre style={{ 
          marginTop: '20px', padding: '16px', background: '#f5f5f5', 
          borderRadius: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          fontSize: '12px', lineHeight: '1.6'
        }}>
          {result}
        </pre>
      )}

      <div style={{ marginTop: '30px', fontSize: '12px', color: '#666' }}>
        <p><strong>Credentials:</strong></p>
        <p>Username: test | Password: Test1234</p>
        <p>Username: admin | Password: admin1234</p>
      </div>
    </div>
  );
}
