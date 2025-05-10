import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useNavigate } from 'react-router-dom';
import './AuthPage.css';

function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [domain, setDomain] = useState('@gmail.com');
  const [customDomain, setCustomDomain] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [autoLogin, setAutoLogin] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data?.session?.user;
      if (user) onLogin(user.id);
    });
  }, [onLogin]);

  const buildEmail = () => {
    const finalDomain = domain === 'custom' ? customDomain : domain;
    return username.includes('@') ? username : `${username}${finalDomain}`;
  };

  const handleAuth = async () => {
    setMessage('');
    const email = buildEmail();
    const action = mode === 'signup' ? 'signUp' : 'signInWithPassword';
    const { data, error } = await supabase.auth[action]({ email, password });

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setMessage(
          <>
            ⚠️ 이메일 인증이 완료되지 않았습니다. 메일함을 확인해 인증 후 다시 로그인하세요.
            <br />
            <button onClick={handleResendVerification} className="sub-button">인증 메일 재전송</button>
          </>
        );
      } else {
        setMessage(`❌ ${error.message}`);
      }
    } else if (mode === 'login') {
      if (autoLogin) {
        localStorage.setItem('autoLogin', 'true');
        localStorage.setItem('userEmail', email);
      }
      onLogin(data.user?.id);
      navigate('/');
    } else {
      setMessage('✅ 회원가입이 완료되었습니다! 📩 입력하신 이메일로 인증 메일이 전송되었습니다. 메일을 확인하고 인증을 완료한 후 로그인해주세요.');
      setMode('login');
    }
  };

  const handlePasswordReset = async () => {
    const email = buildEmail();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:3000/reset-password'
    });
    setMessage(error ? `❌ ${error.message}` : '✅ 비밀번호 재설정 이메일이 전송되었습니다.');
  };

  const handleResendVerification = async () => {
    const email = buildEmail();
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setMessage(error ? `❌ 재전송 실패: ${error.message}` : '✅ 인증 메일이 재전송되었습니다. 메일함을 확인하세요.');
  };

  return (
    <div className="auth-card">
      <h2 className="auth-title">
        {mode === 'login' && '로그인'}
        {mode === 'signup' && '회원가입'}
        {mode === 'reset' && '비밀번호 재설정'}
      </h2>

      <div className="email-row">
        <input
          type="text"
          placeholder="아이디 (예: pharmacy123)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input-id"
        />
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="select-domain"
        >
          <option value="@gmail.com">@gmail.com</option>
          <option value="@naver.com">@naver.com</option>
          <option value="@snu.ac.kr">@snu.ac.kr</option>
          <option value="custom">직접 입력</option>
        </select>
      </div>

      {domain === 'custom' && (
        <input
          type="text"
          placeholder="예: @mydomain.com"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          className="input-custom"
        />
      )}

      {mode !== 'reset' && (
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-full"
        />
      )}

      {mode === 'login' && (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={autoLogin}
            onChange={() => setAutoLogin(!autoLogin)}
          /> 로그인 상태 유지
        </label>
      )}

      {mode === 'reset' ? (
        <>
          <button onClick={handlePasswordReset} className="main-button">메일 전송</button>
          <button onClick={() => setMode('login')} className="sub-button">← 로그인으로 돌아가기</button>
        </>
      ) : (
        <button onClick={handleAuth} className="main-button">
          {mode === 'signup' ? '가입하기' : '로그인'}
        </button>
      )}

      {message && (
        <div className="message-text" style={{ color: message?.props ? 'red' : message.startsWith('✅') ? 'green' : 'red' }}>{message}</div>
      )}

      <div className="bottom-links">
        {mode === 'login' && (
          <>
            <p onClick={() => setMode('reset')}>비밀번호를 잊으셨나요?</p>
            <p onClick={() => setMode('signup')}>계정이 없으신가요? 회원가입</p>
          </>
        )}
        {mode === 'signup' && (
          <p onClick={() => setMode('login')}>이미 계정이 있으신가요? 로그인</p>
        )}
      </div>
    </div>
  );
}

export default AuthPage;
