import { useState } from 'react';

type FormState = { name: string; email: string; message: string };

function FloatField({
  id, label, value, onChange, type = 'text', multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  multiline?: boolean;
}) {
  const filled = !!value;
  const commonProps = {
    id,
    value,
    onChange,
    required: true,
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
  const [submitted, setSubmitted] = useState(false);

  const update = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setState(s => ({ ...s, [k]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <form onSubmit={onSubmit} className={`contact-form${submitted ? ' is-sent' : ''}`}>
      <FloatField id="cf-name"    label="Your name"            value={state.name}    onChange={update('name')} />
      <FloatField id="cf-email"   label="Email"                value={state.email}   onChange={update('email')} type="email" />
      <FloatField id="cf-message" label="What's on your mind?" value={state.message} onChange={update('message')} multiline />
      <div className="form-row">
        <button type="submit" className="btn btn-primary form-submit" disabled={submitted}>
          <span>{submitted ? 'Sent — talk soon' : 'Send message'}</span>
          <span className="btn-arrow">{submitted ? '✓' : '→'}</span>
        </button>
        <span className="form-hint">No autoresponders, no funnels.</span>
      </div>
    </form>
  );
}
