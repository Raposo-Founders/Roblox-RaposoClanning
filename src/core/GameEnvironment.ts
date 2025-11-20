import { Players } from "@rbxts/services";
import { LifecycleInstance } from "lifecycle";
import { RaposoConsole } from "logging";
import { EntityManager } from "../entities";
import { gameValues } from "../gamevalues";
import { NetworkManager, sendDirectPacket } from "../network";
import { startBufferCreation, writeBufferString } from "../util/bufferwriter";
import Signal from "../util/signal";
import { RandomString } from "../util/utilfuncs";

// # Types
type T_EnvironmentBinding = (env: GameEnvironment) => void;

declare global {
  type T_GameEnvironment = typeof GameEnvironment["prototype"];
}

// # Class
class GameEnvironment {
  static runningInstances = new Map<string, GameEnvironment>();
  static boundCallbacks: T_EnvironmentBinding[] = [];

  static BindCallbackToEnvironmentCreation = (callback: T_EnvironmentBinding) => this.boundCallbacks.push(callback);
  static GetDefaultEnvironment = () => this.runningInstances.get("default")!;

  private readonly closingConnections: T_EnvironmentBinding[] = [];
  private readonly connections: RBXScriptConnection[] = [];

  readonly players = new Set<Player>();
  readonly playerJoined = new Signal<[user: Player, referenceId: string]>();
  readonly playerLeft = new Signal<[user: Player, reason: string]>();

  readonly blockedPlayers = new Map<Player["UserId"], string>; // UserId, reason
  readonly attributes = {
    totalTeamSize: 6,
    raidingGroupId: 0,
  };

  readonly network = new NetworkManager();
  readonly entity = new EntityManager(this);
  readonly lifecycle = new LifecycleInstance();

  isPlayback = false;

  constructor(readonly id: string, readonly isServer: boolean) {
    RaposoConsole.Warn(`Creating game environment ${id}`);

    GameEnvironment.runningInstances.set(id, this);

    // Execute bindings
    for (const callback of GameEnvironment.boundCallbacks)
      task.spawn(callback, this);

    this.connections.push(Players.PlayerRemoving.Connect(user => this.RemovePlayer(user, "Left the game.")));

    this.network.listenPacket("disconnect_request", (packet) => {
      if (!packet.sender) return;
      this.RemovePlayer(packet.sender, "Disconnected by user.");
    });

    this.lifecycle.running = true;
  }

  async Close() {
    print(`Closing game environment instance ${this.id}...`);

    this.lifecycle.Destroy();
    GameEnvironment.runningInstances.delete(this.id);

    for (const user of this.players)
      this.RemovePlayer(user, "Instance closing.");

    this.network.Destroy();

    task.wait(1);

    for (const callback of this.closingConnections)
      task.spawn(() => callback(this));
    this.closingConnections.clear();

    for (const conn of this.connections)
      conn.Disconnect();
    this.connections.clear();

    this.entity.murderAllFuckers();

    this.playerJoined.Clear();
    this.playerLeft.Clear();

    task.wait();
    task.wait();

    table.clear(this);
  }

  BindToClose(callback: (server: GameEnvironment) => void) {
    this.closingConnections.push(callback);
  }

  RegisterPlayer(player: Player) {
    // const referenceId = HttpService.GenerateGUID(false);
    const referenceId = RandomString(10);

    RaposoConsole.Info(`${player.Name} (${referenceId}) has joined the server ${this.id}`);

    player.SetAttribute(gameValues.usersessionid, referenceId);

    this.network.signedUsers.add(player);
    this.players.add(player);
    this.playerJoined.Fire(player, referenceId);
  }

  RemovePlayer(player: Player, disconnectreason = "") {
    if (!this.players.has(player)) return;

    print(`${player.Name} has left the server ${this.id}. (${disconnectreason})`);
    player.SetAttribute(gameValues.usersessionid, undefined);

    startBufferCreation();
    writeBufferString(disconnectreason);
    sendDirectPacket("server_disconnected", player);

    this.network.signedUsers.delete(player);
    this.players.delete(player);
    this.playerLeft.Fire(player, disconnectreason);

    // TODO: Remove this whenever you add an actual main menu to the game, retard.
    player.Kick(disconnectreason);
  }

  BlockPlayer(player: Player, reason = "undefined.") {
    this.blockedPlayers.set(player.UserId, reason);

    this.RemovePlayer(player, `Blocked by administrator: ${reason}`);
  }

  static GetServersFromPlayer(user: Player) {
    const list = new Array<GameEnvironment>();

    for (const [, server] of this.runningInstances)
      if (server.players.has(user)) list.push(server);

    return list;
  }
}

// * Export
export = GameEnvironment;