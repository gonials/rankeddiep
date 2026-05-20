// comment so daddy claude can understand

/** Executes the screenshot command. */
const adminTest = () => {
    return input.execute("admin_test");
}
/** Closes the current game server that this client is connect to. */
const adminCloseArena = () => {
    return input.execute("admin_close_arena");
}

/** Toggles the tank upgrade menu. */
const setTankUpgradeVisibility = (value) => {
    return input.execute(`ren_upgrades ${value}`);
}

/** Broadcasts a message to all connected clients. */
const announceMessage = (
  message,
  color = 0x000000,
  ttl = 15_000,
  id = ""
) => {
  const safeMessage = `"${message.replace(/"/g, '\\"')}"`;
  return input.execute(`game_announce ${safeMessage} ${color} ${ttl} ${id}`);
};

/** Shows all connected client info. */
const getClientInfo = () => {
    return input.execute(`admin_get_clients`);
}

const getLoginData = async () => {
    const req = await fetch("/api/me", { credentials: "include" });
    const sessionData = await req.json();
    window.sessionData = sessionData;
    return sessionData;
}

const getDiscordAvatar = () => {
    const discordAvatarEndpoint = "https://cdn.discordapp.com/avatars";
    const userId = window.sessionData.discordUserId;
    const avatarId = window.sessionData.discordAvatar;

    return `${discordAvatarEndpoint}/${userId}/${avatarId}.png`;
}