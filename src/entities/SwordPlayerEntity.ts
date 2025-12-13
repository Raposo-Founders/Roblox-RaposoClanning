import * as Services from "@rbxts/services";
import GameEnvironment from "core/GameEnvironment";
import { NetworkPacket } from "core/NetworkModel";
import { gameValues } from "gamevalues";
import { RaposoConsole } from "logging";
import { BufferReader } from "util/bufferreader";
import { BufferByteType, startBufferCreation, writeBufferBool, writeBufferF32, writeBufferString, writeBufferU8, writeBufferVector } from "util/bufferwriter";
import Signal from "util/signal";
import { registerEntityClass } from ".";
import HealthEntity from "./HealthEntity";
import PlayerEntity, { getPlayerEntityFromController } from "./PlayerEntity";
import { getLocalPlayerEntity } from "controllers/LocalEntityController";
import { SoundsPath, SoundSystem } from "systems/SoundSystem";
import { DoesInstanceExist } from "util/utilfuncs";

// # Types
declare global {
  interface GameEntities {
    SwordPlayerEntity: typeof SwordPlayerEntity;
  }
}

// # Constants & variables
export enum SwordState {
  Idle = 5,
  Slash = 10,
  Lunge = 30,
}

const NETWORK_ID = "sword_";

// # Functions

// # Class
export class SwordPlayerEntity extends PlayerEntity {
  classname: keyof GameEntities = "SwordPlayerEntity";

  currentState = SwordState.Idle;
  hitboxTouched = new Signal<[target: HealthEntity, part: BasePart]>();
  stateChanged = new Signal<[newState: SwordState]>();

  isEquipped = false;
  lastStateTime = 0;
  private attackRequest: { time: number, handled: boolean }[] = [];

  constructor() {
    super();

    this.inheritanceList.add("SwordPlayerEntity");

    this.OnSetupFinished(() => {
      if (this.environment.isServer) return;

      this.spawned.Connect(() => this.Equip());
      this.died.Connect(() => this.Unequip());
    });

    this.RegisterNetworkableProperty("currentState", BufferByteType.u8);
    this.RegisterNetworkableProperty("isEquipped", BufferByteType.bool);

    this.RegisterNetworkablePropertyHandler("isEquipped", (ctx, val) => {
      if (this.GetUserFromController() === Services.Players.LocalPlayer || this.GetUserFromNetworkOwner() === Services.Players.LocalPlayer) return;
      this.isEquipped = val;
    });

    this.RegisterNetworkablePropertyHandler("currentState", (ctx, val) => {
      if (val !== this.currentState) {
        if (val === SwordState.Lunge)
          this.LungeAnimation();

        if (val === SwordState.Slash)
          this.SlashAnimation();
      }

      this.currentState = val;
    });
  }

  ApplyClientReplicationBuffer(reader: ReturnType<typeof BufferReader>): void {
    super.ApplyClientReplicationBuffer(reader);

    const isEquipped = reader.bool();

    if (this.isEquipped !== isEquipped)
      if (isEquipped)
        this.Equip();
      else
        this.Unequip();
  }

  WriteClientStateBuffer(): void {
    super.WriteClientStateBuffer();

    writeBufferBool(this.isEquipped);
  }

  Destroy(): void {
    this.hitboxTouched.Clear();
  }

  Equip() {
    if (this.isEquipped) return;

    this.isEquipped = true;
    this.animator?.PlayAnimation("toolnone", "Action", true);
  }

  Unequip() {
    if (!this.isEquipped) return;

    this.isEquipped = false;
    this.animator?.StopAnimation("toolnone");
  }

  Think(dt: number): void {
    super.Think(dt);

    const currentTime = time();

    if (this.environment.isServer) {

      let targetState = this.currentState;
      const stateTimeDifference = currentTime - this.lastStateTime;

      let hasAttackRequest = false;

      for (const request of this.attackRequest) {
        if (request.handled) continue;
        hasAttackRequest = true;
        break;
      }

      if (this.currentState !== SwordState.Lunge && hasAttackRequest && this.isEquipped) {
        // Get attack time difference
        const latestAttackTime = this.attackRequest[0];
        const previousAttackTime = this.attackRequest[1] ?? { time: 0, handled: false };
        const attackTimeDifference = latestAttackTime.time - previousAttackTime.time;

        targetState = attackTimeDifference <= 0.2 ? SwordState.Lunge : SwordState.Slash;

        if (targetState === SwordState.Lunge)
          this.LungeAnimation();
        else
          this.SlashAnimation();

        latestAttackTime.handled = true;
        previousAttackTime.handled = true;

        if (targetState === SwordState.Lunge)
          this.attackRequest.clear();
      }

      if ((this.currentState === SwordState.Slash && stateTimeDifference > 0.1) || (this.currentState === SwordState.Lunge && stateTimeDifference > 1)) {
        targetState = SwordState.Idle;
      }

      if (targetState !== this.currentState) {
        this.currentState = targetState;
        this.lastStateTime = currentTime;
        this.stateChanged.Fire(targetState);

        const packet = new NetworkPacket(`${NETWORK_ID}swordState`);
        packet.reliable = false;
        writeBufferString(this.id);
        writeBufferU8(targetState);
        this.environment.network.SendPacket(packet);
      }

      // Remove handled attack requests
      if (this.attackRequest.size() > 0) {
        let latestAttackTime = 0;

        for (let i = 0; i < this.attackRequest.size(); i++) {
          const element = this.attackRequest[i];
          if (!element) continue;

          if (latestAttackTime < element.time)
            latestAttackTime = element.time;

          if (element.handled && latestAttackTime - element.time >= 1) {
            this.attackRequest.remove(i);
            i--;
          }
        }
      }
    }
  }

