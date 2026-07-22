import React, { useState } from 'react';
import { useAccounts, useActiveAccount, useTrackedAssets } from '../../hooks/useAccounts.js';
import { createAccountApi, deleteAccountApi, renameAccountApi, saveTrackedAssetsApi } from '../../api/accounts.js';
import { DEMO_MODE } from '../../api/demoFetch.js';
import './AccountsCard.css';

const COLOR_OPTIONS = ['#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#F44336', '#00BCD4', '#E91E63', '#607D8B'];

export default function AccountsCard() {
  const { accounts, mutate: mutateAccounts } = useAccounts();
  const { activeAccount, mutate: mutateActive } = useActiveAccount();
  const { trackedAssets, mutate: mutateTracked } = useTrackedAssets();

  const [editingId,     setEditingId]     = useState(null);
  const [deletingId,    setDeletingId]    = useState(null);
  const [editName,      setEditName]      = useState('');
  const [editColor,     setEditColor]     = useState('');
  const [creating,      setCreating]      = useState(false);
  const [newName,       setNewName]       = useState('');
  const [newColor,      setNewColor]      = useState('#4CAF50');
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');
  const [trackedInput,  setTrackedInput]  = useState('');
  const [trackedOpen,   setTrackedOpen]   = useState(false);

  const refresh = () => { mutateAccounts(); mutateActive(); };

  async function handleAddTracked() {
    const t = trackedInput.trim().toUpperCase();
    if (!t || !activeAccount || trackedAssets.includes(t)) {
      setTrackedOpen(false); setTrackedInput(''); return;
    }
    await saveTrackedAssetsApi(activeAccount.id, [...trackedAssets, t]);
    mutateTracked();
    setTrackedInput(''); setTrackedOpen(false);
  }

  async function handleRemoveTracked(ticker) {
    if (!activeAccount) return;
    await saveTrackedAssetsApi(activeAccount.id, trackedAssets.filter(t => t !== ticker));
    mutateTracked();
  }

  const startEdit = (acct) => {
    setDeletingId(null);
    setEditingId(acct.id);
    setEditName(acct.name);
    setEditColor(acct.color ?? '#4CAF50');
    setError('');
  };
  const cancelEdit = () => { setEditingId(null); setError(''); };

  const saveEdit = async (id) => {
    if (!editName.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      await renameAccountApi(id, editName.trim(), undefined, editColor);
      setEditingId(null);
      refresh();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const startDelete = (id) => { setEditingId(null); setDeletingId(id); setError(''); };
  const cancelDelete = () => { setDeletingId(null); setError(''); };

  const confirmDelete = async (id) => {
    setSaving(true);
    try {
      await deleteAccountApi(id);
      setDeletingId(null);
      refresh();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const saveNew = async () => {
    if (!newName.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      await createAccountApi(newName.trim(), '', newColor);
      setCreating(false);
      setNewName('');
      setNewColor('#4CAF50');
      refresh();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const isOnlyAccount = accounts.length <= 1;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="section-title">Accounts</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
        Manage multiple portfolio accounts. Switch between them from the header.
      </p>

      <div className="acct-list">
        {accounts.map((acct) => {
          const isActive = acct.id === activeAccount?.id;

          if (editingId === acct.id) {
            return (
              <div key={acct.id} className="acct-row acct-row--editing">
                <input
                  className="acct-name-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(acct.id); if (e.key === 'Escape') cancelEdit(); }}
                  autoFocus
                />
                <div className="acct-color-swatches">
                  {COLOR_OPTIONS.map((c) => (
                    <button key={c} className={`acct-swatch${editColor === c ? ' acct-swatch--selected' : ''}`}
                      style={{ background: c }} onClick={() => setEditColor(c)} title={c} />
                  ))}
                </div>
                <div className="acct-row-actions">
                  <button className="wizard-btn wizard-btn--next" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => saveEdit(acct.id)} disabled={saving}>Save</button>
                  <button className="wizard-btn wizard-btn--back" style={{ fontSize: 12, padding: '4px 10px' }} onClick={cancelEdit} disabled={saving}>Cancel</button>
                </div>
              </div>
            );
          }

          if (deletingId === acct.id) {
            return (
              <div key={acct.id} className="acct-row acct-row--deleting">
                <span className="acct-delete-msg">Delete "{acct.name}"? This cannot be undone.</span>
                <div className="acct-row-actions">
                  <button className="wizard-btn" style={{ fontSize: 12, padding: '4px 10px', background: 'var(--red, #f87171)', color: '#fff', border: 'none' }} onClick={() => confirmDelete(acct.id)} disabled={saving}>Delete</button>
                  <button className="wizard-btn wizard-btn--back" style={{ fontSize: 12, padding: '4px 10px' }} onClick={cancelDelete} disabled={saving}>Cancel</button>
                </div>
              </div>
            );
          }

          return (
            <div key={acct.id} className={`acct-row${isActive ? ' acct-row--active' : ''}`}>
              <span className="acct-dot" style={{ background: acct.color ?? '#4CAF50' }} />
              <span className="acct-name">{acct.name}</span>
              {isActive && <span className="acct-active-badge">active</span>}
              <div className="acct-row-actions">
                {!DEMO_MODE && (
                  <button className="acct-icon-btn" onClick={() => startEdit(acct)} title="Rename">✎</button>
                )}
                {isOnlyAccount
                  ? <span className="acct-icon-btn acct-icon-btn--disabled" title="Cannot delete the only account">🗑</span>
                  : <button className="acct-icon-btn acct-icon-btn--danger" onClick={() => startDelete(acct.id)} title="Delete">🗑</button>
                }
              </div>
            </div>
          );
        })}
      </div>

      {error && <p style={{ color: 'var(--red, #f87171)', fontSize: 12, marginTop: 8 }}>{error}</p>}

      {/* Tracked assets section */}
      <div className="card" style={{ marginTop: 20, marginBottom: 0 }}>
        <div className="section-title" style={{ fontSize: 13 }}>Tracked Assets</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
          Extra tickers tracked on the Intelligence Feed for this account.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: trackedOpen ? 10 : 0 }}>
          {trackedAssets.map((t) => (
            <span key={t} className="acct-tracked-chip">
              {t}
              {!DEMO_MODE && (
                <button
                  className="acct-tracked-remove"
                  onClick={() => handleRemoveTracked(t)}
                  title={`Stop tracking ${t}`}
                >×</button>
              )}
            </span>
          ))}
        </div>
        {!DEMO_MODE && (trackedOpen ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
            <input
              className="acct-name-input"
              style={{ maxWidth: 120, fontSize: 12 }}
              value={trackedInput}
              onChange={(e) => setTrackedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTracked();
                if (e.key === 'Escape') { setTrackedOpen(false); setTrackedInput(''); }
              }}
              placeholder="e.g. ASML"
              autoFocus
            />
            <button className="wizard-btn wizard-btn--next" style={{ fontSize: 12, padding: '4px 10px' }} onClick={handleAddTracked}>Add</button>
            <button className="wizard-btn wizard-btn--back" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { setTrackedOpen(false); setTrackedInput(''); }}>Cancel</button>
          </div>
        ) : (
          <button className="wizard-btn wizard-btn--back" style={{ fontSize: 12, marginTop: trackedAssets.length > 0 ? 8 : 0 }}
            onClick={() => setTrackedOpen(true)}>
            + Track asset
          </button>
        ))}
      </div>

      {!DEMO_MODE && (creating ? (
        <div className="acct-new-form">
          <input
            className="acct-name-input"
            placeholder="Account name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveNew(); if (e.key === 'Escape') { setCreating(false); setNewName(''); setError(''); } }}
            autoFocus
          />
          <div className="acct-color-swatches">
            {COLOR_OPTIONS.map((c) => (
              <button key={c} className={`acct-swatch${newColor === c ? ' acct-swatch--selected' : ''}`}
                style={{ background: c }} onClick={() => setNewColor(c)} title={c} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="wizard-btn wizard-btn--next" style={{ fontSize: 12, padding: '4px 10px' }} onClick={saveNew} disabled={saving}>Create</button>
            <button className="wizard-btn wizard-btn--back" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { setCreating(false); setNewName(''); setError(''); }} disabled={saving}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="wizard-btn wizard-btn--back" style={{ fontSize: 12, marginTop: 12 }}
          onClick={() => { setCreating(true); setError(''); }}>
          + New Account
        </button>
      ))}
    </div>
  );
}
