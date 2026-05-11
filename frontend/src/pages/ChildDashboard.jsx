import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import ProgressBar from '../components/ProgressBar';
import Modal from '../components/Modal';
import Avatar from '../components/Avatar';
import PointsTimeline from '../components/PointsTimeline';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Hallo';
  return 'Guten Abend';
}

export default function ChildDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [claimModal, setClaimModal] = useState(null);
  const [newBadge, setNewBadge] = useState(null);

  const [settings, setSettings] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [dashRes, rewardsRes, settingsRes] = await Promise.all([
      api.get(`/users/${user.id}/dashboard`),
      api.get('/rewards'),
      api.get('/settings').catch(() => ({ data: {} })),
    ]);
    setData(dashRes.data);
    setRewards(rewardsRes.data);
    setSettings(settingsRes.data);
  }

  async function claimReward(reward) {
    try {
      await api.post(`/rewards/${reward.id}/claim`);
      toast('Belohnung beantragt! Eltern werden benachrichtigt 🎁', 'success');
      setClaimModal(null);
    } catch (err) {
      toast(err.response?.data?.error || 'Fehler', 'error');
    }
  }

  if (!data) return <div className="page text-center text-muted mt-4">Lädt...</div>;

  const points = data.points?.balance || 0;
  const balance = data.account?.balance || 0;
  const savings = data.account?.savings_balance || 0;
  const fleaTotal = data.fleaEarnings?.total || 0;
  const streak = data.points?.streak_weeks || 0;
  const showStreak = settings.show_streak !== 'false';
  const showBadges = settings.show_badges !== 'false';

  return (
    <div className="page">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Avatar user={user} size={64} />
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{greeting()}, {user.name}! 👋</h1>
          {showStreak && streak > 0 && <p style={{ color: 'var(--accent)', fontWeight: 700 }}>🔥 {streak} Wochen in Serie!</p>}
        </div>
      </div>

      {/* Main tiles */}
      <div className="grid-3 mb-4">
        <div className="card text-center">
          <div style={{ fontSize: '1.6rem' }}>💰</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)' }}>
            {balance.toFixed(2)}
          </div>
          <div className="text-sm text-muted">CHF</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: '1.6rem' }}>⭐</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent)' }}>
            {points}
          </div>
          <div className="text-sm text-muted">Punkte</div>
        </div>
        <div className="card text-center">
          <div style={{ fontSize: '1.6rem' }}>🏷️</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>
            {fleaTotal.toFixed(2)}
          </div>
          <div className="text-sm text-muted">Flohmarkt</div>
        </div>
      </div>

      {/* Savings */}
      {savings > 0 && (
        <div className="card mb-4" style={{ background: 'linear-gradient(135deg,#f0fff4,#e0f2fe)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: '1.3rem' }}>🐷</span>
            <span className="font-bold">Sparbüchse</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success)' }}>
            CHF {savings.toFixed(2)}
          </div>
        </div>
      )}

      {/* Savings goals */}
      {data.goals?.length > 0 && (
        <div className="card mb-4">
          <h2 className="font-bold mb-3">🎯 Sparziele</h2>
          <div className="flex flex-col gap-4">
            {data.goals.map(goal => {
              const pct = Math.min(100, (goal.current_amount / goal.target_amount) * 100);
              return (
                <div key={goal.id}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">{goal.name}</span>
                    {goal.achieved_at && <span className="tag tag-green">✓ Erreicht!</span>}
                  </div>
                  <ProgressBar value={goal.current_amount} max={goal.target_amount} />
                  <div className="flex justify-between mt-2 text-sm text-muted">
                    <span>CHF {goal.current_amount.toFixed(2)}</span>
                    <span>Ziel: CHF {goal.target_amount.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Points timeline */}
      {rewards.length > 0 && (
        <div className="card mb-4">
          <h2 className="font-bold mb-3">🗺️ Mein Weg zu den Wünschen</h2>
          <PointsTimeline points={points} rewards={rewards} />
        </div>
      )}

      {/* Rewards */}
      <div className="card mb-4">
        <h2 className="font-bold mb-3">🎁 Belohnungen</h2>
        <div className="flex flex-col gap-3">
          {rewards.map(r => {
            const canClaim = points >= r.points_required;
            const pct = Math.min(100, (points / r.points_required) * 100);
            return (
              <div key={r.id} style={{
                borderRadius: 14,
                border: `2px solid ${canClaim ? 'var(--success)' : '#e0e7ef'}`,
                padding: 14,
                background: canClaim ? '#f0fff4' : '#fff',
                transition: 'all 0.3s',
              }}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold">{r.image && <span>{r.image} </span>}{r.name}</span>
                    <div className="text-sm text-muted">
                      {canClaim ? '✅ Erreichbar!' : `Noch ${r.points_required - points} Punkte fehlen`}
                    </div>
                  </div>
                  <span className="tag" style={{ background: 'var(--accent)', color: '#fff' }}>
                    {r.points_required} ⭐
                  </span>
                </div>
                <ProgressBar value={points} max={r.points_required} />
                {canClaim && (
                  <button className="btn-primary w-full mt-3" onClick={() => setClaimModal(r)}>
                    Einlösen 🎉
                  </button>
                )}
              </div>
            );
          })}
          {rewards.length === 0 && <p className="text-muted text-center">Noch keine Belohnungen definiert</p>}
        </div>
      </div>

      {/* Badges */}
      {showBadges && data.badges?.length > 0 && (
        <div className="card mb-4">
          <h2 className="font-bold mb-3">🏆 Meine Abzeichen</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {data.badges.map(b => (
              <div key={b.id} title={b.description}
                style={{ background: '#f0f7ff', borderRadius: 14, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '1.4rem' }}>{b.icon}</span>
                <span className="font-semibold text-sm">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction history */}
      {data.recentTx?.length > 0 && (
        <div className="card mb-4">
          <h2 className="font-bold mb-3">📋 Einnahmen &amp; Ausgaben</h2>
          <div className="flex flex-col gap-3">
            {data.recentTx.map(tx => (
              <div key={tx.id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                <div className="flex justify-between items-start gap-2">
                  <div style={{ flex: 1 }}>
                    <div className="font-semibold text-sm">{tx.description}</div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {new Date(tx.created_at).toLocaleDateString('de-CH')}
                    </div>
                  </div>
                  <span className="font-bold" style={{ color: tx.amount >= 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                    {tx.amount >= 0 ? '+' : ''}CHF {Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
                {tx.receipt_photo && (
                  <a href={tx.receipt_photo} target="_blank" rel="noopener noreferrer">
                    <img src={tx.receipt_photo} alt="Beleg"
                      style={{ marginTop: 8, maxHeight: 100, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claim modal */}
      {claimModal && (
        <Modal open title="Belohnung einlösen?" onClose={() => setClaimModal(null)}>
          <div className="text-center mb-4">
            <div style={{ fontSize: '3rem' }}>🎁</div>
            <h2 className="font-bold mt-2">{claimModal.name}</h2>
            <p className="text-muted mt-1">Kostet {claimModal.points_required} Punkte</p>
            <p className="text-sm mt-2">Deine Eltern werden benachrichtigt und müssen die Belohnung genehmigen.</p>
          </div>
          <div className="flex gap-3">
            <button className="btn-ghost w-full" onClick={() => setClaimModal(null)}>Abbrechen</button>
            <button className="btn-primary w-full" onClick={() => claimReward(claimModal)}>Ja, einlösen! 🎉</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
