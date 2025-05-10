import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import AuthPage from './AuthPage';
import ResetPassword from './ResetPassword';
import { supabase } from './supabase';

function Root() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);  // ✅ 로딩 상태 추가

  useEffect(() => {
    const getSession = async () => {
      const auto = localStorage.getItem('autoLogin');
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;

      if (user && auto === 'true') {
        setUserId(user.id);
      }
      setLoading(false); // ✅ 세션 확인 완료
    };
    getSession();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('autoLogin');
    localStorage.removeItem('userEmail');
    setUserId(null);
  };

  if (loading) return <p>로딩 중...</p>; // ✅ 세션 확인 전에는 아무것도 보여주지 않음

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={userId ? <App userId={userId} onLogout={handleLogout} /> : <Navigate to="/auth" />}
        />
        <Route path="/auth" element={<AuthPage onLogin={setUserId} />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </Router>
  );
}
export default Root;