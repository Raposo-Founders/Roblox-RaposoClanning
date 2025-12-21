import { PlayerTeam } from "gamevalues";
import { BufferReader } from "util/bufferreader";
import { BufferByteType, writeBufferBool, writeBufferF32, writeBufferString, writeBufferU8 } from "util/bufferwriter";
import { registerEntityClass } from ".";
import PlayerEntity from "./PlayerEntity";
import WorldEntity from "./WorldEntity";
import BaseEntity from "./BaseEntity";

declare global {
  interface GameEntities {
    CapturePointEntity: typeof CapturePointEntity;
  }
}

// # Constants & variables

// # Functions
function IsPointInZone(point: Vector3, cf: CFrame, size: Vector3) {
  {
    const extremeLeft = cf.Position.X - size.X * 0.5;
    const extremeRight = cf.Position.X + size.X * 0.5;
    if (point.X < extremeLeft || point.X > extremeRight) return false;
  }
  {
    const extremeTop = cf.Position.Y - size.Y * 0.5;
    const extremeBottom = cf.Position.Y + size.Y * 0.5;
    if (point.Y < extremeTop || point.Y > extremeBottom) return false;
  }
  {
    const extremeFront = cf.Position.Z - size.Z * 0.5;
    const extremeBack = cf.Position.Z + size.Z * 0.5;
    if (point.Z < extremeFront || point.Z > extremeBack) return false;
  }

  return true;
}

// # Class
export default class CapturePointEntity extends WorldEntity {
  readonly classname: keyof GameEntities = "CapturePointEntity";

  current_team = PlayerTeam.Spectators;
  capture_progress = 0; // (float) -1(raiders) to 1(defenders).
  capture_speed = 2.5;
  is_instant_cap = false;

  linkedTrigger: BaseEntity["name"] = "";

  constructor() {
    super();
    this.inheritanceList.add("CapturePointEntity");

    this.RegisterNetworkableProperty("capture_progress", BufferByteType.f32);
    this.RegisterNetworkableProperty("capture_speed", BufferByteType.f32);
    this.RegisterNetworkableProperty("current_team", BufferByteType.u8);
    this.RegisterNetworkableProperty("is_instant_cap", BufferByteType.bool);
  }

  Think(dt: number): void {
    this.UpdateCaptureProgress(dt);
  }

  UpdateCaptureProgress(dt: number) {
    let total_capture_multiplier = 0;

    const triggerEntity = this.environment.entity.namedEntities.get(this.linkedTrigger);
    if (triggerEntity?.IsA("TriggerEntity"))
      for (const ent of triggerEntity.GetEntitiesInZone()) {
        if (!ent.IsA("PlayerEntity")) continue;
        total_capture_multiplier += ent.team === PlayerTeam.Defenders ? 1 : -1;
      }

    this.capture_progress = math.clamp(this.capture_progress + ((this.capture_speed * total_capture_multiplier) * dt), -1, 1);

    if (this.is_instant_cap)
      this.capture_progress = math.sign(total_capture_multiplier);

    if (this.capture_progress > 0)
      this.current_team = PlayerTeam.Defenders;

    if (this.capture_progress < 0)
      this.current_team = PlayerTeam.Raiders;
  }

  GetPlayersOnHitbox() {
    const playersList: PlayerEntity[] = [];

    for (const ent of this.environment.entity.getEntitiesThatIsA("PlayerEntity")) {
      if (ent.health <= 0 || ent.team === PlayerTeam.Spectators) continue;
      if (!IsPointInZone(ent.position, this.ConvertOriginToCFrame(), this.size)) continue;

      playersList.push(ent);
    }

    return playersList;
  }

  Destroy(): void { }
}

// # Misc
registerEntityClass("CapturePointEntity", CapturePointEntity);
