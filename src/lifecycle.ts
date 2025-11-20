import { RunService } from "@rbxts/services";
import { RandomString } from "./util/utilfuncs";

// # Types
interface I_ThreadYieldInfo {
  ticks: number;
  target: number;
  thread: thread;
}

type T_UpdateCallbackInfo = (ctx: LifecycleInstance, deltaTime: number) => void;

// # Constants & variables
export const TICKRATE = 1 / 20;

// # Functions
export function earlyUpdateLifecycleInstances(dt: number) {
  for (const [, instance] of LifecycleInstance.instances) {
    instance.FireUpdate(dt);
    instance.FireTickUpdate(dt);
  }
}
export function lateUpdateLifecycleInstances(dt: number) {
  for (const [, instance] of LifecycleInstance.instances) {
    instance.FireLateUpdate(dt);
  }
}

// # Classes
export class LifecycleInstance {
  static instances = new Map<string, LifecycleInstance>();

  private readonly _id = RandomString(20);
  running = false;
  tickrate = TICKRATE;
  private _passedTickrateTime = 0;

  private readonly _boundUpdateCallbacks = new Map<string, T_UpdateCallbackInfo>();
  private readonly _boundLateUpdateCallbacks = new Map<string, T_UpdateCallbackInfo>();
  private readonly _boundTickCallbacks = new Map<string, T_UpdateCallbackInfo>();

  private readonly _connections = new Array<RBXScriptConnection>();
  private readonly _yieldingThreads = new Map<string, I_ThreadYieldInfo>();

  constructor() {
    LifecycleInstance.instances.set(this._id, this);
  }

  FireUpdate(deltaTime: number) {
    if (!this.running) return;

    for (const [, callback] of this._boundUpdateCallbacks)
      task.spawn(callback, this, deltaTime);
  }

  FireLateUpdate(deltaTime: number) {
    if (!this.running) return;

    for (const [, callback] of this._boundLateUpdateCallbacks)
      task.spawn(callback, this, deltaTime);
  }

  FireTickUpdate(deltaTime: number) {
    if (!this.running) return;

    this._passedTickrateTime += deltaTime;
    if (this._passedTickrateTime < this.tickrate) return;

    const updateTimes = math.floor(this._passedTickrateTime / this.tickrate);

    for (let i = 0; i < updateTimes; i++) {
      for (const [, callback] of this._boundTickCallbacks)
        task.spawn(callback, this, deltaTime);

      for (const [, info] of this._yieldingThreads) {
        info.ticks++;

        if (info.ticks >= info.target)
          coroutine.resume(info.thread);
      }
    }

    this._passedTickrateTime -= this.tickrate * updateTimes;
  }

  YieldForTicks(ticks: number) {
    const id = RandomString(5);

    const info: I_ThreadYieldInfo = {
      ticks: 0,
      target: ticks,
      thread: coroutine.running(),
    };

    this._yieldingThreads.set(id, info);
    coroutine.yield(info.thread);

    this._yieldingThreads.delete(id);
  }

  BindUpdate(callback: T_UpdateCallbackInfo) {
    const callbackId = RandomString(10);

    this._boundUpdateCallbacks.set(callbackId, callback);
    return () => this._boundUpdateCallbacks.delete(callbackId);
  }
  BindLateUpdate(callback: T_UpdateCallbackInfo) {
    const callbackId = RandomString(10);

    this._boundLateUpdateCallbacks.set(callbackId, callback);
    return () => this._boundLateUpdateCallbacks.delete(callbackId);
  }
  BindTickrate(callback: T_UpdateCallbackInfo) {
    const callbackId = RandomString(10);

    this._boundTickCallbacks.set(callbackId, callback);
    return () => this._boundTickCallbacks.delete(callbackId);
  }

  Destroy() {
    LifecycleInstance.instances.delete(this._id);

    this.running = false;

    this._boundUpdateCallbacks.clear();
    this._boundLateUpdateCallbacks.clear();
    this._boundTickCallbacks.clear();

    for (const [, info] of this._yieldingThreads)
      task.cancel(info.thread);
    this._yieldingThreads.clear();

    for (const connection of this._connections)
      connection.Disconnect();
    this._connections.clear();

    if (RunService.IsClient()) {
      RunService.UnbindFromRenderStep(`${this._id}_lifecycle_update`);
      RunService.UnbindFromRenderStep(`${this._id}_lifecycle_lateupdate`);
      RunService.UnbindFromRenderStep(`${this._id}_lifecycle_tickupdate`);
    }

    task.defer(() => {
      task.wait(1);
      table.clear(this);
    });
  }
}

// Bindings & misc
