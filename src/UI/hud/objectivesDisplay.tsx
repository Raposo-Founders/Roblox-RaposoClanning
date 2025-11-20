import React, { useEffect, useRef } from "@rbxts/react";
import { createRoot, Root } from "@rbxts/react-roblox";
import GameEnvironment from "core/GameEnvironment";
import { CapturePointMeter } from "./capturepointMeter";

export function ObjectivesLine() {
  const parentRef = useRef<Frame>();

  useEffect(() => {
    const mountedRoots = new Map<string, Root>();

    GameEnvironment.GetDefaultEnvironment().entity.entityCreated.Connect(ent => {
      if (!parentRef.current) return;

      if (ent.IsA("CapturePointEntity")) {
        const newRoot = createRoot(parentRef.current, { hydrate: true });

        mountedRoots.set(ent.id, newRoot);
        newRoot.render(<CapturePointMeter entityId={ent.id} />);
      }
    });

    GameEnvironment.GetDefaultEnvironment().entity.entityDeleting.Connect(ent => {
      const root = mountedRoots.get(ent.id);
      if (!root) return;

      root.unmount();
      mountedRoots.delete(ent.id);
    });
  });

  return <frame
    BackgroundTransparency={1}
    AnchorPoint={new Vector2(0.5, 1)}
    Position={new UDim2(0.5, 0, 1, 0)}
    AutomaticSize={"XY"}
    Size={new UDim2()}
    ref={parentRef}
  >
    <uilistlayout
      SortOrder={"LayoutOrder"}
      FillDirection={"Horizontal"}
      Padding={new UDim(0, 3)}
    />
  </frame>;
}