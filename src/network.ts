import Object from "@rbxts/object-utils";
import { Players, RunService } from "@rbxts/services";
import { t } from "@rbxts/t";
import { finalizeBufferCreation } from "util/bufferwriter";
import Signal from "./util/signal";
import { ReplicatedInstance } from "./util/utilfuncs";
import { RaposoConsole } from "logging";

// # Types
interface PacketInfo {
  id: string;
  sender: Player | undefined;
  timestamp: number;
  content: buffer;
}

// # Constants
const REMOTE_EVENT = ReplicatedInstance(workspace, "PACKETS", "RemoteEvent");
const UNREL_REMOTE_EVENT = ReplicatedInstance(workspace, "UNREL_PACKETS", "UnreliableRemoteEvent");

const DIRECT_REMOTE = ReplicatedInstance(workspace, "DIR_PACKETS", "RemoteEvent");
const UNREL_DIRECT_REMOTE = ReplicatedInstance(workspace, "UNREL_DIR_PACKETS", "UnreliableRemoteEvent");

const boundDirectCallbacks = new Map<string, Callback>();

const ASSERT_PACKET_CHECK = t.interface({
  id: t.string,
  sender: t.optional(t.instanceIsA("Player")),
  timestamp: t.number,
  content: t.buffer,
});

// # Functions
function HandleInfraction(user: Player | undefined, obj: unknown) {
  RaposoConsole.Warn(`Player ${user?.Name} (${user?.UserId}) has sent an unknown object type.`, typeOf(obj), obj);
}

export function sendDirectPacket(id: string, user: Player | undefined, unreliable = false) {
  const bfr = finalizeBufferCreation();

  if (RunService.IsServer())
    assert(user, "Server packets must contain a recipient!");

  if (RunService.IsClient())
    if (unreliable)
      UNREL_DIRECT_REMOTE.FireServer(id, bfr);
    else
      DIRECT_REMOTE.FireServer(id, bfr);

  if (RunService.IsServer())
    if (unreliable)
      UNREL_DIRECT_REMOTE.FireClient(user!, id, bfr);
    else
      DIRECT_REMOTE.FireClient(user!, id, bfr);
}

export function listenDirectPacket(id: string, callback: (sender: Player | undefined, bfr: buffer) => void) {
  assert(!boundDirectCallbacks.has(id), `Direct package id "${id}" already contains a listener.`);
  boundDirectCallbacks.set(id, callback);
}

// # Class
export class PacketDistributor {
  private strictIgnorePlayers = new Set<Player>();
  
  constructor() {
    
  }

  StrictIgnore(user: Player) {
    this.strictIgnorePlayers.add(user);
  }

  Generate() {
    const selectedPlayers: Player[] = [];

    for (const user of Players.GetPlayers()) {
      if (this.strictIgnorePlayers.has(user)) continue;
      selectedPlayers.push(user);
    }

    return {
      players: selectedPlayers,
    };
  }
}

export class NetworkManager {
  private boundListeners = new Map<string, Callback[]>();
  private connections: RBXScriptConnection[] = [];

  remoteEnabled = true;
  packetPosted = new Signal<[packet: PacketInfo]>();

  readonly signedUsers = new Set<Player>();

  constructor() {
    let reliableConnection: RBXScriptConnection;
    let unreliableConnection: RBXScriptConnection;

    if (RunService.IsServer()) {
      reliableConnection = REMOTE_EVENT.OnServerEvent.Connect((user, id, content) => {
        if (!this.signedUsers.has(user)) return;
        if (!t.string(id) || !t.buffer(content)) return;

        this.insertNetwork({
          id,
          sender: user,
          timestamp: time(),
          content
        });
      });
      unreliableConnection = UNREL_REMOTE_EVENT.OnServerEvent.Connect((user, id, content) => {
        if (!this.signedUsers.has(user)) return;
        if (!t.string(id) || !t.buffer(content)) return;

        this.insertNetwork({
          id,
          sender: user,
          timestamp: time(),
          content
        });
      });
    } else {
      reliableConnection = REMOTE_EVENT.OnClientEvent.Connect((id, content) => {
        if (!t.string(id) || !t.buffer(content)) return;

        this.insertNetwork({
          id,
          sender: undefined,
          timestamp: time(),
          content
        });
      });
      unreliableConnection = UNREL_REMOTE_EVENT.OnClientEvent.Connect((id, content) => {
        if (!t.string(id) || !t.buffer(content)) return;

        this.insertNetwork({
          id,
          sender: undefined,
          timestamp: time(),
          content
        });
      });
    }

    this.connections.push(reliableConnection, unreliableConnection);
  }

