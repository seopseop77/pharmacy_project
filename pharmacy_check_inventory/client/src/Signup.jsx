import React, { useState } from 'react';
import { supabase } from './supabase'; // 경로 확인 필요

function Signup({ onSignupSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSignup = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage('✅ 회원가입 성공! 이메일을 확인하세요.');
      onSignupSuccess?.(); // 회원가입 성공 후 콜백 (예: 로그인 화면으로 전환)
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>회원가입</h2>
      <input
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br /><br />
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br /><br />
      <button onClick={handleSignup}>가입하기</button>
      <p style={{ color: 'red' }}>{message}</p>
    </div>
  );
}

export default Signup;
