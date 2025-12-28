import { t } from "@rbxts/t";
import BaseEntity from "entities/BaseEntity";

/* -------------------------------------------------------------------------- */
/*                                  Functions                                 */
/* -------------------------------------------------------------------------- */
function IsInstanceDescendantOf( target: Instance, instancesList: Instance[] ) 
{
  if ( instancesList.includes( target ) ) return true;

  for ( const inst of instancesList ) 
  {
    if ( !target.IsDescendantOf( inst ) ) continue;
    return true;
  }
}

function IsEntityListed( target: BaseEntity, list: ( keyof GameEntities )[] ) 
{
  for ( const classname of list ) 
  {
    if ( !target.IsA( classname ) ) continue;
    return true;
  }
}

export function generateTracelineParameters<B extends boolean, T extends B extends true ? OverlapParams : RaycastParams>(
  isOverlap: B,
  searchInstances: Instance[],
  ignoreInstances: Instance[],
  entitiesEnvironment: T_EntityEnvironment,
  searchEntities: ( keyof GameEntities )[] = [],
  ignoreEntities: ( keyof GameEntities )[] = [],
  respectCanCollide = false,
): T 
{
  const finalSearchArray: Instance[] = [];

  // Filter instances
  for ( const inst of searchInstances ) 
  {
    if ( IsInstanceDescendantOf( inst, ignoreInstances ) ) continue;
    finalSearchArray.push( inst );

    for ( const child of inst.GetDescendants() ) 
    {
      if ( IsInstanceDescendantOf( child, ignoreInstances ) ) continue;
      finalSearchArray.push( child );
    }
  }

  // Filter entities
  if ( searchEntities.size() > 0 || ignoreEntities.size() > 0 )
    for ( const [, entity] of entitiesEnvironment.entities ) 
    {
      if ( searchEntities.size() > 0 && !IsEntityListed( entity, searchEntities ) ) continue;
      if ( ignoreEntities.size() > 0 && IsEntityListed( entity, ignoreEntities ) ) continue;

      for ( const inst of entity.associatedInstances ) 
      {
        finalSearchArray.push( inst );

        for ( const child of inst.GetDescendants() )
          finalSearchArray.push( child );
      }
    }

  const parameters = isOverlap ? new OverlapParams() : new RaycastParams();
  parameters.FilterType = Enum.RaycastFilterType.Include;
  parameters.RespectCanCollide = respectCanCollide;
  if ( t.RaycastParams( parameters ) ) parameters.IgnoreWater = true;
  parameters.FilterDescendantsInstances = finalSearchArray;

  return parameters as T;
}
