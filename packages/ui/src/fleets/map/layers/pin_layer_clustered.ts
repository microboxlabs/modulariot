import { CompositeLayer, IconLayer, Layer } from "deck.gl";
import Supercluster from "supercluster";
import { PinCountLayer } from "./pin_count";
import { createSVGIcon } from "./svg-generation";

// This is for defining what is more important and what should be shown when clustered
// The highest the index, the more important the condition is
const iconDefinition = {
  remission: {
    x: 0,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
  observation: {
    x: 500,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
  compromissed: {
    x: 1000,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
  stable: {
    x: 1500,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
  treatment: {
    x: 2000,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
  critical_condition: {
    x: 2500,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
  code_black: {
    x: 3000,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
};

interface ClusterFeature {
  type: "Feature";
  properties: {
    cluster?: boolean;
    point_count?: number;
    highest_speed_limit?: number;
    highest_symptoms_condition?: number;
    speed_limit_condition?: number;
    symptoms_condition?: number;
    [key: string]: any;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

export class PinLayer extends CompositeLayer<any> {
  supercluster: Supercluster;
  declare state: {
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
      reduce: (accumulated: any, props: any) => {
        const currentSpeedLimit = props.cluster
          ? props.highest_speed_limit
          : props.speed_limit_condition;
        const accumulatedSpeedLimit = accumulated.cluster
          ? accumulated.highest_speed_limit
          : accumulated.speed_limit_condition;
        // Always take the maximum value
        const maxSpeedLimit = Math.max(
          currentSpeedLimit || 0,
          accumulatedSpeedLimit || 0
        );

        const currentMaxSymptoms = props.cluster
          ? props.highest_symptoms_condition
          : props.symptoms_condition;
        const accumulatedMaxSymptoms = accumulated.cluster
          ? accumulated.highest_symptoms_condition
          : accumulated.symptoms_condition;
        // Always take the maximum value
        const maxSymptoms = Math.max(
          currentMaxSymptoms || 0,
          accumulatedMaxSymptoms || 0
        );

        return {
          ...accumulated,
          highest_speed_limit: maxSpeedLimit,
          speed_limit_condition: maxSpeedLimit,
          highest_symptoms_condition: maxSymptoms,
          symptoms_condition: maxSymptoms,
        };
      },
      map: (props: any) => {
        return {
          highest_speed_limit: props.speed_limit_condition || 0,
          speed_limit_condition: props.speed_limit_condition || 0,
          highest_symptoms_condition: props.symptoms_condition || 0,
          symptoms_condition: props.symptoms_condition || 0,
        };
      },
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
          coordinates: [point.longitude || 0, point.latitude || 0],
        },
      }));

      this.supercluster.load(features);

      const clusters = this.supercluster.getClusters(
        [-180, -85, 180, 85],
        zoom
      ) as ClusterFeature[];

      // Debug: Print children of each cluster and update highest speed limit
      clusters.forEach((cluster) => {
        if (cluster.properties.cluster) {
          // Get all leaves (points) in this cluster
          const leaves = this.supercluster.getLeaves(
            cluster.properties.cluster_id,
            Infinity
          );

          // Find the highest speed limit among children
          const highestSpeedLimit = Math.max(
            ...leaves.map(
              (leaf: any) => leaf.properties.speed_limit_condition || 0
            )
          );

          // Update the cluster's highest speed limit
          cluster.properties.highest_speed_limit = highestSpeedLimit;
          cluster.properties.speed_limit_condition = highestSpeedLimit;

          const highestSymptoms = Math.max(
            ...leaves.map(
              (leaf: any) => leaf.properties.symptoms_condition || 0
            )
          );

          // Update the cluster's highest symptoms condition
          cluster.properties.highest_symptoms_condition = highestSymptoms;
          cluster.properties.symptoms_condition = highestSymptoms;
        }
      });

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
        getIcon: (d: any) => ({
          url: createSVGIcon(
            d.properties.cluster
              ? d.properties.highest_speed_limit
              : d.properties.speed_limit_condition,
            d.properties.lost_signal
          ),
          width: 300,
          height: 500,
          anchorX: 150,
          anchorY: 310,
          mask: false,
        }),
        getPosition: (d: ClusterFeature) => d.geometry.coordinates,
        getAngle: (d: ClusterFeature) =>
          !d.properties.cluster ? Math.round(360 + d.properties.heading) : 0,
        getSize: (d: ClusterFeature) =>
          getIconSize(d.properties.cluster ? d.properties.point_count || 1 : 1),
        updateTriggers: this.props.updateTriggers,
        pickable: true,
        parameters: {
          depthTest: false,
        },
      }) as Layer,
      new PinCountLayer({
        id: "pin-counter",
        data: clusters.filter((d) => d.properties.cluster),
      }) as Layer,
      new IconLayer({
        id: "IconLayer-pin",
        data: clusters,
        getIcon: (d: ClusterFeature) => {
          switch (d.properties.symptoms_condition) {
            case 1:
              return "observation";
            case 2:
              return "compromissed";
            case 3:
              return "critical_condition";
            case 4:
              return "code_black";
            default:
              return "";
          }
        },
        getPosition: (d: ClusterFeature) => d.geometry.coordinates,
        getPixelOffset: (d: ClusterFeature) => {
          const size = getIconSize(
            d.properties.cluster ? d.properties.point_count || 1 : 1
          );
          const heading = d.properties.heading || 0;
          // Convert heading to radians and calculate offset
          const angleRad = (heading * Math.PI) / 180;
          const offsetY = -size * 0.5;
          return [Math.sin(angleRad) * offsetY, Math.cos(angleRad) * offsetY];
        },
        iconAtlas: "/icons/conditions-atlas.png", // Dont use /public for searching images
        iconMapping: iconDefinition,
        getSize: (d: ClusterFeature) => {
          const baseSize = getIconSize(
            d.properties.cluster ? d.properties.point_count || 1 : 1
          );
          const scaleFactor = d.properties.cluster ? 0.7 : 1;
          return (
            (35 / Math.pow(1.0, this.props.zoom)) *
            (baseSize / 50) *
            scaleFactor
          );
        },
        sizeScale: 1,
        getAngle: (d: ClusterFeature) =>
          !d.properties.cluster ? Math.round(360 + d.properties.heading) : 0,
        pickable: true,
      }) as Layer,
    ];
  }
}
