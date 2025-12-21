import PlayerEntity from "entities/PlayerEntity";
import { PlayerTeam } from "gamevalues";
import { gameValues } from "gamevalues";

export function defendersCommandCheck( callerEntity: PlayerEntity, targetEntity: PlayerEntity ) 
{
  const caller = callerEntity.GetUserFromController();
  if ( !caller ) return;

  if ( !caller.GetAttribute( gameValues.modattr ) ) return;
  if ( caller.GetAttribute( gameValues.adminattr ) ) return true;

  // Check if they themselves are in the defenders' team
  if ( callerEntity.team === PlayerTeam.Defenders ) return true;

  // If they are attempting to mess with someone on defenders
  if ( targetEntity.team === PlayerTeam.Defenders ) return false;

  return true;
}
