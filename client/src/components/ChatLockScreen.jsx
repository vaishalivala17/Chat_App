import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ChatLockScreen({ onUnlock }) {
  const { API } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await API.post('/auth/verify-lock', { pin });
      if (data.valid) {
        sessionStorage.setItem('chat_unlocked', '1');
        onUnlock();
      } else {
        setError('Incorrect PIN');
        setPin('');
      }
    } catch {
      setError('Could not verify PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-base flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-cyan flex items-center justify-center text-2xl font-bold mb-6">🔒</div>
      <h2 className="text-xl font-semibold mb-2">Chat locked</h2>
      <p className="text-muted text-sm mb-6 text-center">Enter your PIN to open PULSE</p>
      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="4-6 digit PIN"
          className="input-base text-center text-lg tracking-widest"
          autoFocus
        />
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <button type="submit" disabled={pin.length < 4 || loading} className="btn-primary">
          {loading ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
