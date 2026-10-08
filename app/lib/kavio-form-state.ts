const DRAFT_PREFIX = 'kavio_form_draft:';
const PENDING_KEY = 'kavio_form_draft_pending';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

type DraftValue = string | string[];

type DraftField = {
  name: string;
  index: number;
  value: DraftValue;
  checked?: boolean;
};

type DraftSnapshot = {
  version: 1;
  savedAt: number;
  fields: DraftField[];
};

type PendingDraft = {
  key: string;
  pathname: string;
};

type PersistableControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function storageKey(key: string) {
  return `${DRAFT_PREFIX}${key}`;
}

function isPersistable(element: Element): element is PersistableControl {
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLSelectElement) &&
    !(element instanceof HTMLTextAreaElement)
  ) return false;

  if (!element.name || element.dataset.kavioNoPersist === 'true') return false;

  if (element instanceof HTMLInputElement) {
    const blocked = new Set(['password', 'file', 'hidden', 'submit', 'button', 'reset', 'image']);
    if (blocked.has(element.type)) return false;
  }

  return true;
}

function controls(root: HTMLElement) {
  return Array.from(root.querySelectorAll('input[name], select[name], textarea[name]')).filter(isPersistable);
}

function fieldIdentity(name: string, index: number) {
  return `${name}\u0000${index}`;
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const ownSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
  const prototypeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (prototypeSetter && ownSetter !== prototypeSetter) {
    prototypeSetter.call(element, value);
  } else if (ownSetter) {
    ownSetter.call(element, value);
  } else {
    element.value = value;
  }
}

function setNativeChecked(element: HTMLInputElement, checked: boolean) {
  const prototype = Object.getPrototypeOf(element);
  const ownSetter = Object.getOwnPropertyDescriptor(element, 'checked')?.set;
  const prototypeSetter = Object.getOwnPropertyDescriptor(prototype, 'checked')?.set;

  if (prototypeSetter && ownSetter !== prototypeSetter) {
    prototypeSetter.call(element, checked);
  } else if (ownSetter) {
    ownSetter.call(element, checked);
  } else {
    element.checked = checked;
  }
}

function dispatchRestoreEvents(element: PersistableControl) {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function saveKavioFormDraft(key: string, root: HTMLElement) {
  const storage = getStorage();
  if (!storage || !key) return;

  const nameCounts = new Map<string, number>();
  const fields: DraftField[] = [];

  for (const element of controls(root)) {
    const index = nameCounts.get(element.name) ?? 0;
    nameCounts.set(element.name, index + 1);

    if (element instanceof HTMLSelectElement && element.multiple) {
      fields.push({
        name: element.name,
        index,
        value: Array.from(element.selectedOptions).map((option) => option.value),
      });
      continue;
    }

    if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) {
      fields.push({
        name: element.name,
        index,
        value: element.value,
        checked: element.checked,
      });
      continue;
    }

    fields.push({
      name: element.name,
      index,
      value: element.value,
    });
  }

  const snapshot: DraftSnapshot = {
    version: 1,
    savedAt: Date.now(),
    fields,
  };

  storage.setItem(storageKey(key), JSON.stringify(snapshot));
}

export function restoreKavioFormDraft(key: string, root: HTMLElement) {
  const storage = getStorage();
  if (!storage || !key) return false;

  const raw = storage.getItem(storageKey(key));
  if (!raw) return false;

  let snapshot: DraftSnapshot;
  try {
    snapshot = JSON.parse(raw) as DraftSnapshot;
  } catch {
    storage.removeItem(storageKey(key));
    return false;
  }

  if (
    snapshot.version !== 1 ||
    !Array.isArray(snapshot.fields) ||
    Date.now() - Number(snapshot.savedAt || 0) > MAX_AGE_MS
  ) {
    storage.removeItem(storageKey(key));
    return false;
  }

  const saved = new Map(
    snapshot.fields.map((field) => [fieldIdentity(field.name, field.index), field]),
  );
  const nameCounts = new Map<string, number>();
  let restored = false;

  for (const element of controls(root)) {
    const index = nameCounts.get(element.name) ?? 0;
    nameCounts.set(element.name, index + 1);

    const field = saved.get(fieldIdentity(element.name, index));
    if (!field) continue;

    if (element instanceof HTMLSelectElement) {
      if (element.multiple && Array.isArray(field.value)) {
        const selected = new Set(field.value);
        Array.from(element.options).forEach((option) => {
          option.selected = selected.has(option.value);
        });
      } else if (typeof field.value === 'string') {
        element.value = field.value;
      }
      dispatchRestoreEvents(element);
      restored = true;
      continue;
    }

    if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) {
      setNativeChecked(element, Boolean(field.checked));
      dispatchRestoreEvents(element);
      restored = true;
      continue;
    }

    if (typeof field.value === 'string') {
      setNativeValue(element, field.value);
      dispatchRestoreEvents(element);
      restored = true;
    }
  }

  return restored;
}

export function markKavioFormDraftPending(key: string, pathname: string) {
  const storage = getStorage();
  if (!storage || !key) return;
  const pending: PendingDraft = { key, pathname };
  storage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function clearKavioFormDraft(key: string) {
  const storage = getStorage();
  if (!storage || !key) return;

  storage.removeItem(storageKey(key));

  const rawPending = storage.getItem(PENDING_KEY);
  if (!rawPending) return;

  try {
    const pending = JSON.parse(rawPending) as PendingDraft;
    if (pending.key === key) storage.removeItem(PENDING_KEY);
  } catch {
    storage.removeItem(PENDING_KEY);
  }
}

export function clearPendingKavioFormDraft(pathname: string) {
  const storage = getStorage();
  if (!storage) return;

  const raw = storage.getItem(PENDING_KEY);
  if (!raw) return;

  try {
    const pending = JSON.parse(raw) as PendingDraft;
    if (!pending?.key || pending.pathname !== pathname) return;
    clearKavioFormDraft(pending.key);
  } catch {
    storage.removeItem(PENDING_KEY);
  }
}
