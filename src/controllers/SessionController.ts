import { Players, RunService } from "@rbxts/services";
import { ConsoleFunctionCallback } from "cmd/cvar";
import GameEnvironment from "core/GameEnvironment";
import { ListenStandardMessage, SendStandardMessage } from "core/NetworkModel";
import { clientSessionConnected, clientSessionDisconnected } from "defaultinsts";
import { RaposoConsole } from "logging";
import { BufferReader } from "util/bufferreader";
import { finalizeBufferCreation, startBufferCreation, writeBufferString, writeBufferU64, writeBufferU8 } from "util/bufferwriter";
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

  SendStandardMessage(SessionConnectionIds[SessionConnectionIds.servercon_Request], { sessionId }, undefined);

  const [connectionAllowed, negativeReason] = coroutine.yield() as LuaTuple<[boolean, string]>;
  if (!connectionAllowed) {
    RaposoConsole.Warn(`Session ${sessionId} has rejected connection. (${negativeReason})`);
    canConnect = true;
    return;
  }

  defaultEnvironment.entity?.murderAllFuckers();

  task.wait(CONNECTION_STEP_COOLDOWN);

  SendStandardMessage(SessionConnectionIds[SessionConnectionIds.servercon_MapReady], { sessionId }, undefined);

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
    defaultEnvironment.network.InsertPacket(packet, Players.LocalPlayer);
  });

  defaultEnvironment.network.remoteEnabled = false;
  const clientSessionConnection = defaultEnvironment.network.packetPosted.Connect(packet => {
    serverInst.network.InsertPacket(packet, undefined);
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
  SendStandardMessage(SessionConnectionIds[SessionConnectionIds.servercon_FetchServers], {}, undefined);

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
    SendStandardMessage("disconnect_request", {}, undefined);
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
  ListenStandardMessage(SessionConnectionIds[SessionConnectionIds.servercon_Request], (sender, obj) => {
    if (!sender) return;

    const sessionId = tostring(obj.sessionId);

    const targetSession = GameEnvironment.runningInstances.get(sessionId);

    if (!targetSession) {
      SendStandardMessage(SessionConnectionIds[SessionConnectionIds.servercon_Request], { success: false, message: `Unknown session ${sessionId}` }, sender);
      return;
    }

    if (targetSession.blockedPlayers.has(sender.UserId)) {
      SendStandardMessage(SessionConnectionIds[SessionConnectionIds.servercon_Request], { success: false, message: tostring(targetSession.blockedPlayers.get(sender.UserId)) }, sender);

      return;
    }

    SendStandardMessage(SessionConnectionIds[SessionConnectionIds.servercon_Request], { success: true, message: "" }, sender);

    usersInConnectionProcess.add(sender);
  });

if (RunService.IsClient())
  ListenStandardMessage(SessionConnectionIds[SessionConnectionIds.servercon_Request], (sender, obj) => {
    const isAllowed = obj.success ?? false;
    const rejectReason = tostring(obj.message);

    if (!currentConnectionThread)
      return;

    coroutine.resume(currentConnectionThread, isAllowed, rejectReason);
  });

// Finalize connection
if (RunService.IsServer())
  ListenStandardMessage(SessionConnectionIds[SessionConnectionIds.servercon_MapReady], (sender, obj) => {
    if (!sender) return;

    const sessionId = tostring(obj.sessionId);

    const targetSession = GameEnvironment.runningInstances.get(sessionId);
    if (!targetSession || !usersInConnectionProcess.has(sender)) return;

    targetSession.RegisterPlayer(sender);
    usersInConnectionProcess.delete(sender);
  });

// Handling disconnections
if (RunService.IsClient())
  ListenStandardMessage("server_disconnected", (_, content) => {
    const reason = tostring(content.reason);

    clientSessionDisconnected.Fire(reason, reason);

    RaposoConsole.Warn("Disconnected from session. Reason:", reason);

    GameEnvironment.GetDefaultEnvironment().entity.murderAllFuckers();
  });

if (RunService.IsServer())
  ListenStandardMessage("disconnect_request", (sender) => {
    if (!sender) return;

    const sessionList = GameEnvironment.GetServersFromPlayer(sender);

    for (const session of sessionList)
      session.RemovePlayer(sender, "Disconnected by user.");
  });

// Fetching server list
if (RunService.IsServer())
  ListenStandardMessage("game_getservers", (sender, bfr) => {
    if (!sender) return;

    startBufferCreation();
    writeBufferU8(GameEnvironment.runningInstances.size());
    for (const [serverId, inst] of GameEnvironment.runningInstances) {
      writeBufferString(serverId);

      writeBufferU8(inst.players.size());
      for (const user of inst.players)
        writeBufferU64(user.UserId);
    }
    SendStandardMessage("game_getservers_reply", { list: finalizeBufferCreation() }, sender);
  });

// Receiving server list
if (RunService.IsClient())
  ListenStandardMessage("game_getservers_reply", (sender, obj) => {
    const reader = BufferReader(obj.list as buffer);
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
