import { RunService, UserInputService } from "@rbxts/services";
import { ExecuteCommand } from "cmd";
import GameEnvironment from "core/GameEnvironment";
import { RaposoConsole } from "logging";

// # Types
interface InputAction {
  onActivate: Callback;
  onDeactivate?: Callback;
}

type InputKeys = Enum.KeyCode["Name"] | Enum.UserInputType["Name"];

// # Constants & variables
const registeredActions = new Map<string, InputAction>();
const actionBoundKeys = new Map<InputKeys, Set<string>>();

// # Functions

// # Namespace
export namespace InputSystem {
  export function RegisterAction(name: string, onActivate: Callback, onDeactivate?: Callback) {
    registeredActions.set(name, { onActivate, onDeactivate });
  }

  export function BindKeyToAction(keycode: InputKeys, action: string) {
    const existingList = actionBoundKeys.get(keycode) || new Set();
    existingList.add(action);

    if (!actionBoundKeys.has(keycode))
      actionBoundKeys.set(keycode, existingList);

    RaposoConsole.Info("Bound key", keycode, "to:", action);
  }
}

// # Bindings & misc
if (RunService.IsClient()) {
  UserInputService.InputBegan.Connect((input, busy) => {
    if (busy) return;

    const name = input.KeyCode.Name !== "Unknown" ? input.KeyCode.Name : input.UserInputType.Name;
    const boundActions = actionBoundKeys.get(name);

    if (!boundActions) return;

    for (const actionName of boundActions) {
      const actionInfo = registeredActions.get(actionName);
      actionInfo?.onActivate();

      if (!actionInfo)
        ExecuteCommand(actionName,GameEnvironment.GetDefaultEnvironment());
    }
  });

  UserInputService.InputEnded.Connect((input, busy) => {
    if (busy) return;

    const name = input.KeyCode.Name !== "Unknown" ? input.KeyCode.Name : input.UserInputType.Name;
    const boundActions = actionBoundKeys.get(name);

    if (!boundActions) return;

    for (const actionName of boundActions) {
      const actionInfo = registeredActions.get(actionName);
      actionInfo?.onDeactivate?.();

      if (!actionInfo)
        ExecuteCommand(actionName,GameEnvironment.GetDefaultEnvironment());
    }
  });
}