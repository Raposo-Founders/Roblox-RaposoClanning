import ColorUtils from "@rbxts/colour-utils";
import { Players, RunService, TweenService } from "@rbxts/services";
import GameEnvironment from "core/GameEnvironment";
import { NetworkDataStreamer, NetworkPacket } from "core/NetworkModel";
import BaseEntity from "entities/BaseEntity";
import HealthEntity from "entities/HealthEntity";
import { PlayerTeam } from "gamevalues";
import { SwordPlayerEntity, SwordState } from "entities/SwordPlayerEntity";
import { modelsFolder } from "folders";
import { getInstanceDefinedValue } from "gamevalues";
import { RaposoConsole } from "logging";
import WorldProvider, { ObjectsFolder } from "providers/WorldProvider";
import { SoundsPath, SoundSystem } from "systems/SoundSystem";
import { colorTable } from "UI/values";
import { writeBufferString, writeBufferU8 } from "util/bufferwriter";
import { generateTracelineParameters } from "util/traceparam";
import { DoesInstanceExist } from "util/utilfuncs";

// # Constants & variables
const NETWORK_ID = "swordcon_";
const SWORD_MODEL = modelsFolder.WaitForChild("Sword") as BasePart;

const trackingEntityHits = new Map<string, Set<BasePart>>();
const swordSize = new Vector3(1, 0.8, 4);
const swordGripOffset = new CFrame(0, -1, -1.5).mul(CFrame.Angles(0, math.rad(180), math.rad(-90)));
const swordLungeOffset = new CFrame(-1.5, 0, -1.5).mul(CFrame.Angles(0, -math.rad(90), 0));

const forcetieEnabled = getInstanceDefinedValue("ForcetieEnabled", false);
const teamHealingEnabled = getInstanceDefinedValue("TeamHealingEnabled", false);

enum NetworkSwordHitIndex {
  LocalToOther,
  OtherToLocal,
  BotToOther,
}

// # Functions
function CheckPlayers<T extends BaseEntity>(entity1: SwordPlayerEntity, entity2: T) {
  if (entity1.id === entity2.id) return;
  if (!entity2.IsA("HealthEntity")) return;

  if (entity2.IsA("PlayerEntity"))
    if (entity1.team ===PlayerTeam.Spectators || entity2.team ===PlayerTeam.Spectators) return;

  if (entity1.health <= 0 || entity2.health <= 0) {
    if (!forcetieEnabled) return;

    const lastAttacker = entity2.attackersList[0];
    if (!lastAttacker || time() - lastAttacker.time > 0.25) return;
  }

  if (!teamHealingEnabled && entity2.IsA("PlayerEntity"))
    if (entity1.team === entity2.team) return;

  return true;
}

function ClientWriteNetworkHit(network: NetworkDataStreamer, mode: NetworkSwordHitIndex, attacker: EntityId, victim: EntityId) {
  const packet = new NetworkPacket(`${NETWORK_ID}hit`);
  writeBufferU8(mode);
  writeBufferString(attacker);
  writeBufferString(victim);
  network.SendPacket(packet);
}

