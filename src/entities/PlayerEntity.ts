import { Debris, Players, RunService, TweenService } from "@rbxts/services";
import { modelsFolder } from "folders";
import { gameValues, PlayerTeam } from "gamevalues";
import WorldProvider from "providers/WorldProvider";
import { BufferReader } from "util/bufferreader";
import { BufferByteType, writeBufferBool, writeBufferI16, writeBufferString, writeBufferU16, writeBufferU64, writeBufferU8, writeBufferVector } from "util/bufferwriter";
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

const positionDifferenceThreshold = 1;
const playermodelTweenPositionThreshold = 5;
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

function InsertEntityPlayermodel(entity: PlayerEntity) {
  const humanoidModel = modelsFolder.WaitForChild("PlayerEntityHumanoidRig", 1)?.Clone() as CharacterModel | undefined;
  assert(humanoidModel, `No PlayerEntityHumanoidRig has been found on the models folder.`);

  humanoidModel.WaitForChild("HumanoidRootPart");
  humanoidModel.WaitForChild("Humanoid");
  humanoidModel.Humanoid.WaitForChild("Animator");
  humanoidModel.WaitForChild("Torso");

  humanoidModel.Name = entity.id;
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

  entity.AssociateInstance(humanoidModel);

  const refreshAppearance = () => {
    const controller = entity.GetUserFromController() || entity.GetUserFromNetworkOwner();
    if (!controller) return;

    fetchHumanoidDescription(controller.UserId).andThen(val => {
      if (!val) return;
      entity.humanoidModel?.Humanoid.ApplyDescription(val);
    });
  };

  const rigManager = new PlayermodelRigManager(humanoidModel);

  const unbindConnection1 = entity.environment.lifecycle.BindLateUpdate(() => {
    const rootPart = humanoidModel?.HumanoidRootPart;
    const isLocalEntity = entity.GetUserFromController() === Players.LocalPlayer;

    rigManager.animator.velocity = rootPart.AssemblyLinearVelocity || Vector3.zero;
    rigManager.animator.is_grounded = entity.grounded;
    rigManager.animator.Update();

    // Update highlight
    let fillColor = colorTable.spectatorsColor;
    if (entity.team === PlayerTeam.Defenders) fillColor = colorTable.defendersColor;
    if (entity.team === PlayerTeam.Raiders) fillColor = colorTable.raidersColor;

    rigManager.highlight.Enabled = true;
    rigManager.highlight.OutlineColor = Color3.fromHex(fillColor);
    rigManager.highlight.DepthMode = isLocalEntity ? Enum.HighlightDepthMode.AlwaysOnTop : Enum.HighlightDepthMode.Occluded;

    if (!isLocalEntity) {
      let localEntity: PlayerEntity | undefined;

      for (const ent of entity.environment.entity.getEntitiesThatIsA("PlayerEntity")) {
        if (ent === entity) continue;
        if (ent.GetUserFromController() !== Players.LocalPlayer) continue;
        localEntity = ent;
        break;
      }

      if (localEntity)
        rigManager.highlight.DepthMode = entity.team === localEntity.team ? Enum.HighlightDepthMode.AlwaysOnTop : Enum.HighlightDepthMode.Occluded;
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

  entity.OnDelete(() => {
    unbindConnection1();

    humanoidModel.Destroy();
    rawset(entity, "humanoidModel", undefined);
  });
  rawset(entity, "humanoidModel", humanoidModel);

  entity.died.Connect(() => {
    rigManager.SetMaterial();
    rigManager.SetTransparency();
    rigManager.SetJointsEnabled(false);

    for (const inst of humanoidModel.GetChildren()) {
      if (!inst.IsA("BasePart")) continue;

      inst.AssemblyLinearVelocity = entity.velocity;
      inst.AssemblyAngularVelocity = entity.velocity;
    }
  });

  entity.spawned.Connect(() => {
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
  createHealthBarForEntity(entity, humanoidModel.HumanoidRootPart);
  entity.animator = rigManager.animator;
}

// # Class
export default class PlayerEntity extends HealthEntity {
  readonly classname: keyof GameEntities = "PlayerEntity";

  health = 0;
  maxHealth = 100;

  private serverPosition = this.position;
  private serverRotation = this.rotation;

  pendingTeleport = true;
  grounded = false;
  anchored = false;

  humanoidModel: CharacterModel | undefined;
  animator: CharacterAnimationManager | undefined;

  team = PlayerTeam.Spectators;
  networkOwner = ""; // For BOT entities
  controller = "";
  appearanceId = 1;

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

  constructor() {
    super();
    this.inheritanceList.add("PlayerEntity");

    this.OnSetupFinished(() => {
      if (this.environment.isServer) return;
      InsertEntityPlayermodel(this);
    });

    this.RegisterNetworkableProperty("controller", BufferByteType.str);
    this.RegisterNetworkableProperty("appearanceId", BufferByteType.u64);
    this.RegisterNetworkableProperty("networkOwner", BufferByteType.str);
    this.RegisterNetworkableProperty("team", BufferByteType.u8);

    this.RegisterNetworkableProperty("pendingTeleport", BufferByteType.bool);
    this.RegisterNetworkableProperty("grounded", BufferByteType.bool);
    this.RegisterNetworkableProperty("anchored", BufferByteType.bool);

    this.RegisterNetworkablePropertyHandler("grounded", (ctx, val) => {
      if (this.environment.isServer) return;
      if (this.GetUserFromController() === Players.LocalPlayer || this.GetUserFromNetworkOwner() === Players.LocalPlayer) return;

      this.grounded = val;
    });

    this.RegisterNetworkablePropertyHandler("position", (ctx, val) => {
      const controller = this.GetUserFromController();
      const netController = this.GetUserFromNetworkOwner();
      const isLocalPlayer = !this.environment.isPlayback && controller === Players.LocalPlayer;
      const isLocalBot = !this.environment.isPlayback && netController === Players.LocalPlayer;
      const isLocalControl = isLocalPlayer || isLocalBot;

      if (!isLocalControl)
        this.position = val;
      this.serverPosition = val;

      if (RunService.IsStudio()) {
        const rotation = CFrame.Angles(math.rad(this.serverRotation.Y), math.rad(this.serverRotation.X), math.rad(this.serverRotation.Z));
        const cf = new CFrame(val).mul(rotation);

        const visualIndicator = new Instance("BoxHandleAdornment");
        visualIndicator.Adornee = workspace;
        visualIndicator.CFrame = cf;
        visualIndicator.Size = new Vector3(4, 5, 1);
        visualIndicator.Transparency = 0.5;
        visualIndicator.Color3 = new Color3(0, 1, 1);
        visualIndicator.Parent = workspace;

        Debris.AddItem(visualIndicator, this.environment.lifecycle.tickrate);
      }
    });

    this.RegisterNetworkablePropertyHandler("rotation", (ctx, val) => {
      const controller = this.GetUserFromController();
      const netController = this.GetUserFromNetworkOwner();
      const isLocalPlayer = !this.environment.isPlayback && controller === Players.LocalPlayer;
      const isLocalBot = !this.environment.isPlayback && netController === Players.LocalPlayer;
      const isLocalControl = isLocalPlayer || isLocalBot;

      if (!isLocalControl)
        this.rotation = val;
      this.serverRotation = val;
    });
  }

  Think(dt: number): void {
    const controller = this.GetUserFromController();
    const netController = this.GetUserFromNetworkOwner();
    const isLocalPlayer = !this.environment.isPlayback && !this.environment.isServer && controller === Players.LocalPlayer;
    const isLocalBot = !this.environment.isPlayback && !this.environment.isServer && netController === Players.LocalPlayer;
    const isLocalControl = isLocalPlayer || isLocalBot;

    if (!this.environment.isServer && DoesInstanceExist(this.humanoidModel)) {

      if (isLocalControl && (this.anchored || this.pendingTeleport)) {
        this.position = this.serverPosition;
        this.rotation = this.serverRotation;
        this.TeleportTo(this.ConvertOriginToCFrame());
      }

      this.humanoidModel.HumanoidRootPart.Anchored = isLocalControl && (this.anchored || this.pendingTeleport || this.health <= 0);
      this.grounded = isLocalControl && this.health > 0 && this.humanoidModel.Humanoid.FloorMaterial.Name !== "Air";

      if (!isLocalControl)
        this.TeleportTo(this.ConvertOriginToCFrame());
    }
  }

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

  WriteClientStateBuffer(): void {
    if (!this.environment.isServer && this.humanoidModel) {
      const pivot = this.humanoidModel.GetPivot();
      const [rotY, rotX, rotZ] = pivot.ToOrientation();

      writeBufferVector(pivot.Position);
      writeBufferVector(new Vector3(math.deg(rotX), math.deg(rotY), math.deg(rotZ)));
      writeBufferVector(this.humanoidModel.HumanoidRootPart?.AssemblyLinearVelocity ?? this.velocity);
    } else {
      writeBufferVector(this.position);
      writeBufferVector(this.rotation);
      writeBufferVector(this.velocity);
    }

    writeBufferBool(this.grounded);
  }

  ApplyClientReplicationBuffer(reader: ReturnType<typeof BufferReader>): void {
    const position = reader.vec();
    const rotation = reader.vec();
    const velocity = reader.vec();
    const grounded = reader.bool();

    const requestedHorPosition = new Vector2(position.X, position.Z);
    const originalHorPosition = new Vector2(this.position.X, this.position.Z);
    const differenceMagnitute = originalHorPosition.sub(requestedHorPosition).Magnitude;

    if (this.pendingTeleport && differenceMagnitute <= positionDifferenceThreshold) {
      this.pendingTeleport = false;
    }

    if (!this.pendingTeleport && !this.anchored)
      this.position = position;
    this.rotation = rotation;
    this.velocity = velocity;
    this.grounded = grounded;
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

  // Teleporting & tweening
  private currentTween: Tween | undefined;

  TeleportTo(origin: CFrame) {
    const controller = this.GetUserFromController();
    const netController = this.GetUserFromNetworkOwner();
    const isLocalPlayer = !this.environment.isPlayback && !this.environment.isServer && controller === Players.LocalPlayer;
    const isLocalBot = !this.environment.isPlayback && !this.environment.isServer && netController === Players.LocalPlayer;

    const CancelTween = () => {
      if (this.environment.isServer || !this.humanoidModel) return;
      if (!DoesInstanceExist(this.humanoidModel) || !DoesInstanceExist(this.humanoidModel.PrimaryPart)) return;

      const currentPosition = this.humanoidModel.PrimaryPart.CFrame;

      if (this.currentTween?.PlaybackState === Enum.PlaybackState.Playing)
        this.currentTween?.Cancel();
      this.currentTween?.Destroy();
      this.currentTween = undefined;

      this.humanoidModel.PrimaryPart.PivotTo(currentPosition);
    };

    if (!this.environment.isServer && DoesInstanceExist(this.humanoidModel)) {
      const currentPosition = this.humanoidModel.PrimaryPart?.Position || this.position;
      const direction = currentPosition.sub(origin.Position);

      CancelTween();

      if ((isLocalBot || isLocalPlayer) || direction.Magnitude > playermodelTweenPositionThreshold) {
        this.humanoidModel.PivotTo(origin);
        this.humanoidModel.HumanoidRootPart.AssemblyLinearVelocity = Vector3.zero;
      } else {
        this.currentTween = TweenService.Create(this.humanoidModel.PrimaryPart!, new TweenInfo(this.environment.lifecycle.tickrate, Enum.EasingStyle.Linear), { CFrame: this.ConvertOriginToCFrame() });
        this.currentTween.Play();

        this.humanoidModel.HumanoidRootPart.AssemblyLinearVelocity = direction;
      }
    }

    this.position = origin.Position;
    this.pendingTeleport = true;
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
