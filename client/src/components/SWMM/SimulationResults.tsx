import React, { useState, useMemo } from 'react';

interface SimulationResultsProps {
  inpContent: string;
  rptContent: string;
  onClose: () => void;
}

type Tab = 'inp' | 'rpt' | 'analysis';

interface ParsedSummary {
  runoffSummary: { name: string; precip: string; runoff: string; peak: string }[];
  nodeSummary: { name: string; type: string; maxDepth: string; maxHGL: string; timeMax: string; reported: string }[];
  linkSummary: { name: string; type: string; maxFlow: string; maxVel: string; maxDepth: string; timeMax: string }[];
  outfallLoading: { name: string; avgFlow: string; maxFlow: string; totalVol: string }[];
  flowRouting: Record<string, string>;
  errors: string[];
  warnings: string[];
  analysisStarted: string;
  analysisEnded: string;
  elapsed: string;
}

function parseRpt(rpt: string): ParsedSummary {
  const lines = rpt.split('\n');
  const result: ParsedSummary = {
    runoffSummary: [],
    nodeSummary: [],
    linkSummary: [],
    outfallLoading: [],
    flowRouting: {},
    errors: [],
    warnings: [],
    analysisStarted: '',
    analysisEnded: '',
    elapsed: '',
  };

  let section = '';
  let pastDashes = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/analysis begun on/i.test(trimmed)) {
      result.analysisStarted = trimmed.replace(/.*analysis begun on\s*:?\s*/i, '').replace(/\.*$/, '');
    }
    if (/analysis ended on/i.test(trimmed)) {
      result.analysisEnded = trimmed.replace(/.*analysis ended on\s*:?\s*/i, '').replace(/\.*$/, '');
    }
    if (/total elapsed time/i.test(trimmed)) {
      result.elapsed = trimmed.replace(/.*total elapsed time\s*:?\s*/i, '').trim();
    }
    if (/^(ERROR|Error)/i.test(trimmed)) {
      result.errors.push(trimmed);
    }
    if (/^(WARNING|Warning)/i.test(trimmed)) {
      result.warnings.push(trimmed);
    }

    if (/Subcatchment Runoff Summary/i.test(trimmed)) {
      section = 'runoff'; pastDashes = false; continue;
    }
    if (/Node Depth Summary/i.test(trimmed)) {
      section = 'nodeDepth'; pastDashes = false; continue;
    }
    if (/Link Flow Summary/i.test(trimmed)) {
      section = 'linkFlow'; pastDashes = false; continue;
    }
    if (/Outfall Loading Summary/i.test(trimmed)) {
      section = 'outfall'; pastDashes = false; continue;
    }
    if (/Flow Routing Continuity/i.test(trimmed)) {
      section = 'flowRouting'; pastDashes = false; continue;
    }

    if (section && /^-{10,}/.test(trimmed)) {
      pastDashes = true;
      continue;
    }

    if (section && pastDashes && trimmed === '') {
      section = '';
      pastDashes = false;
      continue;
    }

    if (!section || !pastDashes || trimmed === '' || /^\*/.test(trimmed)) continue;

    const tokens = trimmed.split(/\s+/).filter(t => t.length > 0);

    switch (section) {
      case 'runoff': {
        if (tokens.length >= 10 && !isNaN(parseFloat(tokens[1]))) {
          result.runoffSummary.push({
            name: tokens[0],
            precip: tokens[1],
            runoff: tokens[7],
            peak: tokens[9],
          });
        }
        break;
      }
      case 'nodeDepth': {
        if (tokens.length >= 7 && !isNaN(parseFloat(tokens[2]))) {
          result.nodeSummary.push({
            name: tokens[0],
            type: tokens[1],
            maxDepth: tokens[3],
            maxHGL: tokens[4],
            timeMax: tokens[5] + ' ' + tokens[6],
            reported: tokens.length > 7 ? tokens[7] : '',
          });
        }
        break;
      }
      case 'linkFlow': {
        if (tokens.length >= 7 && !isNaN(parseFloat(tokens[2]))) {
          result.linkSummary.push({
            name: tokens[0],
            type: tokens[1],
            maxFlow: tokens[2],
            maxVel: tokens[5],
            maxDepth: tokens.length > 7 ? tokens[7] : tokens[6],
            timeMax: tokens[3] + ' ' + tokens[4],
          });
        }
        break;
      }
      case 'outfall': {
        if (tokens.length >= 4 && !isNaN(parseFloat(tokens[1])) && tokens[0] !== 'System') {
          result.outfallLoading.push({
            name: tokens[0],
            avgFlow: tokens[2],
            maxFlow: tokens[3],
            totalVol: tokens.length > 4 ? tokens[4] : '0',
          });
        }
        break;
      }
      case 'flowRouting': {
        const m = trimmed.match(/^(.+?)\s*\.{2,}\s*(.+)$/);
        if (m) {
          result.flowRouting[m[1].trim()] = m[2].trim();
        }
        break;
      }
    }
  }

  return result;
}

