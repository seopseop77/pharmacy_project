import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(async () => {
        const { data, error } = await supabase.auth.getUser();
        if (data?.user?.id) {
          // ✅ 세션이 복원되고 사용자 확인됨 → 홈으로 이동
          navigate('/');
        }
      });
    } else {
      console.warn('❗ 토큰이 해시에 없습니다.');
    }
  }, [navigate]);

  const handleUpdatePassword = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setMessage('❌ Auth session missing!');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage('✅ 비밀번호가 성공적으로 변경되었습니다.');
      setTimeout(() => navigate('/'), 2000);  // ✅ 홈으로 이동
    }
  };

  return (
    <div style={{ padding: '30px' }}>
      <h2>비밀번호 재설정</h2>
      <input
        type="password"
        placeholder="새 비밀번호"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <br /><br />
      <button onClick={handleUpdatePassword}>비밀번호 변경</button>
      <p style={{ color: message.startsWith('✅') ? 'green' : 'red' }}>{message}</p>
    </div>
  );
}

export default ResetPassword;
