import { BufferReader } from "util/bufferreader";
import { BufferByteType } from "util/bufferwriter";
import { ErrorObject } from "util/utilfuncs";

declare global {
  interface GameEntities {
    BaseEntity: typeof BaseEntity;
  }

  type T_EntityState = Map<string, { value: unknown, valueType: BufferByteType }>; // "string" is the keyof class / variable
  type T_EntityStateHandler<T> = (ctx: T_EntityState, value: T) => void;
}

abstract class BaseEntity {
  readonly id = ErrorObject<string>("Entity id cannot be accessed during contruction.");
  readonly environment = ErrorObject<T_GameEnvironment>("Entity environment cannot be accessed during construction.");

  abstract readonly classname: keyof GameEntities;
  protected inheritanceList = new Set<keyof GameEntities>();
  readonly setupFinishedCallbacks = new Array<Callback>();
  readonly deletionCallbacks = new Array<Callback>();
  readonly associatedInstances = new Set<Instance>();
  readonly attributesList = new Map<string, unknown>();

  private networkableProperties = new Map<string, BufferByteType>();
  readonly networkablePropertiesHandlers = new Map<string, T_EntityStateHandler<unknown>>();

  constructor() {
    this.inheritanceList.add("BaseEntity");

    this.RegisterNetworkableProperty("id", BufferByteType.str);
  }

  protected RegisterNetworkableProperty<T extends keyof this>(variableName: T, byteType: BufferByteType) {
    this.networkableProperties.set(tostring(variableName), byteType);
  }

  protected RegisterNetworkablePropertyHandler<T extends keyof this>(variableName: T, handler: T_EntityStateHandler<this[T]>) {
    this.networkablePropertiesHandlers.set(tostring(variableName), handler as T_EntityStateHandler<unknown>);
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
