import ColorUtils from "@rbxts/colour-utils";
import { Players, RunService, TextChatService, UserInputService } from "@rbxts/services";
import GameEnvironment from "core/GameEnvironment";
import { ListenStandardMessage, SendStandardMessage } from "core/NetworkModel";
import PlayerEntity from "entities/PlayerEntity";
import { PlayerTeam } from "gamevalues";
import { RenderChatMessage } from "UI/chatui/chatwindow";
import { colorTable, uiValues } from "UI/values";
import { ReplicatedInstance } from "util/utilfuncs";
import { SoundsPath, SoundSystem } from "./SoundSystem";

// # Types
type ChatMessageAttributes = "Shout" | "TeamOnly";

// # Constants & variables
const ATTRIBUTES_SEPARATOR = ";";
const CHAT_SYSMSG_NETID = "chatsys_sysmsg";

const CHANNELS_FOLDER = ReplicatedInstance(TextChatService, "ServerChannels", "Folder");
const DEFAULT_CHANNEL = ReplicatedInstance(CHANNELS_FOLDER, "RAPOSO_CHANNEL_DEFAULT", "TextChannel");
const WINDOW_CONFIG = TextChatService.WaitForChild("ChatWindowConfiguration") as ChatWindowConfiguration;
const INPUTBAR_CONFIG = TextChatService.WaitForChild("ChatInputBarConfiguration") as ChatInputBarConfiguration;

const CUSTOM_USER_PREFIXES = new Map<number, string>();

const chatSound = new SoundSystem.SoundInstance();
chatSound.SetAssetPath(SoundsPath.Talk);
chatSound.player.Volume = 2;
chatSound.clearOnFinish = false;

// # Functions
function formatString(text: string) {
  return text.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
}

// # Namespace
namespace ChatSystem {
  export function sendMessage(text: string, attributes: ChatMessageAttributes[]) {
    assert(RunService.IsClient(), "Function can only be called from the client.");

    DEFAULT_CHANNEL.SendAsync(formatString(text), attributes.join(ATTRIBUTES_SEPARATOR));
  }

  export function sendSystemMessage(text: string, targetPlayers: Player[] = Players.GetPlayers(), ignorePlayers: Player[] = []) {
    if (RunService.IsServer()) {
      for (const user of targetPlayers) {
        if (ignorePlayers.includes(user) || !user.IsDescendantOf(Players)) continue;

        SendStandardMessage(CHAT_SYSMSG_NETID, { text }, user);
      }

      return;
    }

    DEFAULT_CHANNEL.DisplaySystemMessage(text);
  }
}

// # Execution
if (RunService.IsClient())
  ListenStandardMessage(CHAT_SYSMSG_NETID, (sender, obj) => DEFAULT_CHANNEL.DisplaySystemMessage(tostring(obj.text)));

if (RunService.IsServer()) {
  Players.PlayerAdded.Connect(user => {
    DEFAULT_CHANNEL.AddUserAsync(user.UserId);
  });

  DEFAULT_CHANNEL.ShouldDeliverCallback = (message, source) => {
    const senderUser = Players.GetPlayerByUserId(message.TextSource?.UserId ?? 0);
    if (!senderUser) return false;

    const receivingUser = Players.GetPlayerByUserId(source.UserId);
    if (!receivingUser) return false;

    for (const server of GameEnvironment.GetServersFromPlayer(senderUser)) {
      if (!server.players.has(receivingUser)) continue;
      return true;
    }

    return false;
  };
}

if (RunService.IsClient()) {
  UserInputService.InputBegan.Connect(() => {
    INPUTBAR_CONFIG.TargetTextChannel = DEFAULT_CHANNEL;
    WINDOW_CONFIG.VerticalAlignment = UserInputService.TouchEnabled ? Enum.VerticalAlignment.Top : Enum.VerticalAlignment.Bottom;
  });

  DEFAULT_CHANNEL.OnIncomingMessage = (message) => {
    let finalPrefix = "";
    let textColor = ColorUtils.Darken(uiValues.hud_team_color[0].getValue(), 0.75);

    const senderUser = Players.GetPlayerByUserId(message.TextSource?.UserId ?? 0);
    if (senderUser) {
      let entity: PlayerEntity | undefined;
      for (const ent of GameEnvironment.GetDefaultEnvironment().entity.getEntitiesThatIsA("PlayerEntity")) {
        if (ent.GetUserFromController() !== senderUser) continue;
        entity = ent;
        break;
      }

      let isListed = false;

      if (entity) {
        switch (entity.team) {
        case PlayerTeam.Defenders:
          textColor = Color3.fromHex(colorTable.defendersColor);
          break;
        case PlayerTeam.Raiders:
          textColor = Color3.fromHex(colorTable.raidersColor);
          break;
        case PlayerTeam.Spectators:
          textColor = Color3.fromHex(colorTable.spectatorsColor);
          break;
        }

        isListed = entity.isDegenerate || entity.isExploiter;
      }

      finalPrefix = `${finalPrefix}${isListed ? `<font color="#ff0000">[LISTED]</font> ` : ""}`;
      finalPrefix = `${finalPrefix}${CUSTOM_USER_PREFIXES.get(senderUser.UserId) ?? ""}`;
      finalPrefix = `${finalPrefix} <font color="#${textColor.ToHex()}">${senderUser.Name}</font>: `;
    }

    const properties = new Instance("TextChatMessageProperties");
    properties.PrefixText = finalPrefix;

    return properties;
  };

  DEFAULT_CHANNEL.MessageReceived.Connect(message => {
    RenderChatMessage(`${message.PrefixText}${message.Text}`);
    chatSound.Play();
  });
}

CUSTOM_USER_PREFIXES.set(3676469645, `<font color="#55ff7f"><i>[Snake]</i></font>`); // coolergate

export = ChatSystem;