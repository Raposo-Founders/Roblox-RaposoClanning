import { t } from "@rbxts/t";
import { RaposoConsole } from "logging";
import { BufferByteType } from "util/bufferwriter";
import { ErrorObject } from "util/utilfuncs";

declare global {
  interface GameEntities {
    BaseEntity: typeof BaseEntity;
  }

  type T_EntityState = Map<string, { value: unknown, valueType: BufferByteType }>; // "string" is the keyof class / variable
  type T_EntityStateHandler<T> = (ctx: T_EntityState, value: T) => void;
}

type T_EntityInputListing = { typechecks: readonly t.check<unknown>[], callback: Callback };

abstract class BaseEntity {
  readonly id = ErrorObject<number>("Entity id cannot be accessed during contruction.");
  readonly name = "";
  readonly environment = ErrorObject<T_GameEnvironment>("Entity environment cannot be accessed during construction.");

  abstract readonly classname: keyof GameEntities;
  protected inheritanceList = new Set<keyof GameEntities>();
  readonly setupFinishedCallbacks = new Array<Callback>();
  readonly deletionCallbacks = new Array<Callback>();
  readonly associatedInstances = new Set<Instance>();
  readonly attributesList = new Map<string, unknown>();
  protected inputList = new Map<string, T_EntityInputListing>();

  private networkableProperties = new Map<string, BufferByteType>();
  readonly networkablePropertiesHandlers = new Map<string, T_EntityStateHandler<unknown>>();

  constructor() {
    this.inheritanceList.add("BaseEntity");

    this.RegisterNetworkableProperty("id", BufferByteType.u16);
    this.RegisterNetworkableProperty("name", BufferByteType.str);

    this.OnDelete(() => {
      this.inputList.clear();
      this.networkableProperties.clear();
      this.networkablePropertiesHandlers.clear();
    });
  }

  protected RegisterNetworkableProperty<T extends keyof this>(variableName: T, byteType: BufferByteType) {
    this.networkableProperties.set(tostring(variableName), byteType);
  }

  protected RegisterNetworkablePropertyHandler<T extends keyof this>(variableName: T, handler: T_EntityStateHandler<this[T]>) {
    this.networkablePropertiesHandlers.set(tostring(variableName), handler as T_EntityStateHandler<unknown>);
  }

  protected RegisterInput<const T extends readonly t.check<unknown>[], A extends { [K in keyof T]: T[K] extends t.check<infer E> ? E : never }>(name: string, typechecks: T, callback: (...args: A) => void) {
    this.inputList.set(name, { typechecks, callback });
  }

  SetName(name: string) {
    if (name === this.name) return;
    if (this.environment.entity.namedEntities.has(name)) {
      RaposoConsole.Error(`Entity named ${name} already exists.`);
      return;
    }

    if (this.name !== "")
      this.environment.entity.namedEntities.delete(this.name);

    rawset(this, "name", name);
    this.environment.entity.namedEntities.set(name, this);
    RaposoConsole.Info(`Entity (${this.id}) name has been changed to ${name}`);
  }

  FireInput(name: string, args: unknown[]) {
    const callback = this.inputList.get(name);
    if (!callback) {
      RaposoConsole.Warn(`Attempted to fire unknown entity Input "${name}" with arguments:`, (args as defined[]).join(" "));
      return;
    }

    if (args.size() !== callback.typechecks.size()) {
      RaposoConsole.Warn(`Attempted to fire unknown entity Input "${name}" without matching the arguments required`);
      return;
    }

    for (let i = 0; i < callback.typechecks.size(); i++) {
      const typecheck = callback.typechecks[i];
      const value = args[i];

      if (!typecheck(value)) {
        RaposoConsole.Warn(`Firing entity Input "${name}" failed.`, `Argument #${i} did not match the required type.`);
        return;
      }
    }

    task.spawn(callback.callback, ...args);
  }

  IsA<C extends keyof GameEntities>(classname: C): this is EntityType<C> {
    return this.inheritanceList.has(classname) || this.classname === classname;
  }

  OnDelete(callback: Callback) {
    this.deletionCallbacks.push(callback);
  }

  OnSetupFinished(callback: Callback) {
    this.setupFinishedCallbacks.push(callback);
  }

  AssociateInstance(inst: Instance) {
    this.associatedInstances.add(inst);
  }
  UnassociateInstance(inst: Instance) {
    this.associatedInstances.delete(inst);
  }

  SetAttribute(name: string, value: unknown) {
    if (value === undefined) {
      this.attributesList.delete(name);
      return;
    }

    this.attributesList.set(name, value);
  }

  GetAttribute(name: string) {
    return this.attributesList.get(name);
  }

  GetStateSnapshot() {
    const valuesContent: T_EntityState = new Map();

    for (const [name, btype] of this.networkableProperties) {
      const value = this[name as keyof this];
      if (value === undefined) continue;

      valuesContent.set(name, { value, valueType: btype });
    }

    return valuesContent;
  }

  abstract Destroy(): void;

  abstract Think(dt: number): void;
}

export = BaseEntity;