  async LungeAnimation() {
    if (!this.isEquipped) return;
    this.animator?.PlayAnimation("toollunge", "Action3", true);
    this.animator?.StopAnimation("toolslash");

    if (this.humanoidModel && DoesInstanceExist(this.humanoidModel)) {
      const sound = new SoundSystem.WorldSoundInstance();
      sound.SetAssetPath(SoundsPath.Lunge);
      sound.SetParent(this.humanoidModel.HumanoidRootPart);
      sound.clearOnFinish = true;
      sound.Play();
    }

    task.wait(1);

    this.animator?.StopAnimation("toollunge");
  }

  async SlashAnimation() {
    if (!this.isEquipped) return;
    this.animator?.StopAnimation("toollunge");
    this.animator?.PlayAnimation("toolslash", "Action2", true);

    if (this.humanoidModel && DoesInstanceExist(this.humanoidModel)) {
      const sound = new SoundSystem.WorldSoundInstance();
      sound.SetAssetPath(SoundsPath.Slash);
      sound.SetParent(this.humanoidModel.HumanoidRootPart);
      sound.clearOnFinish = true;
      sound.Play();
    }
  }

  AttackRequest(attackTime = time()) {
    if (!this.environment.isServer) {
      const packet = new NetworkPacket(`${NETWORK_ID}c_activate`);
      writeBufferF32(time());
      this.environment.network.SendPacket(packet);
      return;
    }

    if (this.currentState === SwordState.Lunge) return;

    this.attackRequest.push({ time: attackTime, handled: false });
    this.attackRequest.sort((a, b) => a.time > b.time);
  }
}

// # Bindings & misc
registerEntityClass("SwordPlayerEntity", SwordPlayerEntity);

// Server
GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  // Activation requests
  env.network.ListenPacket(`${NETWORK_ID}c_activate`, (sender, reader) => {
    if (!sender) return;

    const entity = getPlayerEntityFromController(env.entity, tostring(sender.GetAttribute(gameValues.usersessionid)));
    if (!entity || !entity.IsA("SwordPlayerEntity")) return;

    const clientTime = reader.f32();

    entity.AttackRequest(clientTime);
  });

  // Client state updating
  env.network.ListenPacket(`${NETWORK_ID}c_stateupd`, (sender, reader) => {
    if (!sender) return;

    const entity = getPlayerEntityFromController(env.entity, tostring(sender.GetAttribute(gameValues.usersessionid)));
    if (!entity?.IsA("SwordPlayerEntity") || entity.GetUserFromController() !== sender) {
      RaposoConsole.Warn(`Invalid ${SwordPlayerEntity} state update from ${sender}.`);
      return;
    }

    entity.ApplyClientReplicationBuffer(reader);
  });
});

// Client
GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (env.isServer) return;

  // Client state update
  env.lifecycle.BindTickrate(() => {
    const entity = getLocalPlayerEntity(env);
    if (!entity || !entity.IsA("SwordPlayerEntity") || entity.health <= 0) return;

    const packet = new NetworkPacket(`${NETWORK_ID}c_stateupd`);
    packet.reliable = true;

    entity.WriteClientStateBuffer();
    env.network.SendPacket(packet);
  });

  // Sword / attack changes
  env.network.ListenPacket(`${NETWORK_ID}swordState`, (sender, reader) => {
    const entityId = reader.string();
    const newState = reader.u8();

    const targetEntity = env.entity.entities.get(entityId);
    if (!targetEntity || !targetEntity.IsA("SwordPlayerEntity")) return;

    if (newState === SwordState.Lunge)
      targetEntity.LungeAnimation();

    if (newState === SwordState.Slash)
      targetEntity.SlashAnimation();
  });
});
