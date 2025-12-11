import { Players, RunService } from "@rbxts/services";
import { DoesInstanceExist } from "util/utilfuncs";
import { CAMERA_INST, IsCameraShiftlockEnabled, SetCameraTrackingObject } from "./CameraController";
import GameEnvironment from "core/GameEnvironment";

// # Constants & variables

// # Functions
export function getLocalPlayerEntity(env: GameEnvironment) {
  assert(RunService.IsClient(), "Function can only be called from the client.");

  for (const ent of env.entity.getEntitiesThatIsA("PlayerEntity"))
    if (ent.GetUserFromController() === Players.LocalPlayer)
      return ent;
}

// # Bindings & execution
GameEnvironment.BindCallbackToEnvironmentCreation(env => {
  if (env.isServer) return;

  env.lifecycle.BindLateUpdate(() => {
    if (env.isPlayback) return;

    const entity = getLocalPlayerEntity(env);
    if (!entity || !DoesInstanceExist(entity.humanoidModel)) return;
    if (entity.health <= 0) return;

    SetCameraTrackingObject(entity.humanoidModel.FindFirstChild("Head"));
    Players.LocalPlayer.Character = entity.humanoidModel;

    if (IsCameraShiftlockEnabled()) {
      const currentPosition = entity.humanoidModel.HumanoidRootPart.CFrame;
      const [charX, , charZ] = currentPosition.ToOrientation();
      const [, camRotY] = CAMERA_INST.CFrame.ToOrientation();

      entity.humanoidModel.HumanoidRootPart.CFrame = new CFrame(currentPosition.Position).mul(CFrame.Angles(charX, camRotY, charZ));
    }

    const pivot = entity.humanoidModel.HumanoidRootPart.CFrame;
    const [rotY, rotX, rotZ] = pivot.ToOrientation();

    entity.humanoidModel.Humanoid.AutoRotate = !IsCameraShiftlockEnabled();
    entity.position = pivot.Position;
    entity.rotation = new Vector3(math.deg(rotX), math.deg(rotY), math.deg(rotZ));
  });
});