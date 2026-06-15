import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { Shield, Lock, User, AlertCircle, Loader2, ArrowRightLeft } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);

  // Parse callback URL from query parameters
  const callbackUrl = new URLSearchParams(window.location.search).get('callback');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      if (isSignup) {
        // Register new user
        await api.signup(username, password);
        setSuccess('Account created successfully! Logging you in...');
      }

      // Log the user in (works for both standard login and post-signup auto-login)
      const authResult = await login(username, password);
      
      if (callbackUrl) {
        // Redirect back to extension with authorization token
        const redirectTarget = `${callbackUrl}?token=${encodeURIComponent(authResult.token)}`;
        window.location.href = redirectTarget;
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (isSignup) {
        setError(err.response?.data?.error ?? 'Registration failed. Please try again.');
      } else {
        setError(err.response?.data?.error ?? 'Invalid username or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Subtle SaaS background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-500/10 mb-4">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-display">CodeArmor</h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">Enterprise Security Intelligence</p>
        </div>

        {/* white card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl shadow-slate-100/60">
          {/* Tab Switcher */}
          <div className="flex border-b border-slate-150 mb-6">
            <button
              onClick={() => { setIsSignup(false); setError(''); setSuccess(''); }}
              className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${
                !isSignup ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsSignup(true); setError(''); setSuccess(''); }}
              className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${
                isSignup ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-450 hover:text-slate-700'
              }`}
            >
              Register
            </button>
          </div>

          {callbackUrl && (
            <div className="bg-indigo-50 border border-indigo-150 text-indigo-750 text-xs px-3.5 py-2.5 rounded-xl mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Authenticating extension request...</span>
            </div>
          )}

          {error && (
            <div className="bg-rose-500/5 border border-rose-500/20 text-rose-600 text-xs px-4 py-3.5 rounded-xl mb-4 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 text-xs px-4 py-3.5 rounded-xl mb-4">
              <span className="font-semibold">{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  placeholder="Enter username"
                  className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-650 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-650 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
                />
              </div>
            </div>

            {isSignup && (
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Confirm Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-650 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-850 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 mt-4 shadow-lg shadow-indigo-650/15"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing request...</span>
                </>
              ) : (
                isSignup ? 'Create Account' : 'Authenticate'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-8 font-medium">
          CodeArmor Security Console · v1.0.0
        </p>
      </div>
    </div>
  );
}
