// Shared types, scenario data and the game engine. Pure TypeScript, no I/O.
export const TICK_HZ = 10;
export const TICK_MS = 1000 / TICK_HZ;

export * from './screens';
export * from './scenario';
export * from './engine';
export * from './protocol';
export * from './report';
