import { ButtonItem, Field, PanelSection } from "@decky/ui";
import { useEffect, useState } from "react";
import { getDisplayState, restartGamescopeSession, setDisplayConfig } from "../backend";
import { SelectEdit } from "../components/widgets";
import type { DisplayState } from "../types";

const ORIENTATIONS = [
  { data: "normal", label: "Normal" },
  { data: "left", label: "Rotate Left" },
  { data: "right", label: "Rotate Right" },
  { data: "upsidedown", label: "Upside Down" },
];

// gamescope only ever drives one embedded output at a time (--prefer-output
// picks the first available from a priority list at startup, there's no
// live multi-monitor/hotplug re-pick) - so "primary display" here means
// which single connector the whole game-mode session targets, not an
// extend/mirror choice.
const INTERNAL = "__internal__";

export function Display() {
  const [state, setState] = useState<DisplayState | null>(null);
  const [message, setMessage] = useState("Loading");
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    getDisplayState()
      .then(setState)
      .catch((error) => setMessage(String(error)));
  }, []);

  if (!state) {
    return (
      <PanelSection title="DISPLAY">
        <Field label={message} />
      </PanelSection>
    );
  }

  const externals = state.connectors.filter((c) => !c.internal);
  const selectedConnector = state.useExternal ? state.connector : INTERNAL;
  const primaryOptions = [
    { data: INTERNAL, label: "Internal Screen" },
    ...externals.map((c) => ({
      data: c.connector,
      label: c.connected ? c.connector : `${c.connector} (disconnected)`,
    })),
  ];
  const activeExternal = externals.find((c) => c.connector === state.connector);
  // A disconnected display has nothing meaningful to configure right now -
  // its remembered settings come back when it's plugged in again.
  const activeDisconnected = state.useExternal && (!activeExternal || !activeExternal.connected);
  const currentMode = `${state.width}x${state.height}`;
  const modeChoices = activeExternal?.modes.length ? activeExternal.modes : [currentMode];
  const modeOptions = modeChoices.map((mode) => ({ data: mode, label: mode }));

  const persist = (next: Partial<DisplayState>) => {
    const merged = { ...state, ...next };
    setSaving(true);
    setDisplayConfig(merged.useExternal, merged.connector, merged.width, merged.height, merged.orientation)
      .then(setState)
      .catch((error) => setMessage(String(error)))
      .finally(() => setSaving(false));
  };

  const selectPrimary = (connector: string) => {
    if (connector === INTERNAL) {
      persist({ useExternal: false });
      return;
    }
    const target = externals.find((c) => c.connector === connector);
    const previous = state.remembered[connector];
    const [w, h] = (target?.modes[0] || "1920x1080").split("x").map(Number);
    persist({
      useExternal: true,
      connector,
      width: previous?.width || w || 1920,
      height: previous?.height || h || 1080,
      orientation: previous?.orientation || state.orientation || "normal",
    });
  };

  const selectMode = (mode: string) => {
    const [w, h] = mode.split("x").map(Number);
    if (!w || !h) return;
    persist({ width: w, height: h });
  };

  return (
    <PanelSection title="EXTERNAL DISPLAY">
      <SelectEdit label="Primary Display" value={selectedConnector} options={primaryOptions} onChange={selectPrimary} disabled={saving} />
      {state.useExternal && (
        <>
          <SelectEdit label="Resolution" value={currentMode} options={modeOptions} onChange={selectMode} disabled={saving || activeDisconnected} />
          <SelectEdit
            label="Rotation"
            value={state.orientation}
            options={ORIENTATIONS}
            onChange={(v) => persist({ orientation: v })}
            disabled={saving || activeDisconnected}
          />
        </>
      )}
      {externals.length === 0 && (
        <Field label="No external display detected. Connect one (dock/USB-C/HDMI) to choose it here." />
      )}
      {activeDisconnected && (
        <Field label="This display isn't connected right now - game mode runs on the internal screen until it's plugged back in. Its settings are remembered." />
      )}
      <div className="armada-reset-row">
        <ButtonItem
          layout="below"
          disabled={restarting}
          onClick={() => {
            setRestarting(true);
            restartGamescopeSession().catch((error) => setMessage(String(error)));
          }}
        >
          Apply &amp; Restart Game Mode
        </ButtonItem>
      </div>
    </PanelSection>
  );
}
