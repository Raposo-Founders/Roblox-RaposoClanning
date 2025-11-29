import { BufferReader } from "util/bufferreader";
import { BufferByteType } from "util/bufferwriter";
import { ErrorObject } from "util/utilfuncs";

declare global {
  interface GameEntities {
    BaseEntity: typeof BaseEntity;
  }
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

  constructor() {
    this.inheritanceList.add("BaseEntity");
  }

  protected RegisterNetworkableProperty<T extends keyof this>(variableName: T, byteType: BufferByteType) {
    this.networkableProperties.set(tostring(variableName), byteType);
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

  GetNetworkSnapshot() {
    const valuesContent = new Map<string, { value: unknown, valueType: BufferByteType }>();

    for (const [name, btype] of this.networkableProperties) {
      const value = this[name as keyof this];
      if (value === undefined) continue;

      valuesContent.set(name, { value, valueType: btype });
    }

    return valuesContent;
  }

  abstract Destroy(): void;

  abstract WriteStateBuffer(): void;
  abstract ApplyStateBuffer(reader: ReturnType<typeof BufferReader>): void;

  abstract Think(dt: number): void;
}

export = BaseEntity;
