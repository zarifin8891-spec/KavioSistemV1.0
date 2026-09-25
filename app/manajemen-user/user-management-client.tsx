'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { formatKavioDate } from '../lib/date-format';

type UserRow = {
  user_id: string;
  email: string | null;
  nama: string | null;
  role: string;
  status_aktif: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

const ROLES = ['DIREKTUR', 'ADMIN', 'MARKETING', 'PELAKSANA', 'USER'] as const;

const roleLabel = (role: string) => {
  const labels: Record<string, string> = {
    DIREKTUR: 'DIREKTUR',
    ADMIN: 'ADMIN',
    MARKETING: 'MARKETING',
    PELAKSANA: 'PELAKSANA',
    USER: 'USER',
  };
  return labels[role] ?? role;
};

export default function UserManagementClient() {
  const supabase = createClient();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [query, setQuery] = useState('');

  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('USER');
  const [statusAktif, setStatusAktif] = useState(true);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('kavio-user-admin', {
      body: { action: 'list' },
    });

    if (invokeError) {
      setError(invokeError.message || 'Gagal memuat pengguna.');
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data?.data ?? []) as UserRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.nama, row.email, row.role].some((value) => String(value ?? '').toLowerCase().includes(q))
    );
  }, [query, rows]);

  const resetForm = () => {
    setNama('');
    setEmail('');
    setRole('USER');
    setStatusAktif(true);
    setPassword('');
    setNewPassword('');
    setEditing(null);
    setPasswordUser(null);
    setShowCreate(false);
  };

  const startEdit = (row: UserRow) => {
    setError('');
    setMessage('');
    setEditing(row);
    setShowCreate(false);
    setNama(row.nama ?? '');
    setEmail(row.email ?? '');
    setRole((ROLES.includes(row.role as (typeof ROLES)[number]) ? row.role : 'USER') as (typeof ROLES)[number]);
    setStatusAktif(row.status_aktif);
    setPassword('');
    setNewPassword('');
    setPasswordUser(null);
  };

  const startPasswordChange = (row: UserRow) => {
    setError('');
    setMessage('');
    setEditing(null);
    setShowCreate(false);
    setPasswordUser(row);
    setNewPassword('');
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const { data, error: invokeError } = await supabase.functions.invoke('kavio-user-admin', {
      body: {
        action: 'create',
        email,
        password,
        nama,
        role,
      },
    });

    if (invokeError || data?.error) {
      setError(invokeError?.message || data?.error || 'Gagal membuat pengguna.');
      setSaving(false);
      return;
    }

    setMessage('Pengguna berhasil dibuat.');
    resetForm();
    await loadUsers();
    setSaving(false);
  };

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordUser) return;

    setSaving(true);
    setError('');
    setMessage('');

    const { data, error: invokeError } = await supabase.functions.invoke('kavio-user-admin', {
      body: {
        action: 'set_password',
        user_id: passwordUser.user_id,
        password: newPassword,
      },
    });

    if (invokeError || data?.error) {
      setError(invokeError?.message || data?.error || 'Gagal mengganti password.');
      setSaving(false);
      return;
    }

    setMessage(`Password untuk ${passwordUser.email || 'pengguna'} berhasil diganti.`);
    setNewPassword('');
    setPasswordUser(null);
    setSaving(false);
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;

    setSaving(true);
    setError('');
    setMessage('');

    const { data, error: invokeError } = await supabase.functions.invoke('kavio-user-admin', {
      body: {
        action: 'update_profile',
        user_id: editing.user_id,
        nama,
        role,
        status_aktif: statusAktif,
      },
    });

    if (invokeError || data?.error) {
      setError(invokeError?.message || data?.error || 'Gagal menyimpan pengguna.');
      setSaving(false);
      return;
    }

    setMessage('Profil pengguna berhasil diperbarui.');
    resetForm();
    await loadUsers();
    setSaving(false);
  };

  return (
    <main className="manajemen-user-page">
      <section className="kavio-panel">
        <div className="kavio-panel-head">
          <div>
            <h2 className="kavio-panel-title">DAFTAR PENGGUNA</h2>
            <div className="kavio-panel-note">Kelola akun, nama pengguna, dan role akses KAVIO.</div>
          </div>
          <div className="manajemen-user-head-actions">
            <span className="kavio-badge">{filteredRows.length} USER</span>
            <button type="button" className="kavio-command-button" onClick={() => { resetForm(); setShowCreate(true); }}>
              + TAMBAH USER
            </button>
          </div>
        </div>

        <div className="manajemen-user-toolbar">
          <input
            className="manajemen-user-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="CARI NAMA / EMAIL / ROLE..."
          />
          <button type="button" className="kavio-button secondary" onClick={loadUsers} disabled={loading}>
            {loading ? 'MEMUAT...' : 'REFRESH'}
          </button>
        </div>

        {message && <div className="manajemen-user-alert success">{message}</div>}
        {error && <div className="manajemen-user-alert error">{error}</div>}

        <div className="kavio-table-wrap">
          <table className="kavio-table manajemen-user-table">
            <thead>
              <tr>
                <th>NO</th>
                <th>NAMA</th>
                <th>EMAIL</th>
                <th>ROLE</th>
                <th>STATUS</th>
                <th>TERAKHIR LOGIN</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="kavio-empty">MEMUAT DATA PENGGUNA...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={7} className="kavio-empty">TIDAK ADA DATA PENGGUNA.</td></tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr key={row.user_id}>
                    <td>{index + 1}</td>
                    <td>{row.nama || '—'}</td>
                    <td>{row.email || '—'}</td>
                    <td><span className="kavio-badge">{roleLabel(row.role)}</span></td>
                    <td><span className={`kavio-badge user-status-badge ${row.status_aktif ? 'is-active' : 'is-inactive'}`}>{row.status_aktif ? 'AKTIF' : 'NONAKTIF'}</span></td>
                    <td>{formatKavioDate(row.last_sign_in_at)}</td>
                    <td>
                      <div className="user-row-actions">
                        <button type="button" className="kavio-button secondary user-edit-button" onClick={() => startEdit(row)}>EDIT</button>
                        <button type="button" className="kavio-button secondary user-password-button" onClick={() => startPasswordChange(row)}>PASSWORD</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {passwordUser && (
        <section className="kavio-panel manajemen-user-form-panel">
          <div className="kavio-panel-head">
            <div>
              <h2 className="kavio-panel-title">GANTI PASSWORD</h2>
              <div className="kavio-panel-note">
                Ubah password untuk {passwordUser.nama || passwordUser.email || 'pengguna'}.
              </div>
            </div>
            <button type="button" className="kavio-button secondary" onClick={resetForm}>TUTUP</button>
          </div>

          <form className="kavio-form manajemen-user-form" onSubmit={handlePasswordChange}>
            <label className="kavio-field">
              <span>EMAIL</span>
              <input value={passwordUser.email || ''} disabled />
            </label>

            <label className="kavio-field">
              <span>PASSWORD BARU</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Minimal 8 karakter"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>

            <div className="kavio-form-note">
              <strong>Catatan:</strong> password baru langsung berlaku untuk login berikutnya.
            </div>

            <div className="kavio-actions">
              <button type="button" className="kavio-button secondary" onClick={resetForm} disabled={saving}>BATAL</button>
              <button type="submit" className="kavio-button" disabled={saving}>
                {saving ? 'MENYIMPAN...' : 'GANTI PASSWORD'}
              </button>
            </div>
          </form>
        </section>
      )}

      {(showCreate || editing) && (
        <section className="kavio-panel manajemen-user-form-panel">
          <div className="kavio-panel-head">
            <div>
              <h2 className="kavio-panel-title">{editing ? 'EDIT PENGGUNA' : 'TAMBAH PENGGUNA'}</h2>
              <div className="kavio-panel-note">
                {editing ? 'Perbarui identitas dan role pengguna.' : 'Buat akun login baru untuk pengguna KAVIO.'}
              </div>
            </div>
            <button type="button" className="kavio-button secondary" onClick={resetForm}>TUTUP</button>
          </div>

          <form className="kavio-form manajemen-user-form" onSubmit={editing ? handleUpdate : handleCreate}>
            <label className="kavio-field">
              <span>NAMA PENGGUNA</span>
              <input value={nama} onChange={(event) => setNama(event.target.value)} placeholder="Nama pengguna" required />
            </label>

            <label className="kavio-field">
              <span>EMAIL</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@perusahaan.com"
                required
                disabled={Boolean(editing)}
              />
            </label>

            <label className="kavio-field">
              <span>ROLE</span>
              <select value={role} onChange={(event) => setRole(event.target.value as (typeof ROLES)[number])}>
                {ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            {editing && (
              <label className="kavio-field">
                <span>STATUS</span>
                <select value={statusAktif ? 'AKTIF' : 'NONAKTIF'} onChange={(event) => setStatusAktif(event.target.value === 'AKTIF')}>
                  <option value="AKTIF">AKTIF</option>
                  <option value="NONAKTIF">NONAKTIF</option>
                </select>
              </label>
            )}

            {!editing && (
              <label className="kavio-field">
                <span>PASSWORD AWAL</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimal 8 karakter"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </label>
            )}

            <div className="kavio-form-note">
              <strong>Catatan:</strong> akun baru langsung dikonfirmasi oleh sistem. Pengguna dapat login setelah akun dibuat.
            </div>

            <div className="kavio-actions">
              <button type="button" className="kavio-button secondary" onClick={resetForm} disabled={saving}>BATAL</button>
              <button type="submit" className="kavio-button" disabled={saving}>
                {saving ? 'MENYIMPAN...' : editing ? 'SIMPAN PERUBAHAN' : 'BUAT USER'}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
