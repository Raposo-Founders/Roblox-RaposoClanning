import { BufferByteType } from "util/bufferwriter";
import Signal from "util/signal";
import WorldEntity from "./WorldEntity";

declare global {
  interface GameEntities {
    HealthEntity: typeof HealthEntity;
  }
}

interface AttackerInfo {
  entityId: string;
  time: number;
}

abstract class HealthEntity extends WorldEntity {
  abstract health: number;
  abstract maxHealth: number;

  canDealDamage = true;

  readonly tookDamage = new Signal<[old: number, new: number, attacker?: WorldEntity]>();
  readonly spawned = new Signal();
  readonly died = new Signal<[attacker?: WorldEntity]>();
  readonly attackersList: AttackerInfo[] = [];

  constructor() {
    super();

    this.inheritanceList.add("HealthEntity");

    this.RegisterNetworkableProperty("health", BufferByteType.u16);
    this.RegisterNetworkableProperty("maxHealth", BufferByteType.u16);

    this.RegisterNetworkablePropertyHandler("health", (ctx, val) => {
      const originalHealth = this.health;

      this.health = val;

      if (val !== originalHealth)
        this.tookDamage.Fire(originalHealth, val);

      if (originalHealth > 0 && val <= 0)
        this.died.Fire();

      if (val > 0 && originalHealth <= 0)
        this.spawned.Fire();
    });
  }

  takeDamage(amount: number, attacker?: WorldEntity) {
    if (!this.canDealDamage) return;

    const previousHealthAmount = this.health;

    this.health -= amount;
    this.health = math.clamp(this.health, 0, this.maxHealth);

    if (attacker)
      this.attackersList.push({ entityId: attacker.id, time: time() });
    this.attackersList.sort((a, b) => a.time > b.time);

    this.tookDamage.Fire(previousHealthAmount, this.health, attacker);

    if (previousHealthAmount > 0 && this.health <= 0)
      this.died.Fire(attacker);
  }
}

export = HealthEntity;
