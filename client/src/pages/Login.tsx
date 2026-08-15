import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Mail, Lock, User as UserIcon, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1014229459015-v0dubaek4spmlmprar5crttajfrqk568.apps.googleusercontent.com';
    setGoogleClientId(clientId);
    loadGoogleGSI(clientId);
  }, []);

  const loadGoogleGSI = (clientId: string) => {
    // Inject the Google One Tap / Sign In script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if ((window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCallback
        });
        (window as any).google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          { theme: 'outline', size: 'large', width: '100%' }
        );
      }
    };
    document.head.appendChild(script);
  };

  const handleGoogleCallback = async (response: any) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.googleLogin(response.credential);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Google Authentication failed');
    } finally {
      setLoading(false);
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !name)) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const data = await api.localLogin(email, password);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        const data = await api.localRegister(name, email, password);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans select-none">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-brand-600/5 blur-3xl pointer-events-none" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-brand-500 items-center justify-center shadow-lg shadow-brand-500/20 mb-4 border border-brand-400/20">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Welcome to MeetMind
        </h2>
        <p className="mt-1.5 text-sm text-dark-400 max-w-sm mx-auto">
          Deploy AI-driven meeting intelligence for summaries, action tracking, and live voice logs.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="glass-card p-8 border-brand-500/10 shadow-2xl shadow-brand-500/5 bg-gradient-to-b from-dark-900/60 to-dark-950/80">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2 items-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!isLogin && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dark-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-dark-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter name"
                    className="w-full bg-dark-950 border border-dark-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-dark-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-dark-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email"
                  className="w-full bg-dark-950 border border-dark-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-dark-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-dark-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-dark-950 border border-dark-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-brand-500/10 transition active:scale-[0.98] disabled:opacity-50"
            >
              <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="my-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-dark-900 px-3 text-dark-500 uppercase tracking-widest font-bold">
                Or Continue With
              </span>
            </div>
          </div>

          <div className="space-y-3 flex justify-center">
            <div id="google-signin-btn" className="w-full flex justify-center" />
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
            >
              {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
