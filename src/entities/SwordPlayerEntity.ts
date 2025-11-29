import * as Services from "@rbxts/services";
import { getLocalPlayerEntity } from "controllers/LocalEntityController";
import GameEnvironment from "core/GameEnvironment";
import { NetworkPacket } from "core/NetworkModel";
import { gameValues } from "gamevalues";
import { RaposoConsole } from "logging";
import { getPlayermodelFromEntity } from "providers/PlayermodelProvider";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferBool, writeBufferString, writeBufferU32, writeBufferU8 } from "util/bufferwriter";
import Signal from "util/signal";
import { registerEntityClass } from ".";
import HealthEntity from "./HealthEntity";
import PlayerEntity, { getPlayerEntityFromController } from "./PlayerEntity";

// # Types
declare global {
  interface GameEntities {
    SwordPlayerEntity: typeof SwordPlayerEntity;
  }
}

// # Constants & variables
export enum SwordState {
  Idle = 5,
  Swing = 10,
  Lunge = 30,
}

const NETWORK_ID = "sword_";

// # Functions

// # Class
export class SwordPlayerEntity extends PlayerEntity {
  classname: keyof GameEntities = "SwordPlayerEntity";

  hitDetectionEnabled = true;
  currentState = SwordState.Idle;
  hitboxTouched = new Signal<[target: HealthEntity, part: BasePart]>();
  stateChanged = new Signal<[newState: SwordState]>();

  private canAttack = true;
  private isEquipped = false;
  private lastActiveTime = 0;
  private activationCount = 0;

  constructor(public controller: string, public appearanceId = 1) {
    super(controller, appearanceId);

    this.inheritanceList.add("SwordPlayerEntity");

    task.defer(() => {
      if (this.environment.isServer) return;

      this.spawned.Connect(() => this.Equip());
      this.died.Connect(() => this.Unequip());
    });
  }

  WriteStateBuffer() {
    super.WriteStateBuffer();

    writeBufferBool(this.isEquipped);
    writeBufferU32(this.activationCount);
  }

  ApplyStateBuffer(reader: ReturnType<typeof BufferReader>): void {
    super.ApplyStateBuffer(reader);

    const isEquipped = reader.bool();
    const activationCount = reader.u32();

    if (this.environment.isServer || this.GetUserFromController() !== Services.Players.LocalPlayer)
      if (this.isEquipped !== isEquipped)
        if (isEquipped)
          this.Equip();
        else
          this.Unequip();

    if (this.environment.isPlayback) {
      if (this.activationCount !== activationCount)
        this.Attack1();

      this.activationCount = activationCount;
    }
  }

  Destroy(): void {
    this.hitboxTouched.Clear();
  }

  IsWeaponEquipped() {
    return this.isEquipped;
  }

  Equip() {
    if (this.isEquipped) return;

    this.isEquipped = true;
    getPlayermodelFromEntity(this.id)?.animator.PlayAnimation("toolnone", "Action", true);
  }

  Unequip() {
    if (!this.isEquipped) return;

    this.isEquipped = false;
    getPlayermodelFromEntity(this.id)?.animator.StopAnimation("toolnone");
  }

  async Attack1() {
    if (!this.environment.isServer && !this.environment.isPlayback) {
      startBufferCreation();
      this.environment.network.SendPacket(new NetworkPacket(`${NETWORK_ID}c_activate`));

      return;
    }

    if (!this.isEquipped || !this.canAttack) return;
    this.canAttack = false;

    const currentTime = time();

    if (!this.environment.isPlayback)
      this.activationCount++;

    if (currentTime - this.lastActiveTime <= 0.2)
      this.Lunge().expect();
    else
      this.Swing().expect();

    this.lastActiveTime = currentTime;
    this.currentState = SwordState.Idle;
    this.canAttack = true;
  }

  async Lunge() {
    if (!this.isEquipped) return;
    getPlayermodelFromEntity(this.id)?.animator.PlayAnimation("toollunge", "Action3", true);
    getPlayermodelFromEntity(this.id)?.animator.StopAnimation("toolslash");

    this.currentState = SwordState.Lunge;
    this.stateChanged.Fire(this.currentState);

    task.wait(1);

    this.currentState = SwordState.Idle;
    this.stateChanged.Fire(this.currentState);
    getPlayermodelFromEntity(this.id)?.animator.StopAnimation("toollunge");
  }

  async Swing() {
    if (!this.isEquipped) return;
    getPlayermodelFromEntity(this.id)?.animator.StopAnimation("toollunge");
    getPlayermodelFromEntity(this.id)?.animator.PlayAnimation("toolslash", "Action2", true);

    this.currentState = SwordState.Swing;
    this.stateChanged.Fire(this.currentState);
  }
}