  insertNetwork(packet: PacketInfo) {
    if (!ASSERT_PACKET_CHECK(packet)) {
      RaposoConsole.Warn("Packet assert failed:", packet);
      return;
    }

    if (RunService.IsServer() && !packet.sender) return;
    if (RunService.IsServer() && packet.sender && !this.signedUsers.has(packet.sender)) {
      print("User is not signed."); return; 
    }

    const callbackList = this.boundListeners.get(packet.id);
    if (!callbackList || callbackList.size() <= 0) {
      if (RunService.IsStudio())
        RaposoConsole.Warn(`Unbound network callback: ${packet.id}`);
      else
        RaposoConsole.Warn(`Unknown network callback: "${packet.id}" sent from ${RunService.IsClient() ? "Server" : packet.sender?.UserId}`);

      return;
    }

    for (const callback of callbackList)
      task.spawn(callback, packet);
  }

  sendPacket(id: string, players = Players.GetPlayers(), ignore: Player[] = [], unreliable = false) {
    const bfr = finalizeBufferCreation();
    const filteredPlayerList = new Set<Player>();

    for (const user of players) {
      if (!user.IsDescendantOf(Players) || ignore.includes(user) || !this.signedUsers.has(user)) continue;
      filteredPlayerList.add(user);
    }

    this.packetPosted.Fire({
      id,
      sender: Players.LocalPlayer,
      timestamp: time(),
      content: bfr,
    });

    if (!this.remoteEnabled) return;

    if (unreliable)
      if (RunService.IsServer())
        for (const user of filteredPlayerList)
          UNREL_REMOTE_EVENT.FireClient(user, id, bfr);
      else
        UNREL_REMOTE_EVENT.FireServer(id, bfr);
    else
      if (RunService.IsServer())
        for (const user of filteredPlayerList)
          REMOTE_EVENT.FireClient(user, id, bfr);
      else
        REMOTE_EVENT.FireServer(id, bfr);
  }

  listenPacket(id: string, callback: (info: PacketInfo) => void) {
    const callbackList = this.boundListeners.get(id) || [];
    callbackList.push(callback);

    if (!this.boundListeners.has(id))
      this.boundListeners.set(id, callbackList);
  }

  Destroy() {
    for (const conn of this.connections)
      conn.Disconnect();
    this.connections.clear();

    this.boundListeners.clear();
  }
}

// # Bindings & misc
if (RunService.IsServer()) {
  DIRECT_REMOTE.OnServerEvent.Connect((user, id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `User ${user.UserId} has sent an invalid DIRECT packet.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `User ${user.UserId} has sent a unknown DIRECT packet. "${id}"`;

    callback(user, bfr);
  });

  UNREL_DIRECT_REMOTE.OnServerEvent.Connect((user, id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `User ${user.UserId} has sent an invalid (unreliable) DIRECT packet.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `User ${user.UserId} has sent a unknown (unreliable) DIRECT packet. "${id}"`;

    callback(user, bfr);
  });
} else {
  DIRECT_REMOTE.OnClientEvent.Connect((id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `The server has sent an invalid DIRECT packet.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `The server has sent a unknown DIRECT packet. "${id}"`;

    callback(undefined, bfr);
  });

  UNREL_DIRECT_REMOTE.OnClientEvent.Connect((id, bfr) => {
    if (!t.string(id) || !t.buffer(bfr))
      throw `The server has sent an invalid (unreliable) DIRECT packet.\n{ id = ${id}, tid = ${typeOf(id)}}, bfr = ${typeOf(bfr)}`;

    const callback = boundDirectCallbacks.get(id);
    if (!callback)
      throw `The server has sent a unknown (unreliable) DIRECT packet. "${id}"`;

    callback(undefined, bfr);
  });
}
