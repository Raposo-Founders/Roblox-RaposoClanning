
// # Constants & variables

import { HttpService, RunService } from "@rbxts/services";

// # Functions

// # Namespace
export namespace HttpProvider {
  export function Request(requestOptions: RequestAsyncRequest, maxAttempts = 3, attemptCooldown = 1) {
    assert(RunService.IsServer(), "Function can only be called from the server.");

    let totalAttempts = 0;

    while (game) {
      totalAttempts++;
      if (totalAttempts > maxAttempts) {
        warn(`Failed to ${requestOptions.Method} "${requestOptions.Url}". (MAX_ATTEMPTS_REACHED)`);
        break;
      }

      const [success, result] = pcall(() => HttpService.RequestAsync(requestOptions));
      if (!success) {
        warn(`Failed to ${requestOptions.Method} "${requestOptions.Url}", retrying in ${attemptCooldown} seconds...`);
        print(result);

        task.wait(attemptCooldown);
        continue;
      }

      if (!result.Success) {
        warn(`${requestOptions.Method} to "${requestOptions.Url}" returned code: ${result.StatusCode} (${result.StatusMessage}).\nRetrying in ${attemptCooldown} seconds...`);
        task.wait(attemptCooldown);
        continue;
      }

      return result.Body;
    }
  }

  export function Get(url: string, headers?: HttpHeaders, maxAttempts = 3, attemptCooldown = 1) {
    assert(RunService.IsServer(), "Function can only be called from the server.");

    let totalAttempts = 0;

    while (game) {
      totalAttempts++;
      if (totalAttempts > maxAttempts) {
        warn(`Failed to Get "${url}". (MAX_ATTEMPTS_REACHED)`);
        break;
      }

      const [success, result] = pcall(() => HttpService.GetAsync(url, true, headers));
      if (!success) {
        warn(`Failed to Get "${url}", retrying in ${attemptCooldown} seconds...`);
        print(result);

        task.wait(attemptCooldown);
        continue;
      }

      const [success2, object] = pcall(() => HttpService.JSONDecode(result));
      if (!success2) {
        warn(`Failed to JSONDecode URL result, retrying in ${attemptCooldown} seconds...`);
        print(object);

        task.wait(attemptCooldown);
        continue;
      }

      return object;
    }
  }
}

// # Bindings & misc