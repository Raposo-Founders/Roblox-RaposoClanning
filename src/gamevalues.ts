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

export enum PlayerTeam {
  Defenders,
  Raiders,
  Spectators
}

export enum Gamemode {
  Lanes,
  Payload,
  BombRush,
  Hardpoint,
  FreezeTag,
  Sacrifice,
  FreeForAll,
  BombDefusal,
  KingOfTheHill,
  TeamDeathmatch,
  CaptureTheFlag,
  FlagDomination,
}
