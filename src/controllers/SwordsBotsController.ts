import { Players } from "@rbxts/services";
import GameEnvironment from "core/GameEnvironment";
import { finishNetworkPacket, startNetworkPacket } from "core/Network";
import PlayerEntity from "entities/PlayerEntity";
import { SwordPlayerEntity, SwordState } from "entities/SwordPlayerEntity";
import WorldEntity from "entities/WorldEntity";
import { PlayerTeam } from "gamevalues";
import { RaposoConsole } from "logging";
import { writeBufferU16 } from "util/bufferwriter";
import { DoesInstanceExist } from "util/utilfuncs";

// # Types
interface BotAdvanceSuggestionResult {
  ShouldJump: boolean;
  ShouldMoveTowards: boolean;
}

// # Constants & variables
const THRESHOLD_DISTANCE = 4;
const SWORD_LENGTH = 3.9;
const NETWORK_REPL_ID = "botsword_";

const REACTION_TIME = 0.2;

// # Functions
function SearchTargetEntity( environment: T_EntityEnvironment, caller: PlayerEntity ) 
{
  let currentTarget: WorldEntity | undefined;
  let currentObjectivePoint: Vector3 | undefined;

  if ( caller.team === PlayerTeam.Spectators ) return;

  for ( const ent of environment.getEntitiesThatIsA( "PlayerEntity" ) ) 
  {
    if ( ent.team === PlayerTeam.Spectators || ent.health <= 0 ) continue;
    if ( ent.team === caller.team ) continue;

    if ( !currentTarget )
      currentTarget = ent;

    if ( ent.id === currentTarget.id )
      continue;

    // Compare the distance between the target and the caller
    const currentDistance = caller.position.sub( currentTarget.position ).Magnitude;
    const entityDistance = caller.position.sub( ent.position ).Magnitude;

    if ( currentDistance < entityDistance ) continue;
    currentTarget = ent;
  }

  for ( const ent of environment.getEntitiesThatIsA( "CapturePointEntity" ) ) 
  {
    if ( ent.current_team === caller.team ) continue;

    const linkedTrigger = environment.namedEntities.get( ent.linkedTrigger );
    if ( linkedTrigger && linkedTrigger.IsA( "TriggerEntity" ) )
      currentTarget = linkedTrigger;

    break;
  }

  return currentTarget;
}

function CalculateDistanceFromLatency( baseThreshold: number, latency: number ) 
{
  latency *= 0.01;
  latency *= 0.75;

  return baseThreshold + latency;
}

function ShouldAdvance( entity: SwordPlayerEntity, target: PlayerEntity ) 
{
  const finalResult = {
    jump: false,
    advance: true,
  };

  if ( !DoesInstanceExist( entity.humanoidModel ) ) return finalResult;
  if ( !DoesInstanceExist( target.humanoidModel ) ) return finalResult;
  if ( !target.IsA( "SwordPlayerEntity" ) ) return finalResult;

  const currentPosition = entity.humanoidModel.GetPivot().Position.mul( new Vector3( 1, 0, 1 ) );
  const targetPosition = target.position.mul( new Vector3( 1, 0, 1 ) );
  const direction = new CFrame( currentPosition, targetPosition ).LookVector;
  const inverseDirection = new CFrame( targetPosition, currentPosition ).LookVector;
  const distance = currentPosition.sub( targetPosition ).Magnitude;

  const movingTowardsUs = IsPlayerMovingTo( target, inverseDirection );
  const facingTowardsUs = IsEntityFacingTo( target, currentPosition );
  const belowLatencyThreshold = distance <= CalculateDistanceFromLatency( THRESHOLD_DISTANCE, target.statsPing );

  const possibleBait = movingTowardsUs && !facingTowardsUs;
  const healthAdvantage = math.abs( entity.health - target.health ) >= SwordState.Lunge && entity.health > target.health;

  if ( belowLatencyThreshold && target.currentState !== SwordState.Idle ) 
  {
    const swordPosition = target.humanoidModel.HumanoidRootPart.CFrame
      .mul( new CFrame( 1.5, 0, -SWORD_LENGTH * 0.5 ) )
      .Position.mul( new Vector3( 1, 0, 1 ) );
    
    const swordDistance = swordPosition.sub( currentPosition ).Magnitude;
    
    // Check if we're too close to the target's sword
    if ( swordDistance <= THRESHOLD_DISTANCE ) 
    {
      finalResult.jump = true;
      finalResult.advance = false;
      return finalResult;
    }

    if ( facingTowardsUs && movingTowardsUs && !healthAdvantage ) 
    {
      finalResult.advance = false;
      return finalResult;
    }
  }

  // Check if we have the health advantage
  if ( healthAdvantage && !possibleBait ) 
  {
    finalResult.advance = true;
    finalResult.jump = !target.grounded; // Jump bot?

    return finalResult;
  }

  if ( possibleBait ) 
  { // This could be a bait from the other player... This logic is too shitty
    finalResult.advance = false;
    finalResult.jump = false;

    return finalResult;
  }

  return finalResult;
}

