import { writable } from 'svelte/store';

export const user = writable({});
export const showMapTools = writable(true);
export const mapLocation = writable();