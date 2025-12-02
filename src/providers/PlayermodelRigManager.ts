import * as Services from "@rbxts/services";
import { RaposoConsole } from "logging";
import { animFolder, cacheFolder } from "folders";
import WorldProvider from "providers/WorldProvider";
import { colorTable } from "UI/values";

// # Types
declare global {
  interface CharacterModel extends BaseCharacterModelInfo {
    Humanoid: Humanoid & {
      Animator: Animator;
    };
  }
}

interface BaseCharacterModelInfo extends Model {
  Head: Part;
  Torso: Part;
  ["Right Arm"]: Part;
  ["Left Arm"]: Part;
  HumanoidRootPart: Part;
  ["Right Leg"]: Part;
  ["Left Leg"]: Part;
}

// # Constants
const defaultAnimationList = new Map<string, { animid: string, weight: number }>();
const defaultDescription = new Instance("HumanoidDescription");

// # Variables

// # Functions

// # Class
export class PlayermodelRigManager {
  animator: CharacterAnimationManager;
  highlight = new Instance("Highlight");

  constructor(readonly rig: CharacterModel) {
    assert(Services.RunService.IsClient(), "Class can only be used on the client.");

    this.animator = new CharacterAnimationManager(this.rig.Humanoid.WaitForChild("Animator") as Animator);
  }

  SetJointsEnabled(value = true) {
    for (const inst of this.rig.GetDescendants()) {
      if (!inst.IsA("Motor6D")) continue;

      inst.Enabled = value;
    }
  }

  PivotTo(origin: CFrame) {
    this.rig.PivotTo(origin);
  }

  SetMaterial(material: Enum.Material = Enum.Material.Plastic) {
    for (const inst of this.rig.GetDescendants()) {
      if (!inst.IsA("BasePart")) continue;
      if (inst.Name === "HumanoidRootPart") continue;

      inst.Material = material;
    }
  }

  SetTransparency(amount = 0) {
    for (const inst of this.rig.GetDescendants()) {
      if (!inst.IsA("BasePart") && !inst.IsA("Decal")) continue;
      if (inst.Name === "HumanoidRootPart") continue;

      inst.Transparency = amount;
    }
  }

  async SetDescription(desc = defaultDescription) {
    this.rig.Humanoid.ApplyDescription(desc);
  }

  Destroy() {
    this.rig?.Destroy();
    this.animator.Destroy();

    rawset(this, "rigmodel", undefined);
  }
}

export class CharacterAnimationManager {
  private _instances_list = new Array<Instance>();
  private _connections_list = new Array<RBXScriptConnection>();
  private _loaded_anims = new Map<string, AnimationTrack>();

  walkspeed = Services.StarterPlayer.CharacterWalkSpeed;
  velocity = Vector3.zero;
  is_grounded = true;

  constructor(private readonly _animatorinst: Animator) {
    // Default animation list
    for (const [name, content] of defaultAnimationList) {
      const inst = new Instance("Animation");
      inst.Name = name;
      inst.AnimationId = content.animid;
      inst.Parent = cacheFolder;

      const track = this._animatorinst.LoadAnimation(inst);
      track.AdjustWeight(content.weight);

      this._instances_list.push(inst, track);
      this._loaded_anims.set(name, track);
    }

    // Load game animations
    for (const inst of animFolder.GetDescendants()) {
      if (!inst.IsA("Animation")) continue;

      const track = this._animatorinst.LoadAnimation(inst);
      this._instances_list.push(track);
      this._loaded_anims.set(inst.Name, track);
    }
  }

  PlayAnimation(name: string, priority: Enum.AnimationPriority["Name"] = "Action", force = false, speed = 1) {
    const targetanim = this._loaded_anims.get(name);
    if (!targetanim) {
      RaposoConsole.Warn(`Unknown animation: ${name}`);
      return;
    }

    targetanim.Priority = Enum.AnimationPriority[priority];
    targetanim.AdjustSpeed(speed);

    if (force) {
      targetanim.Stop(0);
      targetanim.TimePosition = 0;
    }

    if (!targetanim.IsPlaying) {
      targetanim.Play();
    }
  }

  StopAnimation(name: string) {
    const targetanim = this._loaded_anims.get(name);
    if (!targetanim) {
      RaposoConsole.Warn(`Unknown animation: ${name}`);
      return;
    }

    targetanim.Stop(0.1);
  }

  StopAllAnimations() {
    for (const [_, animation] of this._loaded_anims) {
      animation.Stop(0.1);
    }
  }

  Destroy() {
    this.StopAllAnimations();
    this._loaded_anims.clear();

    for (const inst of this._instances_list)
      inst.Destroy();
    this._instances_list.clear();

    for (const conn of this._connections_list)
      conn.Disconnect();
    this._connections_list.clear();

    table.clear(this);
  }

  Update() {
    const horizontalVelocity = this.velocity.mul(new Vector3(1, 0, 1));

    if (horizontalVelocity.Magnitude > 0.05 && this.is_grounded)
      this.PlayAnimation("run", "Core", false, this.walkspeed / 14.5); // the (old) default run speed was this one
    else
      this.StopAnimation("run");

    // if (humanoid.Jump && humanoid.FloorMaterial.Name !== "Air")
    //   this.PlayAnimation("jump", "Core");
    // else
    //   this.StopAnimation("jump");

    // if (!humanoid.Jump && humanoid.FloorMaterial.Name === "Air")
    //   this.PlayAnimation("fall", "Core");
    // else
    //   this.StopAnimation("fall");

    if (!this.is_grounded)
      this.PlayAnimation("fall", "Core");
    else
      this.StopAnimation("fall");
  }
}

// # Bindings & misc
defaultDescription.HeadColor = new Color3(127, 127, 127);
defaultDescription.TorsoColor = new Color3(127, 127, 127);
defaultDescription.RightArmColor = new Color3(127, 127, 127);
defaultDescription.LeftArmColor = new Color3(127, 127, 127);
defaultDescription.LeftLegColor = new Color3(127, 127, 127);
defaultDescription.RightLegColor = new Color3(127, 127, 127);

defaultAnimationList.set("idle", { animid: "http://www.roblox.com/asset/?id=180435571", weight: 9 });
defaultAnimationList.set("walk", { animid: "http://www.roblox.com/asset/?id=180426354", weight: 10 });
defaultAnimationList.set("run", { animid: "http://www.roblox.com/asset/?id=180426354", weight: 10 });
defaultAnimationList.set("jump", { animid: "http://www.roblox.com/asset/?id=125750702", weight: 10 });
defaultAnimationList.set("fall", { animid: "http://www.roblox.com/asset/?id=180436148", weight: 10 });
defaultAnimationList.set("climb", { animid: "http://www.roblox.com/asset/?id=180436334", weight: 10 });
defaultAnimationList.set("sit", { animid: "http://www.roblox.com/asset/?id=178130996", weight: 10 });
defaultAnimationList.set("toolnone", { animid: "http://www.roblox.com/asset/?id=182393478", weight: 10 });
defaultAnimationList.set("toolslash", { animid: "http://www.roblox.com/asset/?id=129967390", weight: 10 });
defaultAnimationList.set("toollunge", { animid: "http://www.roblox.com/asset/?id=129967478", weight: 10 });
