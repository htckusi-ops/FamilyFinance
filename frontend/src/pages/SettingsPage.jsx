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
  const [tokens, setTokens] = useState([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState(null);
  const [haChildren, setHaChildren] = useState([]);
  const [famSettings, setFamSettings] = useState({});
  const photoRef = useRef();

  const haBaseUrl = `${window.location.protocol}//${window.location.hostname}:3001`;

  useEffect(() => { load(); }, []);
  async function load() {
    const [usersRes, backupsRes, notifyRes, tokensRes, settingsRes] = await Promise.all([
      api.get('/users'),
      api.get('/backup'),
      api.get('/notify').catch(() => ({ data: {} })),
      api.get('/tokens').catch(() => ({ data: [] })),
      api.get('/settings').catch(() => ({ data: {} })),
    ]);
    setUsers(usersRes.data);
    setBackups(backupsRes.data);
    setNotifyConfig(prev => ({ ...prev, ...(notifyRes.data || {}) }));
    setTokens(tokensRes.data);
    setHaChildren(usersRes.data.filter(u => u.role === 'child'));
    setFamSettings(settingsRes.data);
  }

  async function saveFamSetting(key, value) {
    await api.patch('/settings', { [key]: value });
    setFamSettings(s => ({ ...s, [key]: value }));
    toast('Einstellung gespeichert', 'success');
  }

  async function setAgeGroup(uid, group) {
    await api.patch(`/users/${uid}`, { age_group: group });
    load();
  }

  async function generateToken() {
    if (!newTokenName.trim()) return toast('Bitte einen Namen eingeben', 'error');
    const r = await api.post('/tokens', { name: newTokenName.trim() });
    setGeneratedToken(r.data.token);
    setNewTokenName('');
    toast('Token erstellt — einmalig sichtbar!', 'success');
    load();
  }

  async function revokeToken(id) {
    await api.delete(`/tokens/${id}`);
    toast('Token widerrufen', 'success');
    load();
  }

  function haYaml(token) {
    const lines = [`# FamilyFinance – Home Assistant Integration`, `# configuration.yaml`, ``];
    lines.push(`rest:`);
    lines.push(`  - resource: "${haBaseUrl}/api/ha/summary"`);
    lines.push(`    headers:`);
    lines.push(`      Authorization: "Bearer ${token}"`);
    lines.push(`    scan_interval: 300`);
    lines.push(`    sensor:`);
    haChildren.forEach(child => {
      lines.push(`      - name: "${child.name} Guthaben"`);
      lines.push(`        value_template: "{{ value_json.children | selectattr('id','eq',${child.id}) | map(attribute='balance') | first | round(2) }}"`);
      lines.push(`        unit_of_measurement: "CHF"`);
      lines.push(`      - name: "${child.name} Punkte"`);
      lines.push(`        value_template: "{{ value_json.children | selectattr('id','eq',${child.id}) | map(attribute='points') | first }}"`);
      lines.push(`        unit_of_measurement: "Pkt"`);
      lines.push(`      - name: "${child.name} Streak"`);
      lines.push(`        value_template: "{{ value_json.children | selectattr('id','eq',${child.id}) | map(attribute='streak_weeks') | first }}"`);
      lines.push(`        unit_of_measurement: "Wochen"`);
    });
    lines.push(``);
    lines.push(`panel_iframe:`);
    lines.push(`  familyfinance:`);
    lines.push(`    title: FamilyFinance`);
    lines.push(`    icon: mdi:piggy-bank`);
    lines.push(`    url: "${window.location.protocol}//${window.location.hostname}:3000"`);
    return lines.join('\n');
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
              {u.id !== user.id && !(u.role === 'parent' && users.filter(x => x.role === 'parent').length <= 1) && (
                <button style={{ background: '#fee2e2', color: '#991b1b', padding: '6px 10px', borderRadius: 8, fontSize: '0.8rem' }}
                  onClick={() => deleteUser(u.id)}>Löschen</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Point value */}
      <div className="card mb-4">
        <h2 className="font-bold mb-2">💱 Punkte-Wechselkurs</h2>
        <p className="text-sm text-muted mb-3">Wie viel ist 1 Punkt in CHF wert? (Basis für Punkte ↔ CHF Umtausch)</p>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm" style={{ whiteSpace: 'nowrap' }}>1 Punkt =</span>
          <input type="number" step="0.01" min="0.01"
            value={famSettings.point_value_chf || '0.10'}
            onChange={e => setFamSettings(s => ({ ...s, point_value_chf: e.target.value }))}
            style={{ maxWidth: 100 }} />
          <span className="font-semibold text-sm">CHF</span>
          <button className="btn-primary" style={{ padding: '8px 16px' }}
            onClick={() => saveFamSetting('point_value_chf', famSettings.point_value_chf || '0.10')}>
            Speichern
          </button>
        </div>
        <div className="text-sm text-muted mt-2">
          Beispiel: {Math.round(1 / (parseFloat(famSettings.point_value_chf) || 0.10))} Punkte = 1 CHF
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

      {/* Pedagogical settings */}
      <div className="card mb-4">
        <h2 className="font-bold mb-3">🎓 Pädagogische Einstellungen</h2>
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-sm">🔥 Streak anzeigen</div>
              <div className="text-muted" style={{ fontSize: '0.78rem' }}>Wochen-Streak für Kinder sichtbar machen</div>
            </div>
            <input type="checkbox"
              checked={famSettings.show_streak !== 'false'}
              onChange={e => saveFamSetting('show_streak', e.target.checked ? 'true' : 'false')} />
          </label>
          <label className="flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-sm">🏆 Badges anzeigen</div>
              <div className="text-muted" style={{ fontSize: '0.78rem' }}>Abzeichen im Kinder-Dashboard anzeigen</div>
            </div>
            <input type="checkbox"
              checked={famSettings.show_badges !== 'false'}
              onChange={e => saveFamSetting('show_badges', e.target.checked ? 'true' : 'false')} />
          </label>
        </div>

        {/* Age group per child */}
        {users.filter(u => u.role === 'child').length > 0 && (
          <div className="mt-4">
            <div className="font-semibold text-sm mb-2">Altersgruppe pro Kind</div>
            <div className="flex flex-col gap-2">
              {users.filter(u => u.role === 'child').map(child => (
                <div key={child.id} className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">{child.name}</span>
                  <select value={child.age_group || 'school'} onChange={e => setAgeGroup(child.id, e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '6px 10px' }}>
                    <option value="young">6–8 Jahre</option>
                    <option value="school">9–12 Jahre</option>
                    <option value="teen">13+ Jahre</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Home Assistant Integration */}
      <div className="card mb-4">
        <h2 className="font-bold mb-3">🏠 Home Assistant Integration</h2>

        {/* Token generator */}
        <div className="mb-4">
          <p className="text-sm text-muted mb-2">Langlebige API-Tokens für Home Assistant (läuft nie ab).</p>
          <div className="flex gap-2 mb-3">
            <input placeholder="Token-Name (z.B. Home Assistant)" value={newTokenName}
              onChange={e => setNewTokenName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateToken()} />
            <button className="btn-primary" style={{ padding: '10px 16px', whiteSpace: 'nowrap' }} onClick={generateToken}>
              Erstellen
            </button>
          </div>

          {/* Show generated token once */}
          {generatedToken && (
            <div style={{ background: '#f0fff4', border: '2px solid var(--success)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div className="font-semibold text-sm mb-1" style={{ color: 'var(--success)' }}>
                ✅ Token erstellt — nur einmal sichtbar!
              </div>
              <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', display: 'block', background: '#fff', padding: 8, borderRadius: 8 }}>
                {generatedToken}
              </code>
              <button className="btn-ghost w-full mt-2" style={{ fontSize: '0.85rem', padding: '8px' }}
                onClick={() => { navigator.clipboard?.writeText(generatedToken); toast('Kopiert!', 'success'); }}>
                📋 Kopieren
              </button>
              <div className="mt-3">
                <div className="font-semibold text-sm mb-1">configuration.yaml für Home Assistant:</div>
                <pre style={{ fontSize: '0.65rem', background: '#1a1a2e', color: '#a8d8a8', padding: 12, borderRadius: 8, overflow: 'auto', whiteSpace: 'pre-wrap', maxHeight: 300 }}>
                  {haYaml(generatedToken)}
                </pre>
                <button className="btn-ghost w-full mt-2" style={{ fontSize: '0.85rem', padding: '8px' }}
                  onClick={() => { navigator.clipboard?.writeText(haYaml(generatedToken)); toast('YAML kopiert!', 'success'); }}>
                  📋 YAML kopieren
                </button>
              </div>
            </div>
          )}

          {/* Existing tokens */}
          {tokens.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold text-muted">Aktive Tokens:</div>
              {tokens.map(t => (
                <div key={t.id} className="flex justify-between items-center" style={{ background: '#f8faff', padding: '8px 12px', borderRadius: 10 }}>
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                      Erstellt: {new Date(t.created_at).toLocaleDateString('de-CH')}
                      {t.last_used_at && ` · Zuletzt: ${new Date(t.last_used_at).toLocaleDateString('de-CH')}`}
                    </div>
                  </div>
                  <button style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: 8, fontSize: '0.8rem' }}
                    onClick={() => revokeToken(t.id)}>Widerrufen</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* HA API Endpoints Info */}
        <details>
          <summary className="font-semibold text-sm" style={{ cursor: 'pointer', color: 'var(--primary)' }}>
            📡 Verfügbare API-Endpunkte
          </summary>
          <div className="mt-2 flex flex-col gap-1" style={{ fontSize: '0.75rem' }}>
            {[
              ['GET', '/api/ha/summary', 'Alle Kinder (Guthaben, Punkte, Streak, Sparziele)'],
              ['GET', `/api/ha/child/:id`, 'Einzelnes Kind'],
              ['GET', '/api/ha/pending-claims', 'Offene Belohnungsanfragen'],
            ].map(([method, path, desc]) => (
              <div key={path} style={{ background: '#f0f4ff', borderRadius: 8, padding: '6px 10px' }}>
                <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: '0.65rem', marginRight: 6 }}>{method}</span>
                <code style={{ fontSize: '0.7rem' }}>{path}</code>
                <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: 2 }}>{desc}</div>
              </div>
            ))}
          </div>
        </details>
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
