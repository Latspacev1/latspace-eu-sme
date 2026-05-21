"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminUser } from "@/lib/api/admin";

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

interface AssigneePickerProps {
  selected: string[];
  users: AdminUser[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function AssigneePicker({
  selected,
  users,
  onChange,
  disabled,
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const selectedUsers = selected
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is AdminUser => u !== undefined);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1 hover:border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selectedUsers.length === 0 ? (
          <span className="text-xs text-slate-400">+ Assign</span>
        ) : (
          <div className="flex -space-x-1.5">
            {selectedUsers.slice(0, 3).map((u) => (
              <span
                key={u.id}
                title={u.username}
                className="h-6 w-6 rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 ring-2 ring-white grid place-items-center"
              >
                {initials(u.username)}
              </span>
            ))}
            {selectedUsers.length > 3 && (
              <span className="h-6 w-6 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500 ring-2 ring-white grid place-items-center">
                +{selectedUsers.length - 3}
              </span>
            )}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          {users.length === 0 && (
            <p className="px-2 py-2 text-xs text-slate-400">No users found.</p>
          )}
          {users.map((u) => {
            const checked = selected.includes(u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggle(u.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
              >
                <span
                  className={`h-4 w-4 shrink-0 rounded border grid place-items-center ${
                    checked
                      ? "border-brand bg-brand"
                      : "border-slate-300"
                  }`}
                >
                  {checked && (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3 w-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path
                        d="m5 13 4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="h-6 w-6 rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 grid place-items-center">
                  {initials(u.username)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-slate-800">
                    {u.username}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    {u.email}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
