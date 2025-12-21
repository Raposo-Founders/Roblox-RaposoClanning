import { GroupService, MarketplaceService } from "@rbxts/services";

// # Constants & variables
let gameName: string | undefined;

const cachedPlayerGroups = new Map<number, Set<number>>();
const cachedGroups = new Map<number, GroupInfo>();

let creatorGroupId: number | undefined;
const creatorAlliedgroups = new Set<number>();

// # Functions
export function GetGroupInfo( groupId: number ) 
{
  const existingCache = cachedGroups.get( groupId );
  if ( existingCache ) return existingCache;

  const groupInfo = GroupService.GetGroupInfoAsync( groupId );
  cachedGroups.set( groupId, groupInfo );

  return groupInfo;
}

export function GetCreatorGroupInfo() 
{
  if ( creatorGroupId )
    return {
      groupInfo: GetGroupInfo( creatorGroupId ),
      alliedGroups: creatorAlliedgroups,
    };

  if ( game.CreatorType !== Enum.CreatorType.Group )
    return;

  const allies = GroupService.GetAlliesAsync( game.CreatorId );
  if ( allies.GetCurrentPage().size() > 0 )
    while ( game ) 
    {
      for ( const alliedGroup of allies.GetCurrentPage() ) 
      {
        cachedGroups.set( alliedGroup.Id, alliedGroup );
        creatorAlliedgroups.add( alliedGroup.Id );
      }

      if ( allies.IsFinished )
        break;

      allies.AdvanceToNextPageAsync();
      task.wait( 1 );
    }

  creatorGroupId = GroupService.GetGroupInfoAsync( game.CreatorId ).Id;

  return {
    groupInfo: GetGroupInfo( creatorGroupId ),
    alliedGroups: creatorAlliedgroups,
  };
}

export function GetGameName() 
{
  if ( gameName )
    return gameName;

  const info = MarketplaceService.GetProductInfo( game.PlaceId );
  gameName = info.Name;

  return gameName;
}

export function IsPlayerInGroup( player: Player, groupId: number ) 
{
  const existingSet = cachedPlayerGroups.get( player.UserId ) || new Set();

  if ( !cachedPlayerGroups.has( player.UserId ) )
    cachedPlayerGroups.set( player.UserId, existingSet );

  if ( !existingSet.has( groupId ) && player.IsInGroup( groupId ) )
    existingSet.add( groupId );

  task.spawn( () => GetGroupInfo( groupId ) ); // Cache the group while we're at it :P

  return existingSet.has( groupId );
}