function ClientHandleHitboxTouched(attacker: SwordPlayerEntity, target: HealthEntity, part: BasePart, network: NetworkDataStreamer) {
  const spawnHitHighlight = (color: string) => {
    if (!part.Parent?.FindFirstChildWhichIsA("Humanoid")) return;

    const selectionBox = new Instance("SelectionBox");
    selectionBox.Parent = ObjectsFolder;
    selectionBox.SurfaceColor3 = Color3.fromHex(color);
    selectionBox.SurfaceTransparency = 0.5;
    selectionBox.Color3 = ColorUtils.Darken(Color3.fromHex(color), 0.75);
    selectionBox.Adornee = part;

    const tween = TweenService.Create(selectionBox, new TweenInfo(0.125, Enum.EasingStyle.Linear), { LineThickness: 0, SurfaceTransparency: 1 });
    tween.Completed.Once(() => {
      selectionBox.Destroy();
      tween.Destroy();
    });
    tween.Play();
  };

  let targetColor = colorTable.spectatorsColor;
  if (target.IsA("PlayerEntity") && target.team === PlayerTeam.Defenders) targetColor = colorTable.defendersColor;
  if (target.IsA("PlayerEntity") && target.team === PlayerTeam.Raiders) targetColor = colorTable.raidersColor;

  const isLocalBot = attacker.GetUserFromNetworkOwner() === Players.LocalPlayer;
  const attackerController = attacker.GetUserFromController();
  const victimController = target.IsA("PlayerEntity") ? target.GetUserFromController() : undefined;

  // If the attacker is a local bot
  if (isLocalBot) {
    spawnHitHighlight(targetColor);
    ClientWriteNetworkHit(network, NetworkSwordHitIndex.BotToOther, attacker.id, target.id);

    return;
  }

  // If the attacker is another player attacking us
  if (attackerController !== Players.LocalPlayer) {
    if (victimController !== Players.LocalPlayer) return; // Only allow if this attacker is attacking us

    spawnHitHighlight(targetColor);
    ClientWriteNetworkHit(network, NetworkSwordHitIndex.OtherToLocal, attacker.id, target.id);

    return;
  }

  // If we're the ones attacking
  if (attackerController === Players.LocalPlayer) {
    ClientWriteNetworkHit(network, NetworkSwordHitIndex.LocalToOther, attacker.id, target.id);
  }

  if (target.IsA("PlayerEntity"))
    spawnHitHighlight(targetColor);
}

function GetPartsInSwordHitbox(entity: SwordPlayerEntity, rightArmCFrame: CFrame) {
  const params = generateTracelineParameters(true, [ObjectsFolder], [], entity.environment.entity, ["HealthEntity"], [], false);
  const offsetCframe = entity.currentState !== SwordState.Lunge ? swordGripOffset : swordGripOffset.mul(swordLungeOffset.Inverse());
  const hitboxCFrame = rightArmCFrame.mul(offsetCframe);

  const partsList = workspace.GetPartBoundsInBox(hitboxCFrame, swordSize, params);
  const filteredList: BasePart[] = [];

  for (const part of partsList) {
    const associatedEntities = entity.environment.entity.getEntitiesFromInstance(part);
    if (associatedEntities.size() <= 0 || associatedEntities.includes(entity)) continue;

    filteredList.push(part);
  }

  const visualIndicator = new Instance("BoxHandleAdornment");
  visualIndicator.Adornee = workspace;
  visualIndicator.CFrame = hitboxCFrame;
  visualIndicator.Size = swordSize;
  visualIndicator.Transparency = 0.75;
  visualIndicator.Color3 = entity.currentState !== SwordState.Lunge ? new Color3(1, 1, 1) : new Color3(0, 1, 1);
  visualIndicator.Parent = workspace;

  if (filteredList.size() > 0)
    visualIndicator.Color3 = entity.currentState !== SwordState.Lunge ? new Color3(1, 0.75, 0) : new Color3(1, 0, 0);

  task.defer(() => {
    RunService.Heartbeat.Wait();
    visualIndicator.Destroy();
  });

  return filteredList;
}

// # Bindings & misc
GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (!env.isServer) return;

  // Listening for damage
  env.network.ListenPacket(`${NETWORK_ID}hit`, (sender, reader) => {
    if (!sender) return;

    const hitIndex = reader.u8();
    const attackerId = reader.string();
    const victimId = reader.string();

    const attackerEntity = env.entity.entities.get(attackerId);
    const victimEntity = env.entity.entities.get(victimId);
    if (!attackerEntity?.IsA("SwordPlayerEntity") || !victimEntity?.IsA("HealthEntity")) return;

    if (!CheckPlayers(attackerEntity, victimEntity)) return;

    let totalDealingDamage = attackerEntity.currentState;

    if (teamHealingEnabled && victimEntity.IsA("PlayerEntity"))
      if (victimEntity.team === attackerEntity.team)
        totalDealingDamage = -totalDealingDamage;

    if (hitIndex === NetworkSwordHitIndex.BotToOther) {
      // Check to see if the caller is the owner of the bot
      if (attackerEntity.GetUserFromNetworkOwner() !== sender) return;
    }

    if (hitIndex === NetworkSwordHitIndex.LocalToOther) {
      if (attackerEntity.GetUserFromController() !== sender) return;
    }

    if (hitIndex === NetworkSwordHitIndex.OtherToLocal) {
      if (!victimEntity?.IsA("SwordPlayerEntity") || victimEntity.GetUserFromController() !== sender) return;
    }

    victimEntity.takeDamage(totalDealingDamage, attackerEntity);
  });
});

