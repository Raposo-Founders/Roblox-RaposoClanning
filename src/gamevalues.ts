import { ReplicatedStorage } from "@rbxts/services";
import { RaposoConsole } from "logging";

const stringValues = new ReadonlyMap<string, string>([
  ["USER_CMD_MISSING_ADMIN", "You must have admin privileges to run this command."],
  ["USER_CMD_MISSING_MOD", "You must have moderation privileges to run this command."],
]);

export const gameValues = {
  objtag: "GameObject",
  usersessionid: "_sessionId",

  adminattr: "HasAdminPower",
  modattr: "MasModerationPower",

  cmdnetinfo: "DBG-SVCMD-OUT",
  cmdprefix: ":",
  cmdtempmoddefendersdeny: "Temporary moderators can't mess with the Defenders' team.",
} as const;

export function getStringMappedValue(name: string) {
  return stringValues.get(name.upper()) || `#${name.upper()}`;
}

const alertedAttributeValues = new Set<string>();
export function getInstanceDefinedValue<T extends AttributeValue>(name: string, defaultValue: T): T {
  const targetInstance = ReplicatedStorage.FindFirstChild("Configuration");
  if (!targetInstance) {
    if (!alertedAttributeValues.has("MISSING_CONFIG_REPL")) {
      RaposoConsole.Warn("Warning: Current place is missing a Configuration instance on ReplicatedStorage.");
      alertedAttributeValues.add("MISSING_CONFIG_REPL");
    }

    return defaultValue;
  }

  const targetValue = targetInstance.GetAttribute(name);
  if (targetValue === undefined) {
    if (!alertedAttributeValues.has(name)) {
      RaposoConsole.Warn("Attempted to fetch unknown Configuration attribute:", name, ".\n Returning default value...");
      alertedAttributeValues.add(name);
    }

    return defaultValue;
  }

  if (typeOf(targetValue) !== typeOf(defaultValue)) {
    RaposoConsole.Warn(`Invalid type from attribute: ${name}. Expected "${typeOf(defaultValue)}", got "${typeOf(targetValue)}".`);
    return defaultValue;
  }

  return targetValue as T;
}

export enum PlayerTeam {
  Defenders,
  Raiders,
  Spectators
}
