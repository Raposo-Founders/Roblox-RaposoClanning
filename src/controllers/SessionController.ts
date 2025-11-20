import { Players, RunService } from "@rbxts/services";
import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { clientSessionConnected, clientSessionDisconnected } from "defaultinsts";
import { RaposoConsole } from "logging";
import { listenDirectPacket, sendDirectPacket } from "network";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferBool, writeBufferString, writeBufferU64, writeBufferU8 } from "util/bufferwriter";
import Signal from "util/signal";

// # Interfaces & types
interface ServerListingInfo {
  sessionId: string;
  players: Player[];
}

// # Constants & variables
enum SessionConnectionIds {
  servercon_FetchServers, // Only used for... you know what, so whatever
  servercon_Request,
  servercon_GetInfo,
  servercon_MapReady,
}

const CONNECTION_STEP_COOLDOWN = 0.5;
const DISCONNECT_LOCAL = new Signal();
const usersInConnectionProcess = new Set<Player>();

let canConnect = true;
let currentConnectionThread: thread | undefined;
let currentServerListFetchThread: thread | undefined;

// # Functions
export function clientConnectToServerSession(sessionId: string) {
  assert(RunService.IsClient(), "Function can only be called from the client.");
  assert(canConnect, "Function is on cooldown.");

  const defaultEnvironment = GameEnvironment.GetDefaultEnvironment();

  canConnect = false;
  currentConnectionThread = coroutine.running();

  print("Requesting connection to session:", sessionId);

  startBufferCreation();
  writeBufferString(sessionId);
  sendDirectPacket(SessionConnectionIds[SessionConnectionIds.servercon_Request], undefined);

  const [connectionAllowed, negativeReason] = coroutine.yield() as LuaTuple<[boolean, string]>;
  if (!connectionAllowed) {
    RaposoConsole.Warn(`Session ${sessionId} has rejected connection. (${negativeReason})`);
    canConnect = true;
    return;
  }

  defaultEnvironment.entity?.murderAllFuckers();

  task.wait(CONNECTION_STEP_COOLDOWN);

  startBufferCreation();
  writeBufferString(sessionId);
  sendDirectPacket(SessionConnectionIds[SessionConnectionIds.servercon_MapReady], undefined);

  canConnect = true;
  currentConnectionThread = undefined;

  clientSessionConnected.Fire(sessionId);
}

export function clientCreateLocalSession() {
  assert(RunService.IsClient(), "Function can only be called from the client.");

  const defaultEnvironment = GameEnvironment.GetDefaultEnvironment();
  const serverInst = new GameEnvironment("local", true);

  serverInst.network.remoteEnabled = false;
  const serverSessionConnection = serverInst.network.packetPosted.Connect(packet => {
    defaultEnvironment.network.insertNetwork(packet);
  });

  defaultEnvironment.network.remoteEnabled = false;
  const clientSessionConnection = defaultEnvironment.network.packetPosted.Connect(packet => {
    serverInst.network.insertNetwork(packet);
  });

  const connection = DISCONNECT_LOCAL.Connect(() => {
    serverInst.Close();
  });

  serverInst.BindToClose(() => {
    serverSessionConnection.Disconnect();
    clientSessionConnection.Disconnect();

    defaultEnvironment.network.remoteEnabled = true;

    connection.Disconnect();
  });

  clientSessionConnected.Fire("local");

  serverInst.playerLeft.Connect(() => {
    serverInst.Close();
  });

  task.spawn(() => {
    task.wait(CONNECTION_STEP_COOLDOWN);
    serverInst.RegisterPlayer(Players.LocalPlayer);
  });
}

export function FetchServers() {
  assert(RunService.IsClient(), "Function can only be called from the client.");
  assert(!currentServerListFetchThread, "Function on cooldown.");

  currentServerListFetchThread = coroutine.running();

  startBufferCreation();
  sendDirectPacket(SessionConnectionIds[SessionConnectionIds.servercon_FetchServers], undefined);

  const [serversInfo] = coroutine.yield() as LuaTuple<[ServerListingInfo[]]>;

  return serversInfo;
}

// # Execution
new ConsoleFunctionCallback(["disconnect", "dc"], [])
  .setDescription("Disconnects from the current session.")
  .setCallback((ctx) => {
    ctx.Reply("Disconnecting from session...");

    DISCONNECT_LOCAL.Fire();

    startBufferCreation();
    sendDirectPacket("disconnect_request", undefined);
  });

