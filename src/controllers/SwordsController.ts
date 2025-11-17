import ColorUtils from "@rbxts/colour-utils";
import { Debris, Players, RunService, TweenService } from "@rbxts/services";
import { defaultEnvironments } from "defaultinsts";
import BaseEntity from "entities/BaseEntity";
import HealthEntity from "entities/HealthEntity";
import { getPlayerEntityFromController, PlayerTeam } from "entities/PlayerEntity";
import { SwordPlayerEntity, SwordState } from "entities/SwordPlayerEntity";
import { modelsFolder } from "folders";
import { gameValues, getInstanceDefinedValue } from "gamevalues";
import { NetworkManager } from "network";
import { createPlayermodelForEntity } from "providers/PlayermodelProvider";
import SessionInstance from "providers/SessionProvider";
import WorldProvider, { ObjectsFolder } from "providers/WorldProvider";
import { SoundsPath, SoundSystem } from "systems/SoundSystem";
import { colorTable } from "UI/values";
import { BufferReader } from "util/bufferreader";
import { startBufferCreation, writeBufferString, writeBufferU8 } from "util/bufferwriter";
import { DoesInstanceExist } from "util/utilfuncs";

// # Constants & variables
const NETWORK_ID = "swordcon_";
const SWORD_MODEL = modelsFolder.WaitForChild("Sword") as BasePart;

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

function ClientWriteNetworkHit(network: NetworkManager, mode: NetworkSwordHitIndex, attacker: EntityId, victim: EntityId) {
  startBufferCreation();
  writeBufferU8(mode);
  writeBufferString(attacker);
  writeBufferString(victim);
  network.sendPacket(`${NETWORK_ID}hit`);
}

function ClientHandleHitboxTouched(attacker: SwordPlayerEntity, target: HealthEntity, part: BasePart, network: NetworkManager) {
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

// # Bindings & misc
SessionInstance.sessionCreated.Connect(server => {
  // Listening for damage
  server.network.listenPacket(`${NETWORK_ID}hit`, (packet) => {
    if (!packet.sender) return;

    const reader = BufferReader(packet.content);
    const hitIndex = reader.u8();
    const attackerId = reader.string();
    const victimId = reader.string();

    const attackerEntity = server.entity.entities.get(attackerId);
    const victimEntity = server.entity.entities.get(victimId);
    if (!attackerEntity?.IsA("SwordPlayerEntity") || !victimEntity?.IsA("HealthEntity")) return;

    if (!CheckPlayers(attackerEntity, victimEntity)) return;

    let totalDealingDamage = attackerEntity.currentState;

    if (teamHealingEnabled && victimEntity.IsA("PlayerEntity"))
      if (victimEntity.team === attackerEntity.team)
        totalDealingDamage = -totalDealingDamage;

    if (hitIndex === NetworkSwordHitIndex.BotToOther) {
      // Check to see if the caller is the owner of the bot
      if (attackerEntity.GetUserFromNetworkOwner() !== packet.sender) return;
    }

    if (hitIndex === NetworkSwordHitIndex.LocalToOther) {
      if (attackerEntity.GetUserFromController() !== packet.sender) return;
    }

    if (hitIndex === NetworkSwordHitIndex.OtherToLocal) {
      if (!victimEntity?.IsA("SwordPlayerEntity") || victimEntity.GetUserFromController() !== packet.sender) return;
    }

    victimEntity.takeDamage(totalDealingDamage, attackerEntity);
  });
});

if (RunService.IsClient())
  defaultEnvironments.entity.entityCreated.Connect(ent => {
    if (!ent.IsA("SwordPlayerEntity")) return;

    const lastEntitiesHitTime = new Map<string, number>();

    const playermodel = createPlayermodelForEntity(ent);

    const getGripPosition = () => {
      let gripPosition = new CFrame();

      if (ent.currentState === SwordState.Lunge)
        gripPosition = new CFrame(-1.5, 0, -1.5).mul(CFrame.Angles(0, -math.rad(90), 0));

      return gripPosition;
    };

    const swordModel = SWORD_MODEL.Clone();
    swordModel.Parent = workspace;
    swordModel.Name = "Part";

    const swordMotor = new Instance("Motor6D");
    swordMotor.Parent = swordModel;
    swordMotor.Part0 = playermodel.rig["Right Arm"];
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

    const touchedConnection = swordModel.Touched.Connect(other => {
      if (defaultEnvironments.entity.isPlayback) return;
      if (!ent.IsWeaponEquipped()) return;
      if (!DoesInstanceExist(playermodel.rig)) return;
      if (other.IsDescendantOf(WorldProvider.MapFolder)) return;
      if (other.IsDescendantOf(playermodel.rig)) return; // Hitting ourselves, ignore...

      const relatedEntities = defaultEnvironments.entity.getEntitiesFromInstance(other);
      if (relatedEntities.size() <= 0) return;

      for (const entity of relatedEntities) {
        if (!entity.IsA("HealthEntity") || entity.id === ent.id) continue;

        const lastHitTime = lastEntitiesHitTime.get(entity.id) ?? 0;
        if (time() - lastHitTime < 0.06) continue;
        lastEntitiesHitTime.set(entity.id, time());

        ClientHandleHitboxTouched(ent, entity, other, defaultEnvironments.network);
      }
    });

    ent.stateChanged.Connect(state => {
      if (state === SwordState.Idle) return;

      if (state === SwordState.Lunge)
        lungeSound.Play();
      else
        swingSound.Play();
    });

    const unbindLifecycleUpdate1 = defaultEnvironments.lifecycle.BindTickrate(() => {
      const isEquipped = ent.health > 0 && ent.IsWeaponEquipped();

      swordMotor.C1 = getGripPosition();
      swordModel.Transparency = isEquipped ? 0 : 1;
    });

    ent.OnDelete(() => {
      swordModel.Destroy();
      swordMotor.Destroy();
      touchedConnection.Disconnect();

      unbindLifecycleUpdate1();
    });

    print("Finished setting up", ent.classname, ent.id);
  });