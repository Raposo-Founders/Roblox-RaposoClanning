import { Players, TweenService } from "@rbxts/services";
import { modelsFolder } from "folders";
import { gameValues, PlayerTeam } from "gamevalues";
import WorldProvider from "providers/WorldProvider";
import { BufferReader } from "util/bufferreader";
import { writeBufferBool, writeBufferString, writeBufferU16, writeBufferU64, writeBufferU8 } from "util/bufferwriter";
import Signal from "util/signal";
import { EntityManager, registerEntityClass } from ".";
import HealthEntity from "./HealthEntity";
import { DoesInstanceExist } from "util/utilfuncs";
import { CharacterAnimationManager, PlayermodelRigManager } from "providers/PlayermodelRigManager";
import { colorTable } from "UI/values";
import { createHealthBarForEntity } from "providers/healthbar";
import { RaposoConsole } from "logging";

// # Types
declare global {
  interface GameEntities {
    PlayerEntity: typeof PlayerEntity;
  }
}

// # Constants & variables
const activePlayermodelTweens = new Map<string, Tween>();

const positionDifferenceThreshold = 3;
const humanoidFetchDescriptionMaxAttempts = 5;

// # Functions
export async function fetchHumanoidDescription(userid: number) {
  userid = math.max(userid, 1);

  let description: HumanoidDescription | undefined;
  let totalAttempts = 0;

  while (description === undefined) {
    totalAttempts++;
    if (totalAttempts >= humanoidFetchDescriptionMaxAttempts) {
      RaposoConsole.Warn(`Failed to fetch HumanoidDescription ${userid} after ${humanoidFetchDescriptionMaxAttempts} attempts.`);
      break;
    }

    const [success, obj] = pcall(() => Players.GetHumanoidDescriptionFromUserId(math.max(userid, 1)));
    if (!success) {
      RaposoConsole.Warn(`Failed to fetch HumanoidDescription, retrying in 5 seconds...\n${obj}`);
      task.wait(5);
      continue;
    }

    description = obj;
    break;
  }

  return description;
}

export function getPlayerEntityFromController(environment: EntityManager, controller: string) {
  for (const ent of environment.getEntitiesThatIsA("PlayerEntity"))
    if (ent.controller === controller)
      return ent;
}

// # Class
export default class PlayerEntity extends HealthEntity {
  readonly classname: keyof GameEntities = "PlayerEntity";

  readonly spawned = new Signal<[origin: CFrame]>();
  health = 0;
  maxHealth = 100;

  pendingTeleport = false;
  origin = new CFrame();
  size = new Vector3(2, 5, 2);
  velocity = new Vector3();
  grounded = false;
  anchored = false;

  humanoidModel: CharacterModel | undefined;
  animator: CharacterAnimationManager | undefined;

  team = PlayerTeam.Spectators;
  networkOwner = ""; // For BOT entities

  caseInfo = {
    isExploiter: false,
    isDegenerate: false,
  };

  stats = {
    kills: 0,
    deaths: 0,
    ping: 0,
    damage: 0,
    country: "US",
  };