new ConsoleFunctionCallback(["connect"], [{ name: "id", type: "string" }])
  .setDescription("Attempts to connect to a multiplayer session.")
  .setCallback((ctx) => {
    const sessionId = ctx.getArgument("id", "string").value;

    ctx.Reply(`Connecting to session: ${sessionId}...`);
    if (sessionId === "local")
      clientCreateLocalSession();
    else
      clientConnectToServerSession(sessionId);
  });

// Connection requests
if (RunService.IsServer())
  listenDirectPacket(SessionConnectionIds[SessionConnectionIds.servercon_Request], (sender, bfr) => {
    if (!sender) return;

    const reader = BufferReader(bfr);
    const sessionId = reader.string();

    const targetSession = GameEnvironment.runningInstances.get(sessionId);

    if (!targetSession) {
      startBufferCreation();
      writeBufferBool(false);
      writeBufferString(`Unknown session ${sessionId}.`);
      sendDirectPacket(SessionConnectionIds[SessionConnectionIds.servercon_Request], sender);

      return;
    }

    if (targetSession.blockedPlayers.has(sender.UserId)) {
      startBufferCreation();
      writeBufferBool(false);
      writeBufferString(tostring(targetSession.blockedPlayers.get(sender.UserId)));
      sendDirectPacket(SessionConnectionIds[SessionConnectionIds.servercon_Request], sender);

      return;
    }

    startBufferCreation();
    writeBufferBool(true);
    writeBufferString("Allowed.");
    sendDirectPacket(SessionConnectionIds[SessionConnectionIds.servercon_Request], sender);

    usersInConnectionProcess.add(sender);
  });

if (RunService.IsClient())
  listenDirectPacket(SessionConnectionIds[SessionConnectionIds.servercon_Request], (sender, bfr) => {
    const reader = BufferReader(bfr);
    const isAllowed = reader.bool();
    const rejectReason = reader.string();

    if (!currentConnectionThread)
      return;

    coroutine.resume(currentConnectionThread, isAllowed, rejectReason);
  });

// Finalize connection
if (RunService.IsServer())
  listenDirectPacket(SessionConnectionIds[SessionConnectionIds.servercon_MapReady], (sender, bfr) => {
    if (!sender) return;

    const reader = BufferReader(bfr);
    const sessionId = reader.string();

    const targetSession = GameEnvironment.runningInstances.get(sessionId);
    if (!targetSession || !usersInConnectionProcess.has(sender)) return;

    targetSession.RegisterPlayer(sender);
    usersInConnectionProcess.delete(sender);
  });

// Handling disconnections
if (RunService.IsClient())
  listenDirectPacket("server_disconnected", (_, content) => {
    const reader = BufferReader(content);
    const reason = reader.string();

    clientSessionDisconnected.Fire(reason, reason);

    RaposoConsole.Warn("Disconnected from session. Reason:", reason);

    GameEnvironment.GetDefaultEnvironment().entity.murderAllFuckers();
  });

if (RunService.IsServer())
  listenDirectPacket("disconnect_request", (sender) => {
    if (!sender) return;

    const sessionList = GameEnvironment.GetServersFromPlayer(sender);

    for (const session of sessionList)
      session.RemovePlayer(sender, "Disconnected by user.");
  });

// Fetching server list
if (RunService.IsServer())
  listenDirectPacket("game_getservers", (sender, bfr) => {
    if (!sender) return;

    startBufferCreation();
    writeBufferU8(GameEnvironment.runningInstances.size());
    for (const [serverId, inst] of GameEnvironment.runningInstances) {
      writeBufferString(serverId);

      writeBufferU8(inst.players.size());
      for (const user of inst.players)
        writeBufferU64(user.UserId);
    }
    sendDirectPacket("game_getservers_reply", sender);
  });

// Receiving server list
if (RunService.IsClient())
  listenDirectPacket("game_getservers_reply", (sender, bfr) => {
    const reader = BufferReader(bfr);
    const serverList: ServerListingInfo[] = [];
    const serversAmount = reader.u8();

    for (let i = 0; i < serversAmount; i++) {
      const serverId = reader.string();
      const playersAmount = reader.u8();

      const players: Player[] = [];

      for (let i = 0; i < playersAmount; i++) {
        const user = Players.GetPlayerByUserId(reader.u64());
        if (!user) continue;

        players.push(user);
      }

      serverList.push({
        sessionId: serverId,
        players: players,
      });
    }

    if (currentServerListFetchThread)
      coroutine.resume(currentServerListFetchThread, serverList);
  });
