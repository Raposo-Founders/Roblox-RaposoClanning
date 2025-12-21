import { ReplicatedInstance } from "util/utilfuncs";

// # Constants & Variables


// # Functions

// # Namespace
namespace WorldProvider {
  export const MapFolder = ReplicatedInstance( workspace, "Map", "Folder" );
  export const ObjectsFolder = ReplicatedInstance( workspace, "Objects", "Folder" );

  export const MapContent = {
    Parts: ReplicatedInstance( MapFolder, "Parts", "Folder" ),
    Modules: ReplicatedInstance( MapFolder, "Modules", "Folder" ),
  };
}

export = WorldProvider;