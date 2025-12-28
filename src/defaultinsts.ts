import Signal from "./util/signal";

// # Constants & variables
export const clientSessionConnected = new Signal();
export const clientSessionDisconnected = new Signal<[reason: string]>();
