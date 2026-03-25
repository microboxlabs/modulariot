import { FlyToInterpolator } from "deck.gl";

export type ViewState = {
  latitude: number;
  longitude: number;
  zoom: number;
  pitch: number;
  transitionDuration: number;
  transitionInterpolator: FlyToInterpolator;
  transitionEasing: (t: number) => number;
};
