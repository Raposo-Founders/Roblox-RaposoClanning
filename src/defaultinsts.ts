import Signal from "./util/signal";

// # Constants & variables
export const clientSessionConnected = new Signal<[sessionId: string]>();
export const clientSessionDisconnected = new Signal<[sessionId: string, reason: string]>();
