'use client';

type ServerAction = (formData: FormData) => void | Promise<void>;

export default function KavioConfirmAction({
  action,
  confirmMessage,
  label,
  className = 'kavio-button secondary',
  hidden,
}: {
  action: ServerAction;
  confirmMessage: string;
  label: string;
  className?: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={className}>{label}</button>
    </form>
  );
}
