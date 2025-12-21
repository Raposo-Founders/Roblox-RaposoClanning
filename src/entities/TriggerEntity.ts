import { RunService } from "@rbxts/services";
import { registerEntityClass } from "entities";
import { RaposoConsole } from "logging";
import Signal from "util/signal";
import WorldEntity from "./WorldEntity";

declare global {
  interface GameEntities {
    TriggerEntity: typeof TriggerEntity;
  }
}

class TriggerEntity extends WorldEntity {
  classname: keyof GameEntities = "TriggerEntity";

  trackingEntities = new Set<EntityId>();

  readonly OnStartTouch = new Signal<[WorldEntity]>();
  readonly OnEndTouch = new Signal<[WorldEntity]>();

  constructor() {
    super();
  }

  Destroy(): void {
    this.trackingEntities.clear();
  }

  GetEntitiesInZone() {
    const list: WorldEntity[] = [];

    for (const entityId of this.trackingEntities) {
      const entity = this.environment.entity.entities[entityId];
      if (!entity || !entity.IsA("WorldEntity")) continue;
      if (entity.IsA("HealthEntity") && entity.health <= 0) continue;

      list.push(entity);
    }

    return list;
  }

  IsVolumeColliding(origin: Vector3, size: Vector3) {
    let xColliding = false;
    let yColliding = false;
    let zColliding = false;

    {
      const lowerSide = origin.X - (size.X * 0.5);
      const upperSide = origin.X + (size.X * 0.5);

      const selfLowerSide = this.position.X - (this.size.X * 0.5);
      const selfUpperSide = this.position.X + (this.size.X * 0.5);

      xColliding = (lowerSide >= selfLowerSide && lowerSide <= selfUpperSide) || (upperSide >= selfLowerSide && upperSide <= selfUpperSide);
    }
    {
      const lowerSide = origin.Y - (size.Y * 0.5);
      const upperSide = origin.Y + (size.Y * 0.5);

      const selfLowerSide = this.position.Y - (this.size.Y * 0.5);
      const selfUpperSide = this.position.Y + (this.size.Y * 0.5);

      yColliding = (lowerSide >= selfLowerSide && lowerSide <= selfUpperSide) || (upperSide >= selfLowerSide && upperSide <= selfUpperSide);
    }
    {
      const lowerSide = origin.Z - (size.Z * 0.5);
      const upperSide = origin.Z + (size.Z * 0.5);

      const selfLowerSide = this.position.Z - (this.size.Z * 0.5);
      const selfUpperSide = this.position.Z + (this.size.Z * 0.5);

      zColliding = (lowerSide >= selfLowerSide && lowerSide <= selfUpperSide) || (upperSide >= selfLowerSide && upperSide <= selfUpperSide);
    }

    return xColliding && yColliding && zColliding;
  }

  Think(dt: number): void {
    // Check to see any of the tracked entities have left the area
    for (const entityId of this.trackingEntities) {
      const entity = this.environment.entity.entities[entityId];
      if (!entity || !entity.IsA("WorldEntity")) {
        this.trackingEntities.delete(entityId); // ^ Might give some bugs later
        continue;
      }

      if (!this.IsVolumeColliding(entity.position, entity.size) || (entity.IsA("HealthEntity") && entity.health <= 0)) {
        this.OnEndTouch.Fire(entity);
        this.trackingEntities.delete(entityId);
      }
    }

    // Check for any new entity inside of the zone
    for (const entity of this.environment.entity.getEntitiesThatIsA("WorldEntity")) {
      if (this.trackingEntities.has(entity.id)) continue;
      if (!this.IsVolumeColliding(entity.position, entity.size)) continue;
      if (entity.IsA("HealthEntity") && entity.health <= 0) continue;

      this.trackingEntities.add(entity.id);
      this.OnStartTouch.Fire(entity);
    }
  }
}

registerEntityClass("TriggerEntity", TriggerEntity);
