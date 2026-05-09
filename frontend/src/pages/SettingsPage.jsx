import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Avatar from '../components/Avatar';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [backups, setBackups] = useState([]);
  const [addModal, setAddModal] = useState(false);
  const [notifyConfig, setNotifyConfig] = useState({ telegram_chat_id: '', events: [] });
  const [form, setForm] = useState({ name: '', role: 'child', color: '#FF9800', pin_required: false, pin: '', password: '' });
  const photoRef = useRef();

  useEffect(() => { load(); }, []);
  async function load() {
    const [usersRes, backupsRes, notifyRes] = await Promise.all([
      api.get('/users'),
      api.get('/backup'),
      api.get('/notify').catch(() => ({ data: {} })),
    ]);
    setUsers(usersRes.data);
    setBackups(backupsRes.data);
    setNotifyConfig(prev => ({ ...prev, ...(notifyRes.data || {}) }));
  }

  async function addUser() {
    const r = await api.post('/users', form);
    if (photoRef.current?.files[0] && r.data.id) {
      const fd = new FormData();
      fd.append('photo', photoRef.current.files[0]);
      await api.post(`/users/${r.data.id}/photo`, fd);
    }
    toast(`${form.name} hinzugefügt!`, 'success');
    setForm({ name: '', role: 'child', color: '#FF9800', pin_required: false, pin: '', password: '' });
    setAddModal(false);
    load();
  }

  async function deleteUser(uid) {
    if (!confirm('Wirklich löschen? Alle Daten werden gelöscht.')) return;
    await api.delete(`/users/${uid}`);
    load();
  }

  async function doBackup() {
    await api.post('/backup');
    toast('Backup erstellt! 💾', 'success');
    load();
  }

  async function saveNotify() {
    await api.post('/notify', notifyConfig);
    toast('Benachrichtigungen gespeichert!', 'success');
  }

  const COLORS = ['#4F86C6', '#FF9800', '#43A047', '#E53935', '#9C27B0', '#00BCD4', '#FF5722', '#795548'];

  return (
    <div className="page">
      <h1 className="page-title">⚙️ Einstellungen</h1>

      {/* Users */}
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold">👨‍👩‍👧 Benutzer</h2>
          <button className="btn-primary" style={{ padding: '8px 14px' }} onClick={() => setAddModal(true)}>+ Hinzufügen</button>
        </div>
        <div className="flex flex-col gap-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Avatar user={u} size={40} />
                <div>
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-sm text-muted">{u.role === 'parent' ? 'Elternteil' : 'Kind'}{u.pin_required ? ' · PIN' : ''}</div>
                </div>
              </div>
              {u.id !== user.id && (
                <button style={{ background: '#fee2e2', color: '#991b1b', padding: '6px 10px', borderRadius: 8, fontSize: '0.8rem' }}
                  onClick={() => deleteUser(u.id)}>Löschen</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="card mb-4">
        <h2 className="font-bold mb-3">🔔 Telegram-Benachrichtigungen</h2>
        <div className="flex flex-col gap-2">
          <input placeholder="Telegram Chat ID" value={notifyConfig.telegram_chat_id || ''}
            onChange={e => setNotifyConfig(n => ({ ...n, telegram_chat_id: e.target.value }))} />
          <p className="text-sm text-muted">Bot-Token wird in der .env Datei gesetzt. Chat-ID findest du über @userinfobot auf Telegram.</p>
          <button className="btn-primary" onClick={saveNotify}>Speichern</button>
        </div>
      </div>

      {/* Backup */}
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold">💾 Backups</h2>
          <button className="btn-primary" style={{ padding: '8px 14px' }} onClick={doBackup}>Jetzt sichern</button>
        </div>
        <div className="flex flex-col gap-2">
          {backups.slice(0, 5).map(b => (
            <div key={b.id} className="flex justify-between items-center">
              <div className="text-sm">{new Date(b.created_at).toLocaleString('de-CH')}</div>
              <a href={`/api/backup/download/${b.filename}`} download>
                <button style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: 8, fontSize: '0.8rem' }}>↓ Download</button>
              </a>
            </div>
          ))}
          {backups.length === 0 && <p className="text-muted text-sm">Noch kein Backup vorhanden</p>}
        </div>
      </div>

      {/* Logout */}
      <button className="btn-danger w-full" onClick={logout}>Abmelden</button>

      {/* Add user modal */}
      <Modal open={addModal} title="Benutzer hinzufügen" onClose={() => setAddModal(false)}>
        <div className="flex flex-col gap-3">
          <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="child">Kind</option>
            <option value="parent">Elternteil</option>
          </select>
          <div>
            <label className="text-sm font-semibold mb-1" style={{ display: 'block' }}>Farbe</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: form.color === c ? '3px solid #1a1a2e' : '3px solid transparent' }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted">Profilbild</label>
            <input type="file" ref={photoRef} accept="image/*" style={{ padding: 8 }} />
          </div>
          {form.role === 'parent' && (
            <input type="password" placeholder="Passwort" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          )}
          {form.role === 'child' && (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.pin_required} onChange={e => setForm(f => ({ ...f, pin_required: e.target.checked }))} />
                <span className="text-sm">PIN erforderlich</span>
              </label>
              {form.pin_required && (
                <input type="number" placeholder="PIN (z.B. 1234)" value={form.pin}
                  onChange={e => setForm(f => ({ ...f, pin: e.target.value }))} />
              )}
            </>
          )}
          <button className="btn-primary w-full" onClick={addUser}>Hinzufügen</button>
        </div>
      </Modal>
    </div>
  );
}