function CalculateMovement( entity: SwordPlayerEntity, target: WorldEntity ) 
{
  if ( !DoesInstanceExist( entity.humanoidModel ) ) return;

  const currentPosition = entity.humanoidModel.GetPivot().Position.mul( new Vector3( 1, 0, 1 ) );
  const targetPosition = target.position.mul( new Vector3( 1, 0, 1 ) );
  const direction = new CFrame( currentPosition, targetPosition ).LookVector;
  const inverseDirection = new CFrame( targetPosition, currentPosition ).LookVector;
  const distance = currentPosition.sub( targetPosition ).Magnitude;

  const localLowHealth = entity.health < entity.maxHealth * 0.5;
  const targetLowHealth = entity.IsA( "HealthEntity" ) ? entity.health < entity.maxHealth * 0.5 : false;

  let moveDirection = direction;
  let willJump = false;

  if ( target.IsA( "PlayerEntity" ) ) 
  {
    const latencyThresholdDistance = CalculateDistanceFromLatency( THRESHOLD_DISTANCE, target.statsPing );

    const movingTowardsUs = IsPlayerMovingTo( target, inverseDirection );
    const facingTowardsUs = IsEntityFacingTo( target, currentPosition );
    const advanceSuggestion = ShouldAdvance( entity, target );

    if ( distance < latencyThresholdDistance ) 
    {
      willJump = advanceSuggestion.jump;
      moveDirection = advanceSuggestion.advance ? direction : inverseDirection;
    }

    // Try to get the advantage side if we're in the air
    // In this case, the right side of the entity, closest to their sword
    // But if we're in the air, then we absolutely have the disadvantage
    if ( !entity.grounded ) 
    {

      if ( target.grounded ) 
      {
        const rotation = new CFrame( currentPosition, targetPosition ).Rotation;
        const rightSideDirection = new CFrame( targetPosition ).mul( rotation ).mul( new CFrame( 5, 0, 0 ) ).LookVector;
        const extremeRightSideDirection = new CFrame( targetPosition ).mul( rotation ).mul( new CFrame( 10, 0, 0 ) ).LookVector;

        moveDirection = rightSideDirection;

        if ( facingTowardsUs ) 
        {
          moveDirection = extremeRightSideDirection;
        }
      }
    }
  }

  if ( distance < SWORD_LENGTH && entity.grounded )
    moveDirection = inverseDirection;

  if ( entity.grounded && willJump )
    entity.humanoidModel.Humanoid.Jump = true;
  entity.humanoidModel.Humanoid.Move( moveDirection );
}

