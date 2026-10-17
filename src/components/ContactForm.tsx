import { useState } from 'react';

const ACCESS_KEY = 'a81c2fdd-2752-4ebe-8f25-04a54324f012';

type FormState = { name: string; email: string; message: string };
type Status = 'idle' | 'sending' | 'sent' | 'error';

const STATUS_TEXT: Record<Status, string> = {
  idle: '',
  sending: 'Sending…',
  sent: "Sent. Thanks, I'll be in touch.",
  error: "That didn't go through. Try again, or reach me on LinkedIn.",
};

export default function ContactForm() {
  const [state, setState] = useState<FormState>({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<Status>('idle');

  const update = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setState(s => ({ ...s, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: `Portfolio contact from ${state.name}`,
          name: state.name,
          email: state.email,
          message: state.message,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('sent');
        setState({ name: '', email: '', message: '' });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
    setTimeout(() => setStatus('idle'), 6000);
  };

  const busy = status === 'sending';

  return (
    <form onSubmit={onSubmit} className="form">
      <div className="field">
        <label htmlFor="cf-name">Name</label>
        <input id="cf-name" value={state.name} onChange={update('name')} autoComplete="name" required disabled={busy} />
      </div>
      <div className="field">
        <label htmlFor="cf-email">Email</label>
        <input id="cf-email" type="email" value={state.email} onChange={update('email')} autoComplete="email" required disabled={busy} />
      </div>
      <div className="field wide">
        <label htmlFor="cf-message">What are you working on?</label>
        <textarea id="cf-message" value={state.message} onChange={update('message')} required disabled={busy} />
      </div>
      <div className="form-row">
        <button type="submit" className="btn" disabled={busy}>Send message</button>
        <span className={`form-status${status === 'error' ? ' is-error' : ''}`} role="status">{STATUS_TEXT[status]}</span>
      </div>
    </form>
  );
}
