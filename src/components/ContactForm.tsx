import { useState } from 'react';

const ACCESS_KEY = import.meta.env.PUBLIC_WEB3FORMS_KEY as string | undefined;

type FormState = { name: string; email: string; message: string };
type Status = 'idle' | 'sending' | 'sent' | 'error';

function FloatField({
  id, label, value, onChange, type = 'text', multiline = false, disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  multiline?: boolean;
  disabled?: boolean;
}) {
  const filled = !!value;
  const commonProps = {
    id,
    value,
    onChange,
    required: true,
    disabled,
    className: 'float-input',
    placeholder: ' ',
  };
  return (
    <label className={`float-field${filled ? ' is-filled' : ''}`} htmlFor={id}>
      {multiline ? (
        <textarea {...commonProps} rows={4} />
      ) : (
        <input {...commonProps} type={type} autoComplete="off" />
      )}
      <span className="float-label">{label}</span>
      <span className="float-line" />
    </label>
  );
}

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
        setTimeout(() => setStatus('idle'), 4000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 4000);
      }
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const busy = status === 'sending' || status === 'sent';
  const sent = status === 'sent';
  const err  = status === 'error';

  return (
    <form onSubmit={onSubmit} className={`contact-form${sent ? ' is-sent' : ''}`}>
      <FloatField id="cf-name"    label="Your name"            value={state.name}    onChange={update('name')}    disabled={busy} />
      <FloatField id="cf-email"   label="Email"                value={state.email}   onChange={update('email')}   type="email" disabled={busy} />
      <FloatField id="cf-message" label="What's on your mind?" value={state.message} onChange={update('message')} multiline disabled={busy} />
      <div className="form-row">
        <button type="submit" className="btn btn-primary form-submit" disabled={busy}>
          <span>
            {status === 'sending' ? 'Sending…'
              : sent              ? 'Sent — talk soon'
              : err               ? 'Something went wrong'
              : 'Send message'}
          </span>
          <span className="btn-arrow">
            {status === 'sending' ? '' : sent ? '✓' : err ? '✕' : '→'}
          </span>
        </button>
        <span className="form-hint">No autoresponders, no funnels.</span>
      </div>
    </form>
  );
}
