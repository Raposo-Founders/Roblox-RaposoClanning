import ColorUtils from "@rbxts/colour-utils";
import { TweenService } from "@rbxts/services";
import GameEnvironment from "core/GameEnvironment";
import BaseEntity from "entities/BaseEntity";
import { GunPlayerEntity } from "entities/GunPlayerEntity";
import HealthEntity from "entities/HealthEntity";
import { getPlayerEntityFromController, PlayerTeam } from "entities/PlayerEntity";
import { gameValues, getInstanceDefinedValue } from "gamevalues";
import { NetworkManager } from "network";
import { ObjectsFolder } from "providers/WorldProvider";
import { BufferReader } from "util/bufferreader";

// # Constants & variables
const NETWORK_ID = "tpscon_";

const forcetieEnabled = getInstanceDefinedValue("ForcetieEnabled", false);
const teamHealingEnabled = getInstanceDefinedValue("TeamHealingEnabled", false);

// # Functions
function CheckPlayers<T extends BaseEntity>(entity1: GunPlayerEntity, entity2: T) {
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

function ClientHandleHit(attacker: GunPlayerEntity, target: HealthEntity, part: BasePart, network: NetworkManager) {
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
}

// # Bindings & misc
GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  // Listening for damage
  if (env.isServer)
    env.network.listenPacket(`${NETWORK_ID}hit`, (packet) => {
      if (!packet.sender) return;
  
      const reader = BufferReader(packet.content);
      const hitIndex = reader.u8();
      const entityId = reader.string();
  
      const entity = getPlayerEntityFromController(env.entity, tostring(packet.sender.GetAttribute(gameValues.usersessionid)));
      if (!entity || !entity.IsA("GunPlayerEntity")) return;
  
      const targetEntity = env.entity.entities.get(entityId);
      if (!targetEntity?.IsA("HealthEntity")) return;
  
      if (!CheckPlayers(entity, targetEntity)) return;
    });

  if (!env.isServer)
    env.entity.entityCreated.Connect(ent => {
      if (!ent.IsA("GunPlayerEntity")) return;

      let playermodel = ent.humanoidModel;
      while (!playermodel) {
        task.wait();

        if (!env.entity.isEntityOnMemoryOrImSchizo(ent)) break;
        playermodel = ent.humanoidModel;
      }
      if (!playermodel) return;

      const unbindLifecycleUpdate1 = env.lifecycle.BindTickrate(() => {

      });

      ent.OnDelete(() => {
        unbindLifecycleUpdate1();
      });

      print("Finished setting up", ent.classname, ent.id);
    });
});