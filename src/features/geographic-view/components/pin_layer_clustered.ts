import { CompositeLayer, IconLayer, Layer, LayersList } from "deck.gl";
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

export class PinLayer extends CompositeLayer {
  supercluster: Supercluster;

  constructor(props: any) {
    super(props);
    // Initialize supercluster in the constructor
    this.supercluster = new Supercluster({
      radius: props.sizeScale * Math.sqrt(2) || 100, // Scale radius based on sizeScale prop
      maxZoom: 16,
      minPoints: 2,
      extent: 512,
      nodeSize: 64,
    });
  }

  initializeState() {
    super.initializeState();

    this.setState({
      clusters: [],
    });
  }

  shouldUpdateState({ changeFlags }: any) {
    return changeFlags.propsOrDataChanged;
  }

  updateState({ props, changeFlags }: any) {
    const zoom = Math.floor(props.zoom || 10);

    if (changeFlags.propsOrDataChanged) {
      // Convert points to GeoJSON features
      const features = (props.data || []).map((point: unknown) => ({
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

      // Load features into supercluster
      this.supercluster.load(features);

      // Get clusters for current viewport
      const clusters = this.supercluster.getClusters(
        [-180, -85, 180, 85],
        zoom,
      );
      this.setState({ clusters });
    }
  }

  renderLayers(): Layer | null | LayersList {
    const { clusters } = this.state;

    if (!clusters || clusters.length === 0) {
      return null;
    }

    const getIconSize = (count: number) => {
      const baseSize = Math.min(100, count) / 100 + 1;
      return count > 1 ? baseSize * 100 : 70;
    };

    return [
      new IconLayer({
        id: "IconLayer-base",
        data: clusters,
        getIcon: (d: any) => "pin",
        getPosition: (d: any) => d.geometry.coordinates,
        getAngle: (d) => (!d.properties.cluster ? this.props.rotation : 0),
        iconAtlas: pinbg.src,
        iconMapping: icon_definition,
        getSize: (d: any) =>
          getIconSize(d.properties.cluster ? d.properties.point_count : 1),
        updateTriggers: this.props.updateTriggers,
      }),
      new IconLayer({
        id: "IconLayer-head",
        data: clusters,
        getIcon: () => "face",
        getPosition: (d: any) => d.geometry.coordinates,
        iconAtlas: face.src,
        iconMapping: icon_definition,
        getSize: (d: any) =>
          getIconSize(d.properties.cluster ? d.properties.point_count : 1) *
          0.26, // Scale face proportionally
        updateTriggers: this.props.updateTriggers,
        getAngle: (d) => (!d.properties.cluster ? this.props.rotation : 0),
      }),
      new PinCountLayer({
        id: "pin-counter",
        data: clusters.filter((d) => d.properties.cluster),
      }),
    ];
  }
}
