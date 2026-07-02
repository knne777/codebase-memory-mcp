import { useMemo, useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { colorForLabel } from "../lib/colors";
import type { GraphNode, GraphEdge } from "../lib/types";
import { callTool } from "../api/rpc";
import { MermaidDiagram } from "./MermaidDiagram";
import { Loader2, GitBranch, Terminal } from "lucide-react";

interface Connection {
  node: GraphNode;
  edgeType: string;
  direction: "inbound" | "outbound";
}

interface NodeDetailPanelProps {
  node: GraphNode;
  project: string;
  allNodes: GraphNode[];
  allEdges: GraphEdge[];
  onClose: () => void;
  onNavigate: (node: GraphNode) => void;
}

export function NodeDetailPanel({ node, project, allNodes, allEdges, onClose, onNavigate }: NodeDetailPanelProps) {
  const [diagram, setDiagram] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canHaveDiagram = ["Function", "Method", "Route"].includes(node.label);

  const fetchDiagram = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callTool<{ text: string }>("generate_diagram", {
        project,
        function_name: node.qualified_name || node.name,
        type: "sequence",
        depth: 3
      });
      // The RPC client might return the string directly or wrapped
      const text = typeof result === "string" ? result : (result as any).text || JSON.stringify(result);
      setDiagram(text);
    } catch (err: any) {
      setError(err.message || "Failed to load diagram");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDiagram(null);
    setError(null);
  }, [node]);

  const connections = useMemo(() => {
    const nodeMap = new Map<number, GraphNode>();
    for (const n of allNodes) nodeMap.set(n.id, n);
    const conns: Connection[] = [];
    for (const edge of allEdges) {
      if (edge.source === node.id) {
        const t = nodeMap.get(edge.target);
        if (t) conns.push({ node: t, edgeType: edge.type, direction: "outbound" });
      }
      if (edge.target === node.id) {
        const s = nodeMap.get(edge.source);
        if (s) conns.push({ node: s, edgeType: edge.type, direction: "inbound" });
      }
    }
    return conns;
  }, [node, allNodes, allEdges]);

  const outbound = connections.filter((c) => c.direction === "outbound");
  const inbound = connections.filter((c) => c.direction === "inbound");

  const groupByType = (conns: Connection[]) => {
    const g = new Map<string, Connection[]>();
    for (const c of conns) g.set(c.edgeType, [...(g.get(c.edgeType) ?? []), c]);
    return [...g.entries()].sort((a, b) => b[1].length - a[1].length);
  };

  return (
    <div className="w-full bg-[#0b1920]/95 backdrop-blur-xl flex flex-col h-full min-h-0 overflow-hidden border-l border-white/5 shadow-2xl">
      {/* Header */}
      <div className="px-5 pt-6 pb-5 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-2.5 h-2.5 rounded-full ring-4 ring-black/20" style={{ backgroundColor: colorForLabel(node.label) }} />
              <h3 className="text-[15px] font-bold text-white truncate tracking-tight">{node.name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: colorForLabel(node.label) + "20", color: colorForLabel(node.label) }}
              >
                {node.label}
              </span>
              {node.properties_json && node.properties_json.includes('"is_business_logic":true') && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Business Logic
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all text-[20px] leading-none">×</button>
        </div>

        {node.file_path && (
          <div className="flex items-center gap-2 text-[11px] text-white/40 font-mono mt-3 px-3 py-2 bg-black/20 rounded-lg border border-white/[0.03]">
            <Terminal size={12} className="shrink-0" />
            <span className="truncate">{node.file_path}:{node.start_line}</span>
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-6 mt-5 px-1">
          {[
            { label: "Outbound", value: outbound.length, color: "text-blue-400" },
            { label: "Inbound", value: inbound.length, color: "text-emerald-400" },
            { label: "Total", value: connections.length, color: "text-white/60" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[9px] text-white/20 uppercase font-black tracking-[0.15em] mb-1">{s.label}</p>
              <p className={`text-[20px] font-black tabular-nums tracking-tight ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs / Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-5 space-y-8">
          {/* Flow Diagram Section */}
          {canHaveDiagram && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-bold text-white/50 uppercase tracking-widest">
                  <GitBranch size={14} className="text-primary" />
                  Functional Flow
                </div>
                {!diagram && !loading && (
                  <button
                    onClick={fetchDiagram}
                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold rounded-md border border-primary/20 transition-all uppercase tracking-wider"
                  >
                    Generate Diagram
                  </button>
                )}
              </div>

              {loading && (
                <div className="flex flex-col items-center justify-center py-12 bg-white/[0.02] rounded-xl border border-dashed border-white/5 gap-3">
                  <Loader2 className="animate-spin text-primary" size={24} />
                  <p className="text-[11px] text-white/30 font-medium">Analyzing functional execution paths...</p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400 font-medium leading-relaxed">
                  <span className="font-bold block mb-1">Analysis Error</span>
                  {error}
                </div>
              )}

              {diagram && (
                <div className="space-y-2">
                  <div className="flex items-center justify-end gap-2">
                     <button onClick={() => setDiagram(null)} className="text-[10px] text-white/20 hover:text-white/40 transition-colors uppercase font-bold">Clear</button>
                  </div>
                  <MermaidDiagram chart={diagram} />
                </div>
              )}
            </div>
          )}

          {/* Connections Sections */}
          {outbound.length > 0 && (
            <ConnectionSection title="Structural References" count={outbound.length} icon="→" groups={groupByType(outbound)} onNavigate={onNavigate} />
          )}
          {inbound.length > 0 && (
            <ConnectionSection title="Dependency Graph" count={inbound.length} icon="←" groups={groupByType(inbound)} onNavigate={onNavigate} />
          )}
          
          {connections.length === 0 && !canHaveDiagram && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.02] flex items-center justify-center text-white/10">
                <GitBranch size={24} />
              </div>
              <p className="text-[13px] font-medium text-white/20">No relationships discovered for this node</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ConnectionSection({ title, count, icon, groups, onNavigate }: {
  title: string; count: number; icon: string;
  groups: [string, Connection[]][];
  onNavigate: (n: GraphNode) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.15em]">
          {title}
        </p>
        <div className="h-px flex-1 bg-white/5" />
        <span className="text-[10px] font-black text-white/15 tabular-nums">{count}</span>
      </div>
      
      <div className="space-y-6">
        {groups.map(([type, conns]) => (
          <div key={type} className="space-y-2">
            <p className="text-[9px] text-white/25 uppercase font-black tracking-widest pl-1">
              {type.replace(/_/g, " ").toLowerCase()}
            </p>
            <div className="grid grid-cols-1 gap-1">
              {conns.slice(0, 25).map((c, i) => (
                <button
                  key={`${c.node.id}-${i}`}
                  onClick={() => onNavigate(c.node)}
                  className="flex items-center gap-3 w-full text-left p-2.5 rounded-xl hover:bg-white/[0.03] active:bg-white/[0.05] border border-transparent hover:border-white/5 text-[12px] transition-all group"
                >
                  <div className="w-6 h-6 rounded-lg bg-black/40 flex items-center justify-center text-white/20 group-hover:text-primary transition-colors">
                    {icon === "→" ? <GitBranch size={12} className="rotate-90" /> : <GitBranch size={12} className="-rotate-90" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                       <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colorForLabel(c.node.label) }} />
                       <span className="text-white/70 group-hover:text-white font-semibold truncate transition-colors">{c.node.name}</span>
                    </div>
                    <p className="text-[10px] text-white/20 font-medium truncate uppercase tracking-tighter">{c.node.label}</p>
                  </div>
                </button>
              ))}
              {conns.length > 25 && (
                <div className="p-3 text-center">
                   <p className="text-[10px] font-bold text-white/10 uppercase tracking-widest">+{conns.length - 25} more nodes hidden</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

