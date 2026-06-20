import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { Lock, User, AlertCircle, Loader2, ArrowRightLeft, Shield } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

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
        await api.signup(username, password);
        setSuccess('Account created. Signing you in...');
      }

      const authResult = await login(username, password);

      if (callbackUrl) {
        const redirectTarget = `${callbackUrl}?token=${encodeURIComponent(authResult.token)}`;
        window.location.href = redirectTarget;
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (isSignup) {
        setError(err.response?.data?.error ?? 'Registration failed.');
      } else {
        setError(err.response?.data?.error ?? 'Invalid username or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(79,70,229,0.08),_transparent_50%),_radial-gradient(ellipse_at_bottom_left,_rgba(79,70,229,0.04),_transparent_50%)] pointer-events-none" />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-4 mx-auto bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-lg" style={{ boxShadow: '0 0 24px rgba(79,70,229,0.15)' }}>
            <img src="/codearmor.png" alt="" className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">CodeArmor</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to your account</p>
        </div>

        <div className="bg-slate-800/40 backdrop-blur-xl rounded-lg border border-slate-700/50 shadow-xl">
          <div className="flex p-1.5 gap-1 bg-slate-900/50 border-b border-slate-700/50 rounded-t-lg">
            <button
              onClick={() => { setIsSignup(false); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isSignup ? 'bg-slate-700/80 text-white shadow-sm border border-slate-600/50' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsSignup(true); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isSignup ? 'bg-slate-700/80 text-white shadow-sm border border-slate-600/50' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Register
            </button>
          </div>

          <div className="p-6">
            {callbackUrl && (
              <div className="bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs px-3.5 py-2.5 rounded-md mb-4 flex items-center gap-2">
                <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Authenticating extension request...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-400/20 rounded-md mb-4 flex items-start gap-2.5 px-4 py-3 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-md mb-4 px-4 py-3 text-xs text-emerald-300 font-medium">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-xs text-slate-400 font-medium mb-1.5">Username</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required autoFocus autoComplete="username"
                    placeholder="Enter your username"
                    className="w-full bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 rounded-md px-3 py-2 pl-10 text-sm transition-all duration-150 focus:outline-none focus:border-armor-primary focus:ring-2 focus:ring-armor-primary/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs text-slate-400 font-medium mb-1.5">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    placeholder="Enter your password"
                    className="w-full bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 rounded-md px-3 py-2 pl-10 text-sm transition-all duration-150 focus:outline-none focus:border-armor-primary focus:ring-2 focus:ring-armor-primary/20"
                  />
                </div>
              </div>

              {isSignup && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-xs text-slate-400 font-medium mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required autoComplete="new-password"
                      placeholder="Confirm your password"
                      className="w-full bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 rounded-md px-3 py-2 pl-10 text-sm transition-all duration-150 focus:outline-none focus:border-armor-primary focus:ring-2 focus:ring-armor-primary/20"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-primary py-2.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Processing...</span>
                  </>
                ) : (
                  isSignup ? 'Create Account' : 'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          CodeArmor v1.0.0
        </p>
      </div>
    </div>
  );
}
