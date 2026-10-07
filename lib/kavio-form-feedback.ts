import { redirect } from 'next/navigation';

type KavioFormFeedbackOptions = {
  form?: string;
  focus?: string;
  params?: Record<string, string | number | boolean | null | undefined>;
};

export function redirectKavioFormError(
  path: string,
  message: string,
  options: KavioFormFeedbackOptions = {},
): never {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }

  if (options.form) query.set('form', options.form);
  if (options.focus) query.set('focus', options.focus);
  query.set('error', message);

  redirect(`${path}?${query.toString()}`);
}
