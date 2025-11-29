import { BufferReader } from "util/bufferreader";
import BaseEntity from "./BaseEntity";
import { BufferByteType, writeBufferVector } from "util/bufferwriter";

declare global {
  interface GameEntities {
    WorldEntity: typeof WorldEntity;
  }
}

abstract class WorldEntity extends BaseEntity {
  abstract origin: CFrame;
  abstract size: Vector3;
  abstract velocity: Vector3;

  constructor() {
    super();

    this.inheritanceList.add("WorldEntity");

    this.RegisterNetworkableProperty("origin", BufferByteType.vec);
    this.RegisterNetworkableProperty("velocity", BufferByteType.vec);
  }

  WriteStateBuffer(): void {
    const [y, x, z] = this.origin.ToOrientation();

    writeBufferVector(this.origin.X, this.origin.Y, this.origin.Z);
    writeBufferVector(math.deg(x), math.deg(y), math.deg(z));
    writeBufferVector(this.size.X, this.size.Y, this.size.Z);
    writeBufferVector(this.velocity.X, this.velocity.Y, this.velocity.Z);
  }

  ApplyStateBuffer(reader: ReturnType<typeof BufferReader>): void {
    const vecpos = reader.vec();
    const vecrot = reader.vec();
    const vecsiz = reader.vec();
    const vecvel = reader.vec();

    const newPosition = new CFrame(vecpos.x, vecpos.y, vecpos.z);
    const newRotation = CFrame.Angles(math.rad(vecrot.y), math.rad(vecrot.x), math.rad(vecrot.z));

    this.origin = newPosition.mul(newRotation);
    this.velocity = new Vector3(vecvel.x, vecvel.y, vecvel.z);
    this.size = new Vector3(vecsiz.x, vecsiz.y, vecsiz.z);
  }
}

export = WorldEntity;
