import {
  CompositeLayer,
  IconLayer,
  Layer,
  ScenegraphLayer,
  type UpdateParameters,
} from "deck.gl";
import { createSVGIcon } from "../prototype/svg-generation";
import {
  headingToYaw,
  shouldShowTruckModel,
  truckOrientation,
} from "./pin-orientation";

type PinPosition = {
  assetid: string;
  heading: number;
  latitude: number;
  location: string;
  timestamp: string;
  longitude: number;
  speed: number;
};

const TRUCK_MODEL_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/models/lct-3000.glb`;
const TRUCK_SIZE_SCALE = 8;

function pinPositions(data: PinPosition[] | undefined): PinPosition[] {
  return (data ?? []).filter((d): d is PinPosition => !!d);
}

export class PinLayer extends CompositeLayer<any> {
  shouldUpdateState(params: UpdateParameters<this>): boolean {
    return (
      super.shouldUpdateState(params) ||
      Boolean(params.changeFlags.viewportChanged)
    );
  }

  renderLayers(): Layer[] {
    const data = pinPositions(this.props.data);
    const zoom = this.context.viewport?.zoom ?? 0;
    const showTruck = shouldShowTruckModel(zoom);

    return [
      new IconLayer<PinPosition>({
        id: "IconLayer-base",
        data,
        visible: !showTruck,
        getIcon: () => ({
          url: createSVGIcon(1, false),
          width: 300,
          height: 500,
          anchorX: 150,
          anchorY: 310,
          mask: false,
        }),
        getPosition: (d) => [d.longitude, d.latitude],
        getAngle: (d) => headingToYaw(d.heading),
        getSize: 50,
        updateTriggers: this.props.updateTriggers,
        pickable: true,
        parameters: { depthTest: false },
      }) as Layer,
      new ScenegraphLayer<PinPosition>({
        id: "truck-model",
        data,
        visible: showTruck,
        scenegraph: TRUCK_MODEL_URL,
        getPosition: (d) => [d.longitude, d.latitude],
        getOrientation: (d) => truckOrientation(d.heading),
        sizeScale: TRUCK_SIZE_SCALE,
        sizeMinPixels: 64,
        _lighting: "flat",
        pickable: true,
        updateTriggers: this.props.updateTriggers,
      }) as Layer,
    ];
  }
}
