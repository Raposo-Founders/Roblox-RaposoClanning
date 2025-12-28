import { ContextActionService, RunService, UserInputService } from "@rbxts/services";
import GameEnvironment from "core/GameEnvironment";
import { IsCameraShiftlockEnabled, SetCameraShiftLockEnabled } from "./CameraController";
import { getLocalPlayerEntity } from "./LocalEntityController";

// # Variables
let swordsAutoAttack = false;

// # Functions
function setAutoAttack( state: Enum.UserInputState, enabled: boolean ) 
{
  if ( state.Name !== "End" ) return;
  swordsAutoAttack = enabled;
}

function swordsAttack() 
{
  const entity = getLocalPlayerEntity( GameEnvironment.GetDefaultEnvironment() );
  if ( !entity?.IsA( "SwordPlayerEntity" ) || entity.health <= 0 ) return;

  entity.AttackRequest();
}

function swordsEquipToggle( state: Enum.UserInputState ) 
{
  if ( state.Name !== "End" ) return;
  
  const entity = getLocalPlayerEntity( GameEnvironment.GetDefaultEnvironment() );
  if ( !entity?.IsA( "SwordPlayerEntity" ) || entity.health <= 0 ) return;

  if ( entity.isEquipped )
    entity.Unequip();
  else
    entity.Equip();
}

function setShiftLock( state: Enum.UserInputState ) 
{
  if ( state.Name !== "Begin" ) return;
  SetCameraShiftLockEnabled( !IsCameraShiftlockEnabled() );
}

function stylizeButton( actionName: string, anchorPoint: Vector2, position: UDim2, size: UDim2 ) 
{
  const btn = ContextActionService.GetButton( actionName );
  if ( !btn ) return;

  btn.AnchorPoint = anchorPoint;
  btn.Position = position;
  btn.Size = size;

  const aspectRatio = new Instance( "UIAspectRatioConstraint" );
  aspectRatio.AspectRatio = 1;
  aspectRatio.Parent = btn;
}

// # Execution

if ( RunService.IsClient() ) 
{
  UserInputService.InputBegan.Connect( ( input, busy ) => 
  {
    if ( busy ) return;

    if ( input.UserInputType.Name === "MouseButton1" || input.UserInputType.Name === "Touch" )
      swordsAttack();
  } );
}

// Setup mobile inputs
if ( RunService.IsClient() ) 
{
  ContextActionService.BindAction( "swords_equipToggle", ( _, state ) => swordsEquipToggle( state ), true, Enum.KeyCode.One );
  ContextActionService.BindAction( "swords_autoAttack", ( _, state ) => setAutoAttack( state, !swordsAutoAttack ), true, Enum.KeyCode.R );
  ContextActionService.BindAction( "shiftlock", ( _, state ) => setShiftLock( state ), true, Enum.KeyCode.LeftShift, Enum.KeyCode.RightShift );

  ContextActionService.SetTitle( "swords_equipToggle", "Equip" );
  ContextActionService.SetTitle( "swords_autoAttack", "AC" );
  ContextActionService.SetTitle( "shiftlock", "SL" );

  stylizeButton(
    "swords_equipToggle",
    new Vector2( 0, 0.5 ),
    new UDim2( 0, 0, 0.5, 0 ),
    UDim2.fromScale( 0.3, 0.3 ),
  );

  stylizeButton(
    "swords_autoAttack",
    new Vector2( 0, 1 ),
    new UDim2( 0, 0, 1, 0 ),
    UDim2.fromScale( 0.25, 0.25 ),
  );
  
  stylizeButton(
    "shiftlock",
    new Vector2( 1, 1 ),
    new UDim2( 0.9, 0, 0.5, 0 ),
    UDim2.fromScale( 0.25, 0.25 ),
  );
}

if ( RunService.IsClient() )
  GameEnvironment.BindCallbackToEnvironmentCreation( env => 
  {
    if ( env.isServer ) return;

    env.lifecycle.BindTickrate( () => 
    {
      const entity = getLocalPlayerEntity( env );
      if ( !entity || entity.health <= 0 ) return;

      if ( swordsAutoAttack && entity.IsA( "SwordPlayerEntity" ) )
        entity.AttackRequest();
    } );
  } );