// # Bindings & misc
registerEntityClass("SwordPlayerEntity", SwordPlayerEntity);

// Server
GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  env.entity.entityCreated.Connect(entity => {
    if (!entity.IsA("SwordPlayerEntity")) return;

    // Listen for state changes
    entity.stateChanged.Connect(() => {
      const packet = new NetworkPacket(`${NETWORK_ID}changed`);
      writeBufferString(entity.id);
      writeBufferU8(entity.currentState);
      env.network.SendPacket(packet);
    });
  });

  // Activation requests
  env.network.ListenPacket(`${NETWORK_ID}c_activate`, (sender, reader) => {
    if (!sender) return;

    const entity = getPlayerEntityFromController(env.entity, tostring(sender.GetAttribute(gameValues.usersessionid)));
    if (!entity || !entity.IsA("SwordPlayerEntity")) return;

    entity.Attack1();
  });

  // Replicating entities
  env.lifecycle.BindTickrate(() => {
    const entitiesList = env.entity.getEntitiesThatIsA("SwordPlayerEntity");

    const packet = new NetworkPacket(`${NETWORK_ID}sync`);

    writeBufferU8(math.min(entitiesList.size(), 255)); // Yes... I know this limits only up to 255 entities, dickhead.
    for (const ent of entitiesList)
      writeBufferString(ent.id);
    env.network.SendPacket(packet);

    for (const ent of env.entity.getEntitiesThatIsA("SwordPlayerEntity")) {
      const packet = new NetworkPacket(`${NETWORK_ID}replication`);
      ent.WriteStateBuffer();
      env.network.SendPacket(packet);
    }
  });

  // Client state updating
  env.network.ListenPacket(`${NETWORK_ID}c_stateupd`, (sender, reader) => {
    if (!sender) return;

    const entityId = reader.string(); // Entity ID can be read from here due to PlayerEntity writing it first

    const entity = env.entity.entities.get(entityId);
    if (!entity?.IsA("SwordPlayerEntity")) return;
    if (entity.GetUserFromController() !== sender) {
      RaposoConsole.Warn(`Invalid ${SwordPlayerEntity} state update from ${sender}.`);
      return;
    }

    entity.ApplyStateBuffer(reader);
  });
});

// Client
GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (env.isServer) return;
  
  let hasEntityInQueue = false;

  // Entity replication
  env.network.ListenPacket(`${NETWORK_ID}sync`, (sender, reader) => {
    if (hasEntityInQueue) return; // Skip if entities are currently being created.
    // ! MIGHT RESULT IN THE GAME HANGING FROM TIME TO TIME !

    const listedServerEntities = new Set<EntityId>();

    const amount = reader.u8();

    for (let i = 0; i < amount; i++) {
      const entityId = reader.string();

      let entity = env.entity.entities.get(entityId);
      if (!entity) {
        hasEntityInQueue = true;

        entity = env.entity.createEntity("SwordPlayerEntity", entityId, "", 1).expect();
        hasEntityInQueue = false;
      }

      listedServerEntities.add(entityId);
    }

    // Deleting unlisted entities
    for (const ent of env.entity.getEntitiesThatIsA("SwordPlayerEntity")) {
      if (listedServerEntities.has(ent.id)) continue;
      env.entity.killThisFucker(ent);
    }
  });

  // Entity replication
  env.network.ListenPacket(`${NETWORK_ID}replication`, (sender, reader) => {
    const entityId = reader.string(); // Entity ID can be read from here due to PlayerEntity writing it first

    const entity = env.entity.entities.get(entityId);
    if (!entity?.IsA("SwordPlayerEntity")) return;

    entity.ApplyStateBuffer(reader);
  });

  // Client state update
  env.lifecycle.BindTickrate(() => {
    const entity = getLocalPlayerEntity(env);
    if (!entity || !entity.IsA("SwordPlayerEntity") || entity.health <= 0) return;

    const packet = new NetworkPacket(`${NETWORK_ID}c_stateupd`);
    entity.WriteStateBuffer();
    env.network.SendPacket(packet);
  });

  // Sword / attack changes
  env.network.ListenPacket(`${NETWORK_ID}changed`, (sender, reader) => {
    const entityId = reader.string();
    const newState = reader.u8();

    const targetEntity = env.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("SwordPlayerEntity")) return;
    if (targetEntity.currentState === newState) return;

    if (newState === SwordState.Lunge)
      targetEntity.Lunge();

    if (newState === SwordState.Swing)
      targetEntity.Swing();
  });
});
