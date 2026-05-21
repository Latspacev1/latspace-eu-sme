"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { benchmarkingApi, PeerLibraryItem } from "@/lib/api/benchmarking";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Search, X } from "lucide-react";

export interface CustomPeer {
  name: string;
  report_url: string;
}

export interface SelectedPeer {
  id: string;
  name: string;
}

export interface Step2Data {
  selectedPeers: SelectedPeer[];
  customPeers: CustomPeer[];
}

interface Step2PeerPickerProps {
  data: Step2Data;
  onChange: (data: Step2Data) => void;
}

function CustomPeerForm({
  onAdd,
}: {
  onAdd: (peer: CustomPeer) => void;
}) {
  const [name, setName] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [open, setOpen] = useState(false);

  const canAdd = name.trim().length > 0 && reportUrl.trim().length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ name: name.trim(), report_url: reportUrl.trim() });
    setName("");
    setReportUrl("");
    setOpen(false);
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-dashed border-[#074D47] text-[#074D47] hover:bg-[#074D47]/5"
      >
        <PlusCircle className="w-4 h-4 mr-2" />
        Add Custom Peer
      </Button>
    );
  }

  return (
    <div className="border border-[#0A0A0A]/15 rounded-lg p-4 space-y-3 bg-[#074D47]/5">
      <p className="text-sm font-medium text-[#0A0A0A]">Add Custom Peer</p>
      <div className="space-y-2">
        <Label className="text-xs text-[#0A0A0A]/60">Company name</Label>
        <Input
          placeholder="Acme Corp"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border-[#0A0A0A]/20 h-8 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-[#0A0A0A]/60">Annual report URL</Label>
        <Input
          placeholder="https://..."
          value={reportUrl}
          onChange={(e) => setReportUrl(e.target.value)}
          className="border-[#0A0A0A]/20 h-8 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!canAdd}
          onClick={handleAdd}
          className="bg-[#074D47] text-white hover:bg-[#074D47]/90"
        >
          Add
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function Step2PeerPicker({ data, onChange }: Step2PeerPickerProps) {
  const [search, setSearch] = useState("");

  const { data: libraryData, isLoading } = useQuery({
    queryKey: ["benchmarking-peer-library"],
    queryFn: async () => {
      const res = await benchmarkingApi.listPeerLibrary();
      return res.success && res.data ? res.data : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const peers = libraryData ?? [];

  const filtered = useMemo(
    () => peers.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [peers, search],
  );

  const togglePeer = (peer: PeerLibraryItem) => {
    const isSelected = data.selectedPeers.some((p) => p.id === peer.peer_id);
    const next = isSelected
      ? data.selectedPeers.filter((p) => p.id !== peer.peer_id)
      : [...data.selectedPeers, { id: peer.peer_id, name: peer.name }];
    onChange({ ...data, selectedPeers: next });
  };

  const removeCustomPeer = (idx: number) => {
    onChange({
      ...data,
      customPeers: data.customPeers.filter((_, i) => i !== idx),
    });
  };

  const addCustomPeer = (peer: CustomPeer) => {
    onChange({ ...data, customPeers: [...data.customPeers, peer] });
  };

  const totalSelected = data.selectedPeers.length + data.customPeers.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#0A0A0A] mb-1">
          Select Peers
        </h2>
        <p className="text-sm text-[#0A0A0A]/60">
          Choose companies from the library or add your own.{" "}
          <span className="font-medium text-[#074D47]">
            {totalSelected} selected
          </span>
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0A0A0A]/40" />
        <Input
          aria-label="Search peer library"
          placeholder="Search peer library..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 border-[#0A0A0A]/20"
        />
      </div>

      {/* Library peers */}
      <div className="border border-[#0A0A0A]/10 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#0A0A0A]/40 text-center py-6">
            No peers match your search.
          </p>
        ) : (
          <ul className="divide-y divide-[#0A0A0A]/5" role="listbox" aria-label="Peer library">
            {filtered.map((peer: PeerLibraryItem) => {
              const checked = data.selectedPeers.some((p) => p.id === peer.peer_id);
              return (
                <li
                  key={peer.peer_id}
                  tabIndex={0}
                  role="option"
                  aria-selected={checked}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#074D47]/5 cursor-pointer"
                  onClick={() => togglePeer(peer)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      togglePeer(peer);
                    }
                  }}
                >
                   <Checkbox
                    checked={checked}
                    onCheckedChange={() => togglePeer(peer)}
                    id={`peer-${peer.peer_id}`}
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[#0A0A0A]">
                      {peer.name}
                    </span>
                    <span className="ml-2 text-xs text-[#0A0A0A]/40 capitalize">
                      {peer.segment.replace(/_/g, " ")}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Custom peers */}
      {data.customPeers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#0A0A0A]/50 uppercase tracking-wider">
            Custom Peers
          </p>
          <ul className="space-y-2">
            {data.customPeers.map((peer, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between px-3 py-2 border border-[#0A0A0A]/10 rounded-md bg-[#074D47]/5"
              >
                <div>
                  <span className="text-sm font-medium text-[#0A0A0A]">
                    {peer.name}
                  </span>
                  <span className="ml-2 text-xs text-[#0A0A0A]/40 truncate max-w-[200px]">
                    {peer.report_url}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeCustomPeer(idx)}
                  className="text-[#0A0A0A]/30 hover:text-red-500 transition-colors"
                  aria-label={`Remove ${peer.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CustomPeerForm onAdd={addCustomPeer} />
    </div>
  );
}
