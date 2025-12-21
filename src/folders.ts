import * as Services from "@rbxts/services";
import { ReplicatedInstance } from "./util/utilfuncs";

export const cacheFolder = ReplicatedInstance( workspace, "Cache", "Folder" );

export const mapStorageFolder = ReplicatedInstance( Services.ReplicatedStorage, "Maps", "Folder" );
export const modulesFolder = ReplicatedInstance( Services.ReplicatedStorage, "Modules", "Folder" );
export const modelsFolder = ReplicatedInstance( Services.ReplicatedStorage, "Models", "Folder" );
export const soundsFolder = ReplicatedInstance( Services.ReplicatedStorage, "Sounds", "Folder" );
export const uiFolder = ReplicatedInstance( Services.ReplicatedStorage, "Interface", "Folder" );
export const animFolder = ReplicatedInstance( Services.ReplicatedStorage, "Animations", "Folder" );
export const vendorFolder = ReplicatedInstance( Services.ReplicatedStorage, "Vendor", "Folder" );