function BarChart({ data, labelKey, valueKey, color, title }: {
  data: Record<string, string>[];
  labelKey: string;
  valueKey: string;
  color: string;
  title: string;
}) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => parseFloat(d[valueKey]) || 0), 0.001);

  return (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ color: '#55FF55', fontFamily: '"Press Start 2P", monospace', fontSize: 10, marginBottom: 12 }}>
        {title}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.slice(0, 30).map((d, i) => {
          const val = parseFloat(d[valueKey]) || 0;
          const pct = (val / maxVal) * 100;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
              <span style={{ width: 120, textAlign: 'right', color: '#aaa', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d[labelKey]}
              </span>
              <div style={{ flex: 1, height: 14, background: '#222', border: '1px solid #444', position: 'relative' }}>
                <div style={{
                  width: `${Math.max(pct, 1)}%`,
                  height: '100%',
                  background: color,
                  transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ width: 70, color: '#ddd', fontFamily: 'monospace', fontSize: 9 }}>
                {d[valueKey]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SimulationResults({ inpContent, rptContent, onClose }: SimulationResultsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const parsed = useMemo(() => parseRpt(rptContent), [rptContent]);

  const tabStyle = (tab: Tab) => ({
    padding: '6px 16px',
    background: activeTab === tab ? '#333' : '#111',
    color: activeTab === tab ? '#55FF55' : '#888',
    border: activeTab === tab ? '2px solid #55FF55' : '2px solid #555',
    borderBottom: activeTab === tab ? 'none' : '2px solid #555',
    cursor: 'pointer' as const,
    fontFamily: '"Press Start 2P", monospace',
    fontSize: 9,
    textTransform: 'uppercase' as const,
  });

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.9)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
      }}
      data-testid="sim-results-overlay"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 14,
          color: '#55FF55',
          textShadow: '0 0 8px #00ff00',
        }}>
          SWMM5 ENGINE RESULTS
        </h2>
        <button
          onClick={onClose}
          data-testid="button-close-results"
          style={{
            background: '#7a1a1a',
            color: '#ff4444',
            border: '2px solid #ff4444',
            padding: '6px 16px',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          CLOSE [X]
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #555' }}>
        <button style={tabStyle('analysis')} onClick={() => setActiveTab('analysis')} data-testid="tab-analysis">
          Analysis
        </button>
        <button style={tabStyle('rpt')} onClick={() => setActiveTab('rpt')} data-testid="tab-rpt">
          Raw .RPT
        </button>
        <button style={tabStyle('inp')} onClick={() => setActiveTab('inp')} data-testid="tab-inp">
          Raw .INP
        </button>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        background: '#111',
        border: '2px solid #555',
        borderTop: 'none',
        padding: 16,
      }}>
        {activeTab === 'inp' && (
          <pre style={{ color: '#ddd', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap', lineHeight: 1.4 }} data-testid="text-inp-content">
            {inpContent}
          </pre>
        )}

        {activeTab === 'rpt' && (
          <pre style={{ color: '#ddd', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap', lineHeight: 1.4 }} data-testid="text-rpt-content">
            {rptContent}
          </pre>
        )}

        {activeTab === 'analysis' && (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}>
              <div style={{ background: '#1a1a2e', border: '2px solid #333', padding: 12 }}>
                <div style={{ color: '#888', fontFamily: '"Press Start 2P", monospace', fontSize: 8, marginBottom: 4 }}>STATUS</div>
                <div style={{ color: parsed.errors.length > 0 ? '#ff4444' : '#55FF55', fontFamily: '"Press Start 2P", monospace', fontSize: 12 }}>
                  {parsed.errors.length > 0 ? 'ERRORS FOUND' : 'COMPLETE'}
                </div>
              </div>
              <div style={{ background: '#1a1a2e', border: '2px solid #333', padding: 12 }}>
                <div style={{ color: '#888', fontFamily: '"Press Start 2P", monospace', fontSize: 8, marginBottom: 4 }}>STARTED</div>
                <div style={{ color: '#ddd', fontFamily: 'monospace', fontSize: 11 }}>{parsed.analysisStarted || 'N/A'}</div>
              </div>
              <div style={{ background: '#1a1a2e', border: '2px solid #333', padding: 12 }}>
                <div style={{ color: '#888', fontFamily: '"Press Start 2P", monospace', fontSize: 8, marginBottom: 4 }}>ELAPSED</div>
                <div style={{ color: '#ddd', fontFamily: 'monospace', fontSize: 11 }}>{parsed.elapsed || 'N/A'}</div>
              </div>
              <div style={{ background: '#1a1a2e', border: '2px solid #333', padding: 12 }}>
                <div style={{ color: '#888', fontFamily: '"Press Start 2P", monospace', fontSize: 8, marginBottom: 4 }}>WARNINGS</div>
                <div style={{ color: parsed.warnings.length > 0 ? '#FFFF55' : '#55FF55', fontFamily: '"Press Start 2P", monospace', fontSize: 12 }}>
                  {parsed.warnings.length}
                </div>
              </div>
            </div>

            {parsed.errors.length > 0 && (
              <div style={{ background: '#2a0000', border: '2px solid #ff4444', padding: 12, marginBottom: 16 }}>
                <h4 style={{ color: '#ff4444', fontFamily: '"Press Start 2P", monospace', fontSize: 10, marginBottom: 8 }}>ERRORS</h4>
                {parsed.errors.map((e, i) => (
                  <div key={i} style={{ color: '#ff8888', fontFamily: 'monospace', fontSize: 11, marginBottom: 4 }}>{e}</div>
                ))}
              </div>
            )}

            {parsed.warnings.length > 0 && (
              <div style={{ background: '#2a2a00', border: '2px solid #FFFF55', padding: 12, marginBottom: 16 }}>
                <h4 style={{ color: '#FFFF55', fontFamily: '"Press Start 2P", monospace', fontSize: 10, marginBottom: 8 }}>WARNINGS</h4>
                {parsed.warnings.slice(0, 20).map((w, i) => (
                  <div key={i} style={{ color: '#dddd88', fontFamily: 'monospace', fontSize: 11, marginBottom: 4 }}>{w}</div>
                ))}
                {parsed.warnings.length > 20 && (
                  <div style={{ color: '#888', fontSize: 10 }}>... and {parsed.warnings.length - 20} more</div>
                )}
              </div>
            )}

            {Object.keys(parsed.flowRouting).length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#55FF55', fontFamily: '"Press Start 2P", monospace', fontSize: 10, marginBottom: 12 }}>
                  FLOW ROUTING CONTINUITY
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
                  <tbody>
                    {Object.entries(parsed.flowRouting).map(([key, val], i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                        <td style={{ color: '#aaa', padding: '4px 12px 4px 0' }}>{key}</td>
                        <td style={{ color: '#ddd', padding: 4, textAlign: 'right' }}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <BarChart
              data={parsed.runoffSummary}
              labelKey="name"
              valueKey="peak"
              color="#4488ff"
              title="SUBCATCHMENT PEAK RUNOFF"
            />

            {parsed.nodeSummary.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#55FF55', fontFamily: '"Press Start 2P", monospace', fontSize: 10, marginBottom: 12 }}>
                  NODE DEPTH SUMMARY
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #555' }}>
                        <th style={{ color: '#888', padding: 6, textAlign: 'left' }}>Node</th>
                        <th style={{ color: '#888', padding: 6, textAlign: 'left' }}>Type</th>
                        <th style={{ color: '#888', padding: 6, textAlign: 'right' }}>Max Depth</th>
                        <th style={{ color: '#888', padding: 6, textAlign: 'right' }}>Max HGL</th>
                        <th style={{ color: '#888', padding: 6, textAlign: 'right' }}>Time Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.nodeSummary.slice(0, 50).map((n, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ color: '#ddd', padding: 6 }}>{n.name}</td>
                          <td style={{ color: '#aaa', padding: 6 }}>{n.type}</td>
                          <td style={{ color: '#4488ff', padding: 6, textAlign: 'right' }}>{n.maxDepth}</td>
                          <td style={{ color: '#44bbff', padding: 6, textAlign: 'right' }}>{n.maxHGL}</td>
                          <td style={{ color: '#888', padding: 6, textAlign: 'right' }}>{n.timeMax}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.nodeSummary.length > 50 && (
                    <div style={{ color: '#888', fontSize: 10, padding: 4 }}>Showing 50 of {parsed.nodeSummary.length} nodes</div>
                  )}
                </div>
              </div>
            )}

            <BarChart
              data={parsed.linkSummary}
              labelKey="name"
              valueKey="maxFlow"
              color="#44cc44"
              title="LINK MAX FLOW"
            />

            {parsed.linkSummary.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#55FF55', fontFamily: '"Press Start 2P", monospace', fontSize: 10, marginBottom: 12 }}>
                  LINK FLOW SUMMARY TABLE
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #555' }}>
                        <th style={{ color: '#888', padding: 6, textAlign: 'left' }}>Link</th>
                        <th style={{ color: '#888', padding: 6, textAlign: 'left' }}>Type</th>
                        <th style={{ color: '#888', padding: 6, textAlign: 'right' }}>Max Flow</th>
                        <th style={{ color: '#888', padding: 6, textAlign: 'right' }}>Max Vel</th>
                        <th style={{ color: '#888', padding: 6, textAlign: 'right' }}>Max Depth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.linkSummary.slice(0, 50).map((l, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ color: '#ddd', padding: 6 }}>{l.name}</td>
                          <td style={{ color: '#aaa', padding: 6 }}>{l.type}</td>
                          <td style={{ color: '#44cc44', padding: 6, textAlign: 'right' }}>{l.maxFlow}</td>
                          <td style={{ color: '#44bbcc', padding: 6, textAlign: 'right' }}>{l.maxVel}</td>
                          <td style={{ color: '#4488ff', padding: 6, textAlign: 'right' }}>{l.maxDepth}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.linkSummary.length > 50 && (
                    <div style={{ color: '#888', fontSize: 10, padding: 4 }}>Showing 50 of {parsed.linkSummary.length} links</div>
                  )}
                </div>
              </div>
            )}

            {parsed.outfallLoading.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#55FF55', fontFamily: '"Press Start 2P", monospace', fontSize: 10, marginBottom: 12 }}>
                  OUTFALL LOADING
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 10 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #555' }}>
                        <th style={{ color: '#888', padding: 6, textAlign: 'left' }}>Outfall</th>
                        <th style={{ color: '#888', padding: 6, textAlign: 'right' }}>Avg Flow</th>
                        <th style={{ color: '#888', padding: 6, textAlign: 'right' }}>Max Flow</th>
                        <th style={{ color: '#888', padding: 6, textAlign: 'right' }}>Total Vol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.outfallLoading.map((o, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ color: '#ddd', padding: 6 }}>{o.name}</td>
                          <td style={{ color: '#44cc44', padding: 6, textAlign: 'right' }}>{o.avgFlow}</td>
                          <td style={{ color: '#ff8844', padding: 6, textAlign: 'right' }}>{o.maxFlow}</td>
                          <td style={{ color: '#4488ff', padding: 6, textAlign: 'right' }}>{o.totalVol}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
