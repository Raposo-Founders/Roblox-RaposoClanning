import { NetworkManager } from "network";
import GameEnvironment from "core/GameEnvironment";

// # Types
interface SessionSnapshotInfo {
  time: number;
  entities: {
    id: EntityId,
    classname: keyof GameEntities,
    content: Map<string, unknown>;
  }[];
}

// # Constants & variables
const savedSessionSnapshots = new Map<string, SessionSnapshotInfo[]>();

// # Functions
function SaveCurrentSnapshot(session: GameEnvironment) {
  const snapshotsThread = savedSessionSnapshots.get(session.id);
}

// # Bindings & misc
