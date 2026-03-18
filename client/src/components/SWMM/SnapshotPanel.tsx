import React, { useState } from 'react';
import { SWMMState } from '@/lib/swmm-types';

export interface Snapshot {
  id: string;
  name: string;
  timestamp: number;
  model: SWMMState;
}

interface SnapshotPanelProps {
  snapshots: Snapshot[];
  currentModel: SWMMState;
  onSave: (name: string) => void;
  onRestore: (snapshot: Snapshot) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

type View = 'list' | 'compare';

interface DiffStats {
  nodesAdded: number;
  nodesRemoved: number;
  linksAdded: number;
  linksRemoved: number;
  subsAdded: number;
  subsRemoved: number;
  nodesModified: number;
  linksModified: number;
  subsModified: number;
}

function computeDiff(a: SWMMState, b: SWMMState): DiffStats {
  const aNodeIds = new Set(a.nodes.map(n => n.id));
  const bNodeIds = new Set(b.nodes.map(n => n.id));
  const aLinkIds = new Set(a.links.map(l => l.id));
  const bLinkIds = new Set(b.links.map(l => l.id));
  const aSubIds = new Set(a.subcatchments.map(s => s.id));
  const bSubIds = new Set(b.subcatchments.map(s => s.id));

  let nodesModified = 0;
  for (const n of b.nodes) {
    if (aNodeIds.has(n.id)) {
      const old = a.nodes.find(x => x.id === n.id)!;
      if (old.invertElev !== n.invertElev || old.maxDepth !== n.maxDepth || old.x !== n.x || old.y !== n.y || old.type !== n.type) {
        nodesModified++;
      }
    }
  }

  let linksModified = 0;
  for (const l of b.links) {
    if (aLinkIds.has(l.id)) {
      const old = a.links.find(x => x.id === l.id)!;
      if (old.diameter !== l.diameter || old.roughness !== l.roughness || old.length !== l.length || old.fromNode !== l.fromNode || old.toNode !== l.toNode) {
        linksModified++;
      }
    }
  }

  let subsModified = 0;
  for (const s of b.subcatchments) {
    if (aSubIds.has(s.id)) {
      const old = a.subcatchments.find(x => x.id === s.id)!;
      if (old.area !== s.area || old.percentImperv !== s.percentImperv || old.outletNode !== s.outletNode) {
        subsModified++;
      }
    }
  }

  return {
    nodesAdded: b.nodes.filter(n => !aNodeIds.has(n.id)).length,
    nodesRemoved: a.nodes.filter(n => !bNodeIds.has(n.id)).length,
    linksAdded: b.links.filter(l => !aLinkIds.has(l.id)).length,
    linksRemoved: a.links.filter(l => !bLinkIds.has(l.id)).length,
    subsAdded: b.subcatchments.filter(s => !aSubIds.has(s.id)).length,
    subsRemoved: a.subcatchments.filter(s => !bSubIds.has(s.id)).length,
    nodesModified,
    linksModified,
    subsModified,
  };
}

function DiffBadge({ value, type }: { value: number; type: 'added' | 'removed' | 'modified' }) {
  if (value === 0) return null;
  const colors = {
    added: { bg: '#0a3a0a', color: '#55FF55', prefix: '+' },
    removed: { bg: '#3a0a0a', color: '#FF5555', prefix: '-' },
    modified: { bg: '#3a3a0a', color: '#FFFF55', prefix: '~' },
  };
  const c = colors[type];
  return (
    <span style={{
      background: c.bg,
      color: c.color,
      padding: '1px 6px',
      fontSize: 8,
      fontFamily: '"Press Start 2P", monospace',
      border: `1px solid ${c.color}40`,
    }}>
      {c.prefix}{value}
    </span>
  );
}

function CompareView({ snapA, snapB, onBack }: { snapA: Snapshot; snapB: Snapshot; onBack: () => void }) {
  const diff = computeDiff(snapA.model, snapB.model);
  const totalChanges = diff.nodesAdded + diff.nodesRemoved + diff.linksAdded + diff.linksRemoved + diff.subsAdded + diff.subsRemoved + diff.nodesModified + diff.linksModified + diff.subsModified;

  const rows = [
    { label: 'Nodes', a: snapA.model.nodes.length, b: snapB.model.nodes.length, added: diff.nodesAdded, removed: diff.nodesRemoved, modified: diff.nodesModified },
    { label: 'Links', a: snapA.model.links.length, b: snapB.model.links.length, added: diff.linksAdded, removed: diff.linksRemoved, modified: diff.linksModified },
    { label: 'Subcatchments', a: snapA.model.subcatchments.length, b: snapB.model.subcatchments.length, added: diff.subsAdded, removed: diff.subsRemoved, modified: diff.subsModified },
  ];

  const avgElevA = snapA.model.nodes.length > 0 ? (snapA.model.nodes.reduce((s, n) => s + n.invertElev, 0) / snapA.model.nodes.length) : 0;
  const avgElevB = snapB.model.nodes.length > 0 ? (snapB.model.nodes.reduce((s, n) => s + n.invertElev, 0) / snapB.model.nodes.length) : 0;
  const totalLenA = snapA.model.links.reduce((s, l) => s + l.length, 0);
  const totalLenB = snapB.model.links.reduce((s, l) => s + l.length, 0);
  const avgDiamA = snapA.model.links.length > 0 ? (snapA.model.links.reduce((s, l) => s + (l.diameter || 0), 0) / snapA.model.links.length) : 0;
  const avgDiamB = snapB.model.links.length > 0 ? (snapB.model.links.reduce((s, l) => s + (l.diameter || 0), 0) / snapB.model.links.length) : 0;
  const totalAreaA = snapA.model.subcatchments.reduce((s, sc) => s + sc.area, 0);
  const totalAreaB = snapB.model.subcatchments.reduce((s, sc) => s + sc.area, 0);

  return (
    <div>
      <button
        onClick={onBack}
        data-testid="button-compare-back"
        style={{
          background: '#222',
          color: '#aaa',
          border: '1px solid #555',
          padding: '4px 10px',
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 7,
          cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        BACK
      </button>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        marginBottom: 16,
      }}>
        <div style={{ background: '#1a1a2e', border: '2px solid #4488CC', padding: 8 }}>
          <div style={{ color: '#4488CC', fontFamily: '"Press Start 2P", monospace', fontSize: 7, marginBottom: 4 }}>SNAPSHOT A</div>
          <div style={{ color: '#ddd', fontFamily: '"Press Start 2P", monospace', fontSize: 9 }}>{snapA.name}</div>
          <div style={{ color: '#666', fontSize: 9, marginTop: 2 }}>{new Date(snapA.timestamp).toLocaleString()}</div>
        </div>
        <div style={{ background: '#1a2e1a', border: '2px solid #44CC44', padding: 8 }}>
          <div style={{ color: '#44CC44', fontFamily: '"Press Start 2P", monospace', fontSize: 7, marginBottom: 4 }}>SNAPSHOT B</div>
          <div style={{ color: '#ddd', fontFamily: '"Press Start 2P", monospace', fontSize: 9 }}>{snapB.name}</div>
          <div style={{ color: '#666', fontSize: 9, marginTop: 2 }}>{new Date(snapB.timestamp).toLocaleString()}</div>
        </div>
      </div>

      <div style={{
        background: totalChanges === 0 ? '#1a2e1a' : '#2e2e1a',
        border: `2px solid ${totalChanges === 0 ? '#44CC44' : '#CCCC44'}`,
        padding: 8,
        marginBottom: 16,
        textAlign: 'center',
      }}>
        <span style={{ color: totalChanges === 0 ? '#55FF55' : '#FFFF55', fontFamily: '"Press Start 2P", monospace', fontSize: 10 }}>
          {totalChanges === 0 ? 'IDENTICAL' : `${totalChanges} CHANGES`}
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10, marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #444' }}>
            <th style={{ color: '#888', padding: 6, textAlign: 'left' }}>Element</th>
            <th style={{ color: '#4488CC', padding: 6, textAlign: 'right' }}>A</th>
            <th style={{ color: '#44CC44', padding: 6, textAlign: 'right' }}>B</th>
            <th style={{ color: '#888', padding: 6, textAlign: 'right' }}>Changes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} style={{ borderBottom: '1px solid #333' }}>
              <td style={{ color: '#ddd', padding: 6 }}>{r.label}</td>
              <td style={{ color: '#4488CC', padding: 6, textAlign: 'right' }}>{r.a}</td>
              <td style={{ color: '#44CC44', padding: 6, textAlign: 'right' }}>{r.b}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>
                <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <DiffBadge value={r.added} type="added" />
                  <DiffBadge value={r.removed} type="removed" />
                  <DiffBadge value={r.modified} type="modified" />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 8, color: '#55FF55', marginBottom: 8 }}>
        ENGINEERING METRICS
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #444' }}>
            <th style={{ color: '#888', padding: 6, textAlign: 'left' }}>Metric</th>
            <th style={{ color: '#4488CC', padding: 6, textAlign: 'right' }}>A</th>
            <th style={{ color: '#44CC44', padding: 6, textAlign: 'right' }}>B</th>
            <th style={{ color: '#888', padding: 6, textAlign: 'right' }}>Delta</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: 'Avg Elev (ft)', a: avgElevA, b: avgElevB },
            { label: 'Total Pipe Length (ft)', a: totalLenA, b: totalLenB },
            { label: 'Avg Diameter (ft)', a: avgDiamA, b: avgDiamB },
            { label: 'Total Catchment Area (ac)', a: totalAreaA, b: totalAreaB },
          ].map(m => {
            const delta = m.b - m.a;
            return (
              <tr key={m.label} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ color: '#ddd', padding: 6 }}>{m.label}</td>
                <td style={{ color: '#4488CC', padding: 6, textAlign: 'right' }}>{m.a.toFixed(1)}</td>
                <td style={{ color: '#44CC44', padding: 6, textAlign: 'right' }}>{m.b.toFixed(1)}</td>
                <td style={{ color: delta === 0 ? '#666' : delta > 0 ? '#55FF55' : '#FF5555', padding: 6, textAlign: 'right' }}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SnapshotPanel({ snapshots, currentModel, onSave, onRestore, onDelete, onClose }: SnapshotPanelProps) {
  const [view, setView] = useState<View>('list');
  const [newName, setNewName] = useState('');
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleSave = () => {
    const name = newName.trim() || `Snapshot ${snapshots.length + 1}`;
    onSave(name);
    setNewName('');
  };

  const handleCompare = () => {
    if (compareA && compareB) {
      setView('compare');
    }
  };

  const snapA = snapshots.find(s => s.id === compareA);
  const snapB = snapshots.find(s => s.id === compareB);

  const mcFont = { fontFamily: '"Press Start 2P", monospace' };

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col p-3 sm:p-5"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      data-testid="snapshot-panel"
    >
      <div className="flex justify-between items-center mb-3 gap-2">
        <h2 className="text-xs sm:text-sm" style={{ ...mcFont, color: '#FFAA00', textShadow: '0 0 8px #ff8800' }}>
          SNAPSHOTS
        </h2>
        <button
          onClick={onClose}
          data-testid="button-close-snapshots"
          style={{
            background: '#7a1a1a',
            color: '#ff4444',
            border: '2px solid #ff4444',
            padding: '6px 16px',
            ...mcFont,
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          CLOSE [X]
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', flex: 1, overflow: 'auto' }}>
        {view === 'compare' && snapA && snapB ? (
          <CompareView snapA={snapA} snapB={snapB} onBack={() => setView('list')} />
        ) : (
          <>
            <div style={{
              background: '#1a1a1a',
              border: '2px solid #555',
              padding: 12,
              marginBottom: 16,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Snapshot name..."
                data-testid="input-snapshot-name"
                style={{
                  flex: 1,
                  background: '#000',
                  color: '#ddd',
                  border: '2px inset #555',
                  padding: '6px 10px',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSave}
                disabled={currentModel.nodes.length === 0}
                data-testid="button-save-snapshot"
                style={{
                  background: currentModel.nodes.length === 0 ? '#333' : '#1a5c1a',
                  color: currentModel.nodes.length === 0 ? '#666' : '#55FF55',
                  border: '2px solid #44CC44',
                  padding: '6px 16px',
                  ...mcFont,
                  fontSize: 8,
                  cursor: currentModel.nodes.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                SAVE SNAPSHOT
              </button>
            </div>

            <div style={{
              background: '#0a0a0a',
              border: '2px solid #333',
              padding: 8,
              marginBottom: 16,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}>
              <span style={{ ...mcFont, fontSize: 7, color: '#888' }}>COMPARE:</span>
              <select
                value={compareA || ''}
                onChange={e => setCompareA(e.target.value || null)}
                data-testid="select-compare-a"
                style={{
                  background: '#111',
                  color: '#4488CC',
                  border: '1px solid #4488CC',
                  padding: '4px 8px',
                  fontFamily: 'monospace',
                  fontSize: 11,
                }}
              >
                <option value="">Select A...</option>
                {snapshots.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <span style={{ color: '#555', ...mcFont, fontSize: 8 }}>VS</span>
              <select
                value={compareB || ''}
                onChange={e => setCompareB(e.target.value || null)}
                data-testid="select-compare-b"
                style={{
                  background: '#111',
                  color: '#44CC44',
                  border: '1px solid #44CC44',
                  padding: '4px 8px',
                  fontFamily: 'monospace',
                  fontSize: 11,
                }}
              >
                <option value="">Select B...</option>
                {snapshots.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                onClick={handleCompare}
                disabled={!compareA || !compareB || compareA === compareB}
                data-testid="button-compare"
                style={{
                  background: (!compareA || !compareB || compareA === compareB) ? '#333' : '#3a1a5c',
                  color: (!compareA || !compareB || compareA === compareB) ? '#666' : '#CC88FF',
                  border: '2px solid #8844CC',
                  padding: '4px 12px',
                  ...mcFont,
                  fontSize: 7,
                  cursor: (!compareA || !compareB || compareA === compareB) ? 'not-allowed' : 'pointer',
                }}
              >
                COMPARE
              </button>
            </div>

            {snapshots.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: 40,
                color: '#555',
                ...mcFont,
                fontSize: 9,
              }}>
                No snapshots yet. Build a network and save your first snapshot!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {snapshots.map(snap => {
                  const diff = computeDiff(snap.model, currentModel);
                  const totalChanges = diff.nodesAdded + diff.nodesRemoved + diff.linksAdded + diff.linksRemoved + diff.subsAdded + diff.subsRemoved + diff.nodesModified + diff.linksModified + diff.subsModified;

                  return (
                    <div
                      key={snap.id}
                      data-testid={`snapshot-card-${snap.id}`}
                      style={{
                        background: '#1a1a1a',
                        border: '2px solid #444',
                        padding: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ ...mcFont, fontSize: 10, color: '#FFAA00', marginBottom: 4 }}>
                          {snap.name}
                        </div>
                        <div style={{ color: '#666', fontSize: 10, marginBottom: 6 }}>
                          {new Date(snap.timestamp).toLocaleString()}
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 9, color: '#aaa' }}>
                          <span>{snap.model.nodes.length} nodes</span>
                          <span>{snap.model.links.length} links</span>
                          <span>{snap.model.subcatchments.length} subs</span>
                        </div>
                        {totalChanges > 0 && (
                          <div style={{ marginTop: 6, display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ ...mcFont, fontSize: 6, color: '#888' }}>VS CURRENT:</span>
                            <DiffBadge value={diff.nodesAdded + diff.linksAdded + diff.subsAdded} type="added" />
                            <DiffBadge value={diff.nodesRemoved + diff.linksRemoved + diff.subsRemoved} type="removed" />
                            <DiffBadge value={diff.nodesModified + diff.linksModified} type="modified" />
                          </div>
                        )}
                        {totalChanges === 0 && (
                          <div style={{ marginTop: 6, ...mcFont, fontSize: 6, color: '#55FF55' }}>
                            MATCHES CURRENT
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button
                          onClick={() => onRestore(snap)}
                          data-testid={`button-restore-${snap.id}`}
                          style={{
                            background: '#1a3a5c',
                            color: '#55CCFF',
                            border: '1px solid #4488CC',
                            padding: '4px 10px',
                            ...mcFont,
                            fontSize: 7,
                            cursor: 'pointer',
                          }}
                        >
                          RESTORE
                        </button>
                        {confirmDelete === snap.id ? (
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button
                              onClick={() => { onDelete(snap.id); setConfirmDelete(null); }}
                              data-testid={`button-confirm-delete-${snap.id}`}
                              style={{
                                background: '#5c1a1a',
                                color: '#FF5555',
                                border: '1px solid #CC4444',
                                padding: '4px 6px',
                                ...mcFont,
                                fontSize: 6,
                                cursor: 'pointer',
                              }}
                            >
                              YES
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              style={{
                                background: '#333',
                                color: '#aaa',
                                border: '1px solid #555',
                                padding: '4px 6px',
                                ...mcFont,
                                fontSize: 6,
                                cursor: 'pointer',
                              }}
                            >
                              NO
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(snap.id)}
                            data-testid={`button-delete-${snap.id}`}
                            style={{
                              background: '#2a1a1a',
                              color: '#AA4444',
                              border: '1px solid #663333',
                              padding: '4px 10px',
                              ...mcFont,
                              fontSize: 7,
                              cursor: 'pointer',
                            }}
                          >
                            DELETE
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