// Client
GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (env.isServer) return;

  env.entity.entityCreated.Connect(ent => {
    if (!ent.IsA("SwordPlayerEntity")) return;

    while (!ent.humanoidModel) task.wait();

    const lastEntitiesHitTime = new Map<string, number>();

    const getGripPosition = () => ent.currentState === SwordState.Lunge ? swordLungeOffset : new CFrame();

    const swordModel = SWORD_MODEL.Clone();
    swordModel.Parent = workspace;
    swordModel.Name = "Part";

    const swordMotor = new Instance("Motor6D");
    swordMotor.Parent = swordModel;
    swordMotor.Part0 = ent.humanoidModel["Right Arm"];
    swordMotor.Part1 = swordModel;
    swordMotor.C0 = new CFrame(0, -1, -1.5).mul(CFrame.Angles(0, math.rad(180), math.rad(-90)));

    const soundAttachment = new Instance("Attachment");
    soundAttachment.Parent = swordModel;
    soundAttachment.Name = "SoundAttachment";

    const swingSound = new SoundSystem.WorldSoundInstance();
    swingSound.SetAssetPath(SoundsPath.Slash);
    swingSound.SetParent(soundAttachment);
    swingSound.clearOnFinish = false;

    const lungeSound = new SoundSystem.WorldSoundInstance();
    lungeSound.SetAssetPath(SoundsPath.Lunge);
    lungeSound.SetParent(soundAttachment);
    lungeSound.clearOnFinish = false;

    const touchedHandler = (other: BasePart) => {
      if (env.isPlayback) return;
      if (!ent.IsWeaponEquipped()) return;
      if (!DoesInstanceExist(ent.humanoidModel)) return;
      if (other.IsDescendantOf(WorldProvider.MapFolder)) return;
      if (other.IsDescendantOf(ent.humanoidModel)) return; // Hitting ourselves, ignore...

      const relatedEntities = env.entity.getEntitiesFromInstance(other);
      if (relatedEntities.size() <= 0) return;

      for (const entity of relatedEntities) {
        if (!entity.IsA("HealthEntity") || entity.id === ent.id) continue;

        const lastHitTime = lastEntitiesHitTime.get(entity.id) ?? 0;
        if (time() - lastHitTime < 0.06) continue;
        lastEntitiesHitTime.set(entity.id, time());

        ClientHandleHitboxTouched(ent, entity, other, env.network);
      }
    };

    ent.stateChanged.Connect(state => {
      if (state === SwordState.Idle) return;

      if (state === SwordState.Lunge)
        lungeSound.Play();
      else
        swingSound.Play();
    });

    const unbindLifecycleUpdate1 = env.lifecycle.BindLateUpdate(() => {
      if (!ent.humanoidModel || !DoesInstanceExist(ent.humanoidModel)) return;

      const isEquipped = ent.health > 0 && ent.IsWeaponEquipped();

      swordMotor.C1 = getGripPosition();
      swordModel.Transparency = isEquipped ? 0 : 1;

      // scan for hits
      const existingHits = trackingEntityHits.get(ent.id) ?? new Set();
      const partsInHitbox = GetPartsInSwordHitbox(ent, ent.humanoidModel["Right Arm"].CFrame);
      const newHits = new Set<BasePart>();

      for (const part of partsInHitbox) {
        if (existingHits.has(part)) continue;
        existingHits.add(part);
        newHits.add(part);
        RaposoConsole.Info(part.GetFullName());
      }

      for (const oldHits of existingHits) {
        if (partsInHitbox.includes(oldHits)) continue;
        existingHits.delete(oldHits);
      }

      if (!trackingEntityHits.has(ent.id))
        trackingEntityHits.set(ent.id, existingHits);

      for (const hit of newHits)
        touchedHandler(hit);
    });

    ent.OnDelete(() => {
      swordModel.Destroy();
      swordMotor.Destroy();

      unbindLifecycleUpdate1();
    });

    print("Finished setting up", ent.classname, ent.id);
  });
});