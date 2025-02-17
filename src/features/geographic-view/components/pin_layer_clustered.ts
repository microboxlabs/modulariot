import { CompositeLayer, IconLayer, Layer } from "deck.gl";
import pinbg from "@assets/testing/PinBg.svg";
import face from "@assets/testing/Face.svg";
import Supercluster from "supercluster";
import { PinCountLayer } from "./pin_count";

const icon_definition = {
  pin: {
    url: "@assets/testing/PinBg.svg",
    x: 0,
    y: 0,
    width: 300,
    height: 460,
    anchorX: 150,
    anchorY: 310,
    mask: false,
  },
  face: {
    url: "@assets/testing/Face.svg",
    x: 0,
    y: 0,
    width: 140,
    height: 110,
    anchorX: 140 / 2,
    anchorY: 110 / 2,
    mask: false,
  },
};

interface ClusterFeature {
  type: "Feature";
  properties: {
    cluster?: boolean;
    point_count?: number;
    [key: string]: any;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

export class PinLayer extends CompositeLayer<any> {
  supercluster: Supercluster;
  state!: {
    clusters: ClusterFeature[];
  };

  constructor(props: any) {
    super(props);
    this.supercluster = new Supercluster({
      radius: props.sizeScale * Math.sqrt(2) || 50,
      maxZoom: 16,
      minPoints: 2,
      extent: 512,
      nodeSize: 64,
    });
  }

  initializeState(context: any) {
    super.initializeState(context);

    this.setState({
      clusters: [],
    });
  }

  updateState({ props, changeFlags }: any) {
    const zoom = Math.floor(props.zoom || 10);

    if (changeFlags.propsOrDataChanged) {
      const features = (props.data || []).map((point: any) => ({
        type: "Feature",
        properties: {
          ...point,
          cluster: false,
        },
        geometry: {
          type: "Point",
          coordinates: [point.longitude, point.latitude],
        },
      }));

      this.supercluster.load(features);

      const clusters = this.supercluster.getClusters(
        [-180, -85, 180, 85],
        zoom,
      ) as ClusterFeature[];

      this.setState({ clusters });
    }
  }

  renderLayers(): Layer[] {
    const { clusters } = this.state;

    if (!clusters || clusters.length === 0) {
      return [];
    }

    const getIconSize = (count: number) => {
      const baseSize = Math.min(70, count) / 70 + 1;
      return count > 1 ? baseSize * 70 : 50;
    };

    return [
      new IconLayer({
        id: "IconLayer-base",
        data: clusters,
        getIcon: () => "pin",
        getPosition: (d: ClusterFeature) => d.geometry.coordinates,
        getAngle: (d: ClusterFeature) =>
          !d.properties.cluster ? Math.round(360 + d.properties.heading) : 0,
        iconAtlas: pinbg.src,
        iconMapping: icon_definition,
        getSize: (d: ClusterFeature) =>
          getIconSize(d.properties.cluster ? d.properties.point_count || 1 : 1),
        updateTriggers: this.props.updateTriggers,
        pickable: true,
      }) as Layer,
      new IconLayer({
        id: "IconLayer-head",
        data: clusters,
        getIcon: () => "face",
        getPosition: (d: ClusterFeature) => d.geometry.coordinates,
        iconAtlas: face.src,
        iconMapping: icon_definition,
        getSize: (d: ClusterFeature) =>
          getIconSize(
            d.properties.cluster ? d.properties.point_count || 1 : 1,
          ) * 0.26,
        updateTriggers: this.props.updateTriggers,
        getAngle: (d: any) => !d.properties.cluster ? Math.round(360 + d.properties.heading) : 0,
        
      }) as Layer,
      new PinCountLayer({
        id: "pin-counter",
        data: clusters.filter((d) => d.properties.cluster),
      }) as Layer,
    ];
  }
}
