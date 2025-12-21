import { t } from "@rbxts/t";

declare global {
  interface TracelineResult {
    origin: Vector3;
    target: Vector3;
    hitVec?: Vector3;

    distance: number;
    direction: Vector3;
    normalFace?: Vector3;

    instance?: BasePart;
  }
}

// # Constants & variables
const TRACELINE_DEF_DIST = 10e8;

// # Functions
export function validadeTraceline( data: object ): data is TracelineResult 
{
  return t.interface( {
    origin: t.Vector3,
    target: t.Vector3,
    hitVec: t.optional( t.Vector3 ),

    distance: t.number,
    direction: t.Vector3,
    normalFace: t.Vector3,

    instance: t.optional( t.instanceIsA( "BasePart" ) ),
  } )( data );
}

export function UTIL_TraceLine( root: WorldRoot, startVec: Vector3, endVec: Vector3, params: RaycastParams ): TracelineResult 
{
  const direction = new CFrame( startVec, endVec ).LookVector;
  const distance = startVec.sub( endVec ).Magnitude;
  const raycast = root.Raycast( startVec, direction.mul( distance ), params );

  return {
    origin: startVec,
    target: endVec,
    hitVec: raycast?.Position,

    distance: raycast?.Distance ?? distance,
    direction: direction,
    normalFace: raycast?.Normal,

    instance: raycast?.Instance,
  };
}
