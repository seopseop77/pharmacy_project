import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

function ResetPassword() {
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
          console.log("✅ 세션 복원 완료:", data.user.id);
          // navigate('/') 제거됨 ✅
        }
      });
    } else {
      console.warn('❗ 해시에 토큰이 없습니다.');
    }
  }, []);

  const handleUpdatePassword = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setMessage('❌ 인증 세션이 존재하지 않습니다.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage('✅ 비밀번호가 성공적으로 변경되었습니다. 잠시 후 로그인 화면으로 이동합니다.');
      setTimeout(() => navigate('/'), 2000);
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
        style={{ padding: '8px', width: '250px' }}
      />
      <br /><br />
      <button onClick={handleUpdatePassword}>비밀번호 변경</button>
      <p style={{ color: message.startsWith('✅') ? 'green' : 'red' }}>{message}</p>
    </div>
  );
}

export default ResetPassword;
