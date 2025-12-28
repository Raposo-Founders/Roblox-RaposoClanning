import { RunService, TweenService, UserInputService } from "@rbxts/services";
import { t } from "@rbxts/t";
import WorldEntity from "entities/WorldEntity";
import { MapContent } from "providers/WorldProvider";
import { generateTracelineParameters } from "util/traceparam";
import { DoesInstanceExist } from "util/utilfuncs";
import { SoundSystem } from "../systems/SoundSystem";
import GameEnvironment from "core/GameEnvironment";

// # Constants & variables
const UserGameSettings = UserSettings().GetService( "UserGameSettings" );

export const CAMERA_INST = new Instance( "Camera" );
CAMERA_INST.Parent = workspace;
CAMERA_INST.CameraType = Enum.CameraType.Scriptable;
CAMERA_INST.Name = "Raposo";

let trackingInstance: Instance | EntityId | undefined;

// Camera rotation
const PITCH_LIMIT = 89;
// const ROTATION_SPEED_MOUSE = new Vector2(1, 0.77).mul(math.rad(0.5)); // (rad/s)
const ROTATION_SPEED_MOUSE = new Vector2( 1, 0.77 ).mul( 0.5 ); // (rad/s)
const ROTATION_SPEED_TOUCH = new Vector2( 1, 0.66 ).mul( math.rad( 1 ) ); // (rad/s)
const ROTATION_SPEED_GAMEPAD = new Vector2( 1, 0.77 ).mul( math.rad( 4 ) ); // (rad/s)

let cameraRotation = new Vector2();

// Camera zoom
const ZOOM_TWEENTIME = 0.25;
const ZOOM_MAXDIST = 60;
const ZOOM_MINDIST = 5;
let targetZoomDistance = 20;
let currZoomDistance = targetZoomDistance;
let lastZoomDistance = targetZoomDistance;
let lastZoomDistanceChangedTime = 0;

// Shift lock
const SHIFTLOCK_OFFSET = new CFrame( 1.75, 0, 0 );
export let shiftlockEnabled = false;

// # Functions
export function SetCameraTrackingObject( object: Instance | EntityId | undefined ) 
{
  trackingInstance = object;
}

export function GetCameraInputDirection() 
{
  const inversionFactor = new Vector2( 1, UserGameSettings.GetCameraYInvertValue() );

  let delta = Vector2.zero;

  // Mouse delta
  {
    const rawMouseDelta = UserInputService.GetMouseDelta();
    const mouseDeltaSens = UserInputService.MouseDeltaSensitivity || 1;

    const scaledRawDelta = rawMouseDelta.mul( mouseDeltaSens );
    const sensMultipliedDelta = new Vector2( scaledRawDelta.X * ROTATION_SPEED_MOUSE.X, scaledRawDelta.Y * ROTATION_SPEED_MOUSE.Y );

    delta = delta.add( sensMultipliedDelta );
  }

  return delta.mul( inversionFactor );
}

export function SetCameraDistance( distance: number ) 
{
  lastZoomDistance = currZoomDistance;
  targetZoomDistance = math.clamp( distance, ZOOM_MINDIST, ZOOM_MAXDIST );
  lastZoomDistanceChangedTime = time();
}

export function SetCameraShiftLockEnabled( enabled: boolean ) 
{
  shiftlockEnabled = enabled;
}

export function IsCameraShiftlockEnabled() 
{
  return shiftlockEnabled;
}

export function UpdateCameraLoop( dt: number, env: GameEnvironment ) 
{
  UpdateMouseLock();
  UpdateCameraZoom();
  MainUpdateCamera( dt, env );
}

// # Functions
function UpdateMouseLock() 
{
  const mouseButtonDown = UserInputService.IsMouseButtonPressed( "MouseButton2" );

  const inputMovingCamera = mouseButtonDown;

  if ( inputMovingCamera || shiftlockEnabled )
    UserInputService.MouseBehavior = shiftlockEnabled ? Enum.MouseBehavior.LockCenter : Enum.MouseBehavior.LockCurrentPosition;

  if ( !inputMovingCamera && !shiftlockEnabled )
    UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
}