  constructor(public controller: string, public appearanceId = 1) {
    super();
    this.inheritanceList.add("PlayerEntity");

    this.OnSetupFinished(() => {
      if (this.environment.isServer) return;

      const humanoidModel = modelsFolder.WaitForChild("PlayerEntityHumanoidRig", 1)?.Clone() as CharacterModel | undefined;
      assert(humanoidModel, `No PlayerEntityHumanoidRig has been found on the models folder.`);

      humanoidModel.WaitForChild("HumanoidRootPart");
      humanoidModel.WaitForChild("Humanoid");
      humanoidModel.Humanoid.WaitForChild("Animator");
      humanoidModel.WaitForChild("Torso");

      humanoidModel.Name = this.id;
      humanoidModel.Parent = WorldProvider.ObjectsFolder;
      humanoidModel.Humanoid.Health = 1;
      humanoidModel.Humanoid.MaxHealth = 1;
      humanoidModel.Humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
      humanoidModel.Humanoid.HealthDisplayDistance = 0;
      humanoidModel.Humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff;
      humanoidModel.Humanoid.SetStateEnabled("PlatformStanding", false);
      humanoidModel.Humanoid.SetStateEnabled("Ragdoll", false);
      humanoidModel.Humanoid.SetStateEnabled("Physics", false);
      humanoidModel.Humanoid.SetStateEnabled("Dead", false);
      humanoidModel.Humanoid.BreakJointsOnDeath = false;

      this.AssociateInstance(humanoidModel);

      const refreshAppearance = () => {
        const controller = this.GetUserFromController() || this.GetUserFromNetworkOwner();
        if (!controller) return;

        fetchHumanoidDescription(controller.UserId).andThen(val => {
          if (!val) return;
          this.humanoidModel?.Humanoid.ApplyDescription(val);
        });
      };

      const rigManager = new PlayermodelRigManager(humanoidModel);

      const unbindConnection1 = this.environment.lifecycle.BindLateUpdate(() => {
        const rootPart = humanoidModel?.HumanoidRootPart;
        const isLocalEntity = this.GetUserFromController() === Players.LocalPlayer;

        rigManager.animator.velocity = rootPart.AssemblyLinearVelocity || Vector3.zero;
        rigManager.animator.is_grounded = this.grounded;
        rigManager.animator.Update();

        // Update highlight
        let fillColor = colorTable.spectatorsColor;
        if (this.team === PlayerTeam.Defenders) fillColor = colorTable.defendersColor;
        if (this.team === PlayerTeam.Raiders) fillColor = colorTable.raidersColor;

        rigManager.highlight.Enabled = true;
        rigManager.highlight.OutlineColor = Color3.fromHex(fillColor);
        rigManager.highlight.DepthMode = isLocalEntity ? Enum.HighlightDepthMode.AlwaysOnTop : Enum.HighlightDepthMode.Occluded;

        if (!isLocalEntity) {
          let localEntity: PlayerEntity | undefined;

          for (const ent of this.environment.entity.getEntitiesThatIsA("PlayerEntity")) {
            if (ent === this) continue;
            if (ent.GetUserFromController() !== Players.LocalPlayer) continue;
            localEntity = ent;
            break;
          }

          if (localEntity)
            rigManager.highlight.DepthMode = this.team === localEntity.team ? Enum.HighlightDepthMode.AlwaysOnTop : Enum.HighlightDepthMode.Occluded;
        }
      });

      for (const inst of humanoidModel.GetDescendants()) {
        if (inst.ClassName.match("Script")[0]) {
          inst.Destroy();
          continue;
        }

        if (inst.IsA("BasePart")) {
          inst.CollisionGroup = "Playermodel";
          inst.SetAttribute("OG_MATERIAL", inst.Material.Name);

          continue;
        }
      }

      this.OnDelete(() => {
        unbindConnection1();

        humanoidModel.Destroy();
        rawset(this, "humanoidModel", undefined);
      });
      rawset(this, "humanoidModel", humanoidModel);

      this.died.Connect(() => {
        rigManager.SetMaterial();
        rigManager.SetTransparency();
        rigManager.SetJointsEnabled(false);

        for (const inst of humanoidModel.GetChildren()) {
          if (!inst.IsA("BasePart")) continue;

          inst.AssemblyLinearVelocity = this.velocity;
          inst.AssemblyAngularVelocity = this.velocity;
        }
      });

      this.spawned.Connect(() => {
        rigManager.SetMaterial();
        rigManager.SetTransparency();
        rigManager.SetJointsEnabled(true);

        for (const inst of humanoidModel.GetChildren()) {
          if (!inst.IsA("BasePart")) continue;

          inst.AssemblyLinearVelocity = new Vector3();
          inst.AssemblyAngularVelocity = new Vector3();
        }

        refreshAppearance();
      });

      refreshAppearance();
      createHealthBarForEntity(this, humanoidModel.HumanoidRootPart);
      this.animator = rigManager.animator;
    });
  }

  Think(dt: number): void { }

  GetUserFromController() {
    if (this.controller === "") return;

    for (const user of Players.GetPlayers()) {
      if (user.GetAttribute(gameValues.usersessionid) !== this.controller) continue;
      return user;
    }
  }

  GetUserFromNetworkOwner() {
    if (this.networkOwner === "") return;

    for (const user of Players.GetPlayers()) {
      if (user.GetAttribute(gameValues.usersessionid) !== this.networkOwner) continue;
      return user;
    }
  }

  WriteStateBuffer(): void {
    writeBufferString(this.id);

    super.WriteStateBuffer();

    writeBufferBool(this.pendingTeleport);
    writeBufferBool(this.grounded);

    writeBufferU8(this.team);
    writeBufferString(this.controller);
    writeBufferU64(this.appearanceId);
    writeBufferU16(this.stats.kills);
    writeBufferU16(this.stats.deaths);
    writeBufferU16(this.stats.ping);
    writeBufferU16(this.stats.damage);
    writeBufferString(this.stats.country);

    writeBufferBool(this.caseInfo.isExploiter);
    writeBufferBool(this.caseInfo.isDegenerate);

    writeBufferString(this.networkOwner);
  }