function CalculateLookDirection( entity: PlayerEntity, target?: WorldEntity ) 
{
  if ( !DoesInstanceExist( entity.humanoidModel ) ) return;

  if ( !target ) 
  {
    entity.humanoidModel.Humanoid.AutoRotate = true;
    return;
  }

  const position = entity.humanoidModel.HumanoidRootPart.CFrame.Position;
  const targetPosition = target.position;

  const [, dirY] = new CFrame( position, target.position ).ToOrientation();
  const [rotX, rotY, rotZ] = entity.humanoidModel.HumanoidRootPart.CFrame.ToOrientation();
  let finalRotation = math.lerp( rotY, dirY, 0.1 );

  const distance = position.sub( targetPosition ).Magnitude;
  const latencyDistance = CalculateDistanceFromLatency( THRESHOLD_DISTANCE, target.IsA( "PlayerEntity" ) ? target.statsPing : 0 );

  // The... wiggle...
  if ( target.IsA( "PlayerEntity" ) && distance <= latencyDistance )
    finalRotation = dirY + math.rad( 22.5 + ( math.cos( time() * 40 ) * 30 ) );

  entity.humanoidModel.HumanoidRootPart.CFrame = new CFrame( position ).mul( CFrame.Angles( rotX, finalRotation, rotZ ) );
}

function IsEntityFacingTo( entity: WorldEntity, position: Vector3 ) 
{
  const pointDirection = new CFrame( entity.position.mul( new Vector3( 1, 0, 1 ) ), position.mul( new Vector3( 1, 0, 1 ) ) ).LookVector;
  const facingDirection = entity.ConvertOriginToCFrame().LookVector.mul( new Vector3( 1, 0, 1 ) );
  const dot = facingDirection.Dot( pointDirection );

  return dot >= 0.5;
}

function IsPlayerMovingTo( entity: WorldEntity, direction: Vector3 ) 
{
  let movingDirection = entity.velocity;

  if ( entity.IsA( "PlayerEntity" ) && entity.humanoidModel && DoesInstanceExist( entity.humanoidModel ) )
    movingDirection = entity.humanoidModel.Humanoid.MoveDirection;

  return movingDirection.Dot( direction ) >= 0.6;
}

// # Execution
GameEnvironment.BindCallbackToEnvironmentCreation( env => 
{
  if ( !env.isServer ) return;

  env.entity.entityCreated.Connect( ent => 
  {
    if ( !ent.IsA( "SwordPlayerEntity" ) ) return;
  } );

  env.netctx.ListenServer( `${NETWORK_REPL_ID}botupd`, ( sender, reader ) => 
  {
    if ( !sender ) return;

    const entityId = reader.u16();

    const entity = env.entity.entities[entityId];
    if ( !entity?.IsA( "SwordPlayerEntity" ) ) return;
    if ( entity.GetUserFromNetworkOwner() !== sender ) 
    {
      RaposoConsole.Warn( `Invalid ${SwordPlayerEntity} BOT state update from ${sender}.` );
      return;
    }

    entity.ApplyClientReplicationBuffer( reader );
  } );
} );

GameEnvironment.BindCallbackToEnvironmentCreation( env => 
{
  env.lifecycle.BindTickrate( () => 
  {
    for ( const ent of env.entity.getEntitiesThatIsA( "SwordPlayerEntity" ) ) 
    {
      if ( ent.GetUserFromNetworkOwner() !== Players.LocalPlayer ) continue;
      if ( ent.health <= 0 || ent.team === PlayerTeam.Spectators ) continue;
      if ( !DoesInstanceExist( ent.humanoidModel ) ) continue;

      const target = SearchTargetEntity( env.entity, ent );

      if ( target ) 
      {
        CalculateMovement( ent, target );
      }

      CalculateLookDirection( ent, target );

      ent.position = ent.humanoidModel.GetPivot().Position;
      ent.velocity = ent.humanoidModel.HumanoidRootPart?.AssemblyLinearVelocity ?? new Vector3();
      ent.grounded = ent.humanoidModel.Humanoid.FloorMaterial.Name !== "Air";

      startNetworkPacket( { id: `${NETWORK_REPL_ID}botupd`, context: env.netctx, unreliable: false, } );
      writeBufferU16( ent.id );
      ent.WriteClientStateBuffer();
      finishNetworkPacket();
    }
  } );
} );