function UpdateCameraZoom() 
{
  const passedTime = time() - lastZoomDistanceChangedTime;
  const alpha = math.clamp( passedTime / ZOOM_TWEENTIME, 0, 1 );

  const lerp = math.lerp( lastZoomDistance, targetZoomDistance, TweenService.GetValue( alpha, "Quad", "Out" ) );

  currZoomDistance = lerp;
}

function MainUpdateCamera( dt: number, env: GameEnvironment ) 
{
  if ( !DoesInstanceExist( CAMERA_INST ) || CAMERA_INST.CameraType.Name !== "Scriptable" || workspace.CurrentCamera !== CAMERA_INST )
    return;

  const inputDirection = GetCameraInputDirection();
  let trackingEntity: WorldEntity | undefined;
  let focusPoint = new Vector3();

  if ( t.string( trackingInstance ) ) 
  {
    const targetEntity = env.entity.entities.get( trackingInstance );

    if ( targetEntity?.IsA( "WorldEntity" ) ) trackingEntity = targetEntity;
    if ( trackingEntity?.IsA( "PlayerEntity" ) && DoesInstanceExist( trackingEntity.humanoidModel ) )
      focusPoint = trackingEntity.humanoidModel.GetPivot().add( new Vector3( 0, 1.5, 0 ) ).Position;
  }

  if ( t.instanceIsA( "BasePart" )( trackingInstance ) ) 
  {
    focusPoint = trackingInstance.CFrame.Position;
  }

  // Camera rotation input
  cameraRotation = new Vector2(
    cameraRotation.X - inputDirection.X,
    math.clamp( cameraRotation.Y - inputDirection.Y, -PITCH_LIMIT, PITCH_LIMIT ),
  );

  let targetCFrame = new CFrame( focusPoint )
    .mul( CFrame.Angles( 0, math.rad( cameraRotation.X ), 0 ) )
    .mul( shiftlockEnabled ? SHIFTLOCK_OFFSET : new CFrame() )
    .mul( CFrame.Angles( math.rad( cameraRotation.Y ), 0, 0 ) )
    .mul( new CFrame( 0, 0, currZoomDistance ) );

  // Wall detection
  {
    const targetPosition = targetCFrame.Position;
    const direction = targetPosition.sub( focusPoint );
    const rotation = targetCFrame.Rotation;

    const raycast = workspace.Spherecast(
      focusPoint,
      1,
      direction,
      generateTracelineParameters( false, [MapContent.Parts], [], env.entity ),
    );

    if ( raycast )
      targetCFrame = new CFrame( focusPoint.add( direction.Unit.mul( raycast.Distance ) ) ).mul( rotation );
  }

  CAMERA_INST.CFrame = targetCFrame;
  CAMERA_INST.Focus = new CFrame( focusPoint );
}

// # Bindings
if ( RunService.IsClient() )
  UserInputService.InputChanged.Connect( ( input, busy ) => 
  {
    if ( input.UserInputType === Enum.UserInputType.MouseWheel )
      SetCameraDistance( targetZoomDistance + ( 5 * -input.Position.Z ) );
  } );

if ( RunService.IsClient() )
  UserInputService.InputBegan.Connect( () => 
  {
    CAMERA_INST.CameraType = UserInputService.TouchEnabled ? Enum.CameraType.Custom : Enum.CameraType.Scriptable;
  } );

// # Logic
if ( RunService.IsClient() ) 
{
  SoundSystem.CreateSoundGroup( "Default" );
  SoundSystem.AddListenerToWorldObject( CAMERA_INST, "Default" );

  workspace.CurrentCamera = CAMERA_INST;
}