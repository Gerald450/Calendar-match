"use client";

import React, { useEffect, useState } from "react";

type Interval = {
  id: string;
  day: string;
  startMin: number;
  endMin: number;
};

type Suggestion = {
  day: string;
  start: number;
  end: number;
};

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => Number(n) || 0);
  return h * 60 + m;
}

function timeFromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function overlapIntervals(a: Interval[], b: Interval[]): { day: string; start: number; end: number }[] {
  const res: { day: string; start: number; end: number }[] = [];
  for (const ia of a) {
    for (const ib of b) {
      if (ia.day !== ib.day) continue;
      const start = Math.max(ia.startMin, ib.startMin);
      const end = Math.min(ia.endMin, ib.endMin);
      if (end > start) res.push({ day: ia.day, start, end });
    }
  }
  return res;
}

export default function ScheduleMatcher(){
  const [youSlots, setYouSlots] = useState<Interval[]>([]);
  const [themSlots, setThemSlots] = useState<Interval[]>([]);
  const [day, setDay] = useState<string>("Mon");
  const [start, setStart] = useState<string>("09:00");
  const [end, setEnd] = useState<string>("10:00");
  const [minDuration, setMinDuration] = useState<number>(30);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [labelYou, setLabelYou] = useState<string>("You");
  const [labelThem, setLabelThem] = useState<string>("GPT");

  // load saved
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("schedule-matcher:v1");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setYouSlots(parsed.you ?? []);
        setThemSlots(parsed.them ?? []);
        setLabelYou(parsed.labelYou ?? "You");
        setLabelThem(parsed.labelThem ?? "GPT");
      } catch {
        // ignore invalid JSON
      }
    }
  }, []);

  // persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      "schedule-matcher:v1",
      JSON.stringify({ you: youSlots, them: themSlots, labelYou, labelThem })
    );
  }, [youSlots, themSlots, labelYou, labelThem]);

  function cryptoRandomId(): string {
    try {
      return (crypto as Crypto).getRandomValues
        ? Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => b.toString(36)).join("").slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    } catch {
      return Math.random().toString(36).slice(2, 10);
    }
  }

  function addSlot(target: "you" | "them") {
    if (minutes(end) <= minutes(start)) {
      alert("End time must be after start time");
      return;
    }
    const slot: Interval = { id: cryptoRandomId(), day, startMin: minutes(start), endMin: minutes(end) };
    if (target === "you") setYouSlots((s) => [...s, slot]);
    else setThemSlots((s) => [...s, slot]);
  }

  function removeSlot(target: "you" | "them", id: string) {
    if (target === "you") setYouSlots((s) => s.filter((x) => x.id !== id));
    else setThemSlots((s) => s.filter((x) => x.id !== id));
  }

  function computeSuggestions() {
    const ov = overlapIntervals(youSlots, themSlots);
    const out: Suggestion[] = [];
    for (const o of ov) {
      const dur = o.end - o.start;
      if (dur >= minDuration) {
        let cur = o.start;
        while (cur + minDuration <= o.end) {
          out.push({ day: o.day, start: cur, end: cur + minDuration });
          cur += minDuration; // non-overlapping suggestions; change to smaller step if you want sliding windows
        }
      }
    }
    setSuggestions(out);
  }

  function exportJSON() {
    const payload = { you: youSlots, them: themSlots, labelYou, labelThem };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schedule-matcher.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setYouSlots(parsed.you ?? []);
        setThemSlots(parsed.them ?? []);
        setLabelYou(parsed.labelYou ?? "You");
        setLabelThem(parsed.labelThem ?? "GPT");
        alert("Imported schedule successfully");
      } catch {
        alert("Failed to parse JSON file");
      }
    };
    reader.readAsText(f);
    // reset input so the same file can be selected again if desired
    e.currentTarget.value = "";
  }

  function copyShareString() {
    const payload = { you: youSlots, them: themSlots, labelYou, labelThem };
    try {
      // btoa/atob require a binary-safe string; use encodeURIComponent trick
      // ensure `window` exists
      if (typeof window === "undefined") return;
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      navigator.clipboard
        .writeText(location.origin + location.pathname + "#share=" + encoded)
        .then(() => alert("Share link copied to clipboard"));
    } catch {
      alert("Unable to copy share link in this environment");
    }
  }

  // read share string from URL on load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = location.hash;
    if (h.startsWith("#share=")) {
      try {
        const encoded = h.replace("#share=", "");
        const decoded = decodeURIComponent(escape(atob(encoded)));
        const parsed = JSON.parse(decoded);
        setYouSlots(parsed.you ?? []);
        setThemSlots(parsed.them ?? []);
        setLabelYou(parsed.labelYou ?? "You");
        setLabelThem(parsed.labelThem ?? "GPT");
      } catch {
        // ignore
      }
    }
  }, []);

  function addSampleThem() {
    setThemSlots([
      { id: cryptoRandomId(), day: "Mon", startMin: minutes("08:00"), endMin: minutes("12:00") },
      { id: cryptoRandomId(), day: "Tue", startMin: minutes("14:00"), endMin: minutes("18:00") },
      { id: cryptoRandomId(), day: "Thu", startMin: minutes("10:00"), endMin: minutes("13:00") },
    ]);
  }

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="min-h-screen p-6 bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-semibold mb-2">Schedule Matcher</h1>
        <p className="text-sm text-gray-600 mb-4">Create availability for both people and find overlapping slots to schedule a call.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border rounded">
            <label className="block text-xs text-gray-600">Label</label>
            <input value={labelYou} onChange={(e) => setLabelYou(e.target.value)} className="w-full p-2 rounded border mt-1 mb-2" />
            <h3 className="font-medium mb-2">{labelYou} availability</h3>
            <div className="flex gap-2 mb-2">
              <select value={day} onChange={(e) => setDay(e.target.value)} className="p-2 rounded border">
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="p-2 rounded border" />
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="p-2 rounded border" />
              <button onClick={() => addSlot("you")} className="px-3 py-2 bg-blue-600 text-white rounded">
                Add
              </button>
            </div>
            <ul className="space-y-1">
              {youSlots.map((s) => (
                <li key={s.id} className="flex justify-between items-center text-sm">
                  <span>
                    {s.day} {timeFromMinutes(s.startMin)}–{timeFromMinutes(s.endMin)}
                  </span>
                  <button onClick={() => removeSlot("you", s.id)} className="text-red-500 text-xs">
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 border rounded">
            <label className="block text-xs text-gray-600">Label</label>
            <input value={labelThem} onChange={(e) => setLabelThem(e.target.value)} className="w-full p-2 rounded border mt-1 mb-2" />
            <h3 className="font-medium mb-2">{labelThem} availability</h3>
            <div className="flex gap-2 mb-2">
              <select value={day} onChange={(e) => setDay(e.target.value)} className="p-2 rounded border">
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="p-2 rounded border" />
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="p-2 rounded border" />
              <button onClick={() => addSlot("them")} className="px-3 py-2 bg-green-600 text-white rounded">
                Add
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <button onClick={addSampleThem} className="px-3 py-2 bg-gray-200 rounded">
                Auto-fill sample {labelThem}
              </button>
            </div>
            <ul className="space-y-1">
              {themSlots.map((s) => (
                <li key={s.id} className="flex justify-between items-center text-sm">
                  <span>
                    {s.day} {timeFromMinutes(s.startMin)}–{timeFromMinutes(s.endMin)}
                  </span>
                  <button onClick={() => removeSlot("them", s.id)} className="text-red-500 text-xs">
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 p-4 border rounded">
          <div className="flex items-center gap-3">
            <label className="text-sm">Minimum meeting duration (minutes)</label>
            <input
              type="number"
              value={minDuration}
              onChange={(e) => setMinDuration(Number(e.target.value))}
              className="w-20 p-2 rounded border"
            />
            <button onClick={computeSuggestions} className="px-3 py-2 bg-indigo-600 text-white rounded">
              Find matches
            </button>
          </div>

          <div className="mt-4">
            <h4 className="font-medium">Suggestions</h4>
            {suggestions.length === 0 ? (
              <p className="text-sm text-gray-600">No overlaps yet. Add availability for both people and click "Find matches".</p>
            ) : (
              <ul className="space-y-2 mt-2">
                {suggestions.map((s, i) => (
                  <li key={i} className="flex justify-between items-center border rounded p-2">
                    <div>
                      <div className="font-medium">
                        {s.day} {timeFromMinutes(s.start)}–{timeFromMinutes(s.end)}
                      </div>
                      <div className="text-xs text-gray-600">Overlap between {labelYou} and {labelThem}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => alert(`Scheduled call: ${s.day} ${timeFromMinutes(s.start)} - ${timeFromMinutes(s.end)}`)}
                        className="px-3 py-1 bg-blue-600 text-white rounded"
                      >
                        Schedule
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(`${s.day} ${timeFromMinutes(s.start)} - ${timeFromMinutes(s.end)}`)}
                        className="px-3 py-1 bg-gray-200 rounded"
                      >
                        Copy
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3 items-center">
          <button onClick={exportJSON} className="px-3 py-2 bg-yellow-500 rounded">
            Export JSON
          </button>
          <label className="px-3 py-2 bg-gray-100 rounded cursor-pointer">
            Import JSON
            <input type="file" accept="application/json" onChange={importJSON} className="hidden" />
          </label>
          <button onClick={copyShareString} className="px-3 py-2 bg-purple-600 text-white rounded">
            Copy share link
          </button>
          <button
            onClick={() => {
              setYouSlots([]);
              setThemSlots([]);
              if (typeof window !== "undefined") localStorage.removeItem("schedule-matcher:v1");
            }}
            className="px-3 py-2 bg-red-500 text-white rounded"
          >
            Clear
          </button>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          Tip: To coordinate with someone else, either have them import your exported JSON, or send them the share link so they can open it and see both schedules.
        </div>
      </div>
    </div>
  );
}