  ApplyStateBuffer(reader: ReturnType<typeof BufferReader>): void {
    const controller = this.GetUserFromController();
    const netController = this.GetUserFromNetworkOwner();
    const isLocalPlayer = !this.environment.isPlayback && !this.environment.isServer && controller === Players.LocalPlayer;
    const isLocalBot = !this.environment.isPlayback && !this.environment.isServer && netController === Players.LocalPlayer;

    const originalPosition = this.origin;

    const originalHealth = this.health;
    const originalMaxHealth = this.maxHealth;

    super.ApplyStateBuffer(reader);

    const pendingTeleport = reader.bool();
    const grounded = reader.bool();

    const teamIndex = reader.u8();
    const controllerId = reader.string();
    const appearanceId = reader.u64();
    const kills = reader.u16();
    const deaths = reader.u16();
    const ping = reader.u16();
    const damage = reader.u16();
    const country = reader.string();

    const isExploiter = reader.bool();
    const isDegenerate = reader.bool();

    const networkOwner = reader.string();

    if (this.environment.isServer && !this.environment.isPlayback) {
      const requestedHorPosition = new Vector2(this.origin.X, this.origin.Z);
      const originalHorPosition = new Vector2(originalPosition.X, originalPosition.Z);
      const differenceMagnitute = originalHorPosition.sub(requestedHorPosition).Magnitude;

      this.pendingTeleport = false;

      if (differenceMagnitute > positionDifferenceThreshold) {
        this.origin = originalPosition;
        this.pendingTeleport = true;
      }

      this.health = originalHealth;
      this.maxHealth = originalMaxHealth;
    }

    // Client - Update position
    if (!this.environment.isServer) {
      // Hide player
      if (!this.environment.isPlayback && !isLocalPlayer)
        if (this.team === PlayerTeam.Spectators || this.health <= 0)
          this.origin = new CFrame(0, -1000, 0);

      if (isLocalPlayer && !pendingTeleport)
        this.origin = originalPosition;

      if (this.environment.isPlayback || (!isLocalPlayer && !isLocalBot) || (isLocalPlayer && pendingTeleport) || (isLocalBot && pendingTeleport))
        this.TeleportTo(this.origin);
    }

    if (this.environment.isServer || this.environment.isPlayback)
      this.grounded = grounded;
    else
      if (!isLocalPlayer && !isLocalBot)
        this.grounded = grounded;

    this.anchored = pendingTeleport;

    if (this.environment.isPlayback || !this.environment.isServer) {
      if (this.health !== originalHealth) {
        if (this.health <= 0 && originalHealth > 0)
          this.died.Fire();

        if (this.health > 0 && originalHealth <= 0)
          this.spawned.Fire(this.origin);
      }

      this.stats.kills = kills;
      this.stats.deaths = deaths;
      this.stats.ping = ping;
      this.stats.damage = damage;
      this.stats.country = country;

      this.team = teamIndex;
      this.controller = controllerId;
      this.appearanceId = appearanceId;

      this.caseInfo.isExploiter = isExploiter;
      this.caseInfo.isDegenerate = isDegenerate;

      this.networkOwner = networkOwner;

      // Tween our playermodel
      if (!this.environment.isServer && this.humanoidModel && DoesInstanceExist(this.humanoidModel.PrimaryPart) && (!isLocalBot && !isLocalPlayer)) {
        const tweenId = `${this.environment.id}_${this.id}`;

        let tween = activePlayermodelTweens.get(tweenId);

        if (tween) {
          const currentPosition = this.humanoidModel.GetPivot();

          if (tween.PlaybackState === Enum.PlaybackState.Playing)
            tween.Cancel();
          tween.Destroy();
          tween = undefined;

          this.humanoidModel?.PivotTo(currentPosition);
        }

        tween = TweenService.Create(this.humanoidModel.PrimaryPart!, new TweenInfo(this.environment.lifecycle.tickrate, Enum.EasingStyle.Linear), { CFrame: this.origin });

        activePlayermodelTweens.set(tweenId, tween);
        tween.Play();
      }
    }
  }

  Spawn(origin?: CFrame) {
    // Get the target spawn for the current team
    if (!origin) {
      const availableSpawns: BasePart[] = [];

      for (const inst of WorldProvider.ObjectsFolder.GetChildren()) {
        if (!inst.IsA("BasePart") || inst.Name !== `info_player_${PlayerTeam[this.team].lower()}`) continue;
        availableSpawns.push(inst);
      }

      availableSpawns.sort((a, b) => {
        return (tonumber(a.GetAttribute("LastUsedTime")) || 0) < (tonumber(b.GetAttribute("LastUsedTime")) || 0);
      });

      origin = availableSpawns[0].CFrame;
      availableSpawns[0].SetAttribute("LastUsedTime", time());
    }

    this.maxHealth = 100;
    this.health = this.maxHealth;

    this.canDealDamage = false;

    task.spawn(() => {
      task.wait(3);
      this.canDealDamage = true;
    });

    this.TeleportTo(origin);
    this.spawned.Fire(origin);
  }

  TeleportTo(origin: CFrame) {
    this.origin = origin;
    this.pendingTeleport = true;

    if (!this.environment.isServer && this.humanoidModel) {
      this.humanoidModel.PivotTo(this.origin);
      this.humanoidModel.HumanoidRootPart.AssemblyLinearVelocity = Vector3.zero;
    }
  }

  takeDamage(amount: number, attacker?: import("./WorldEntity")): void {
    if (this.health <= 0) return;

    super.takeDamage(amount, attacker);

    if (attacker?.IsA("PlayerEntity") && amount > 0)
      attacker.stats.damage += amount;

    if (this.health <= 0) {
      this.canDealDamage = false;
      this.stats.deaths++;

      if (attacker?.IsA("PlayerEntity"))
        attacker.stats.kills++;
    }
  }

  Destroy(): void { }
}

// # Misc
registerEntityClass("PlayerEntity", PlayerEntity);
