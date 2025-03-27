import { CompositeLayer, IconLayer, Layer } from "deck.gl";
import pinbg from "@assets/testing/PinBg.svg";
import face from "@assets/testing/Face.svg";
import Supercluster from "supercluster";
import { PinCountLayer } from "./pin_count";
import { createSVGIcon } from "./prototype/svg-generation";

interface ClusterFeature {
  type: "Feature";
  properties: {
    cluster?: boolean;
    point_count?: number;
    highest_speed_limit?: number;
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
      reduce: (accumulated: any, props: any) => {
        
        const currentSpeedLimit = props.cluster ? props.highest_speed_limit : props.speed_limit_condition;
        const accumulatedSpeedLimit = accumulated.cluster ? accumulated.highest_speed_limit : accumulated.speed_limit_condition;
        
        // Always take the maximum value
        const maxSpeedLimit = Math.max(currentSpeedLimit || 0, accumulatedSpeedLimit || 0);
        
        return {
          ...accumulated,
          highest_speed_limit: maxSpeedLimit,
          speed_limit_condition: maxSpeedLimit,
        };
      },
      map: (props: any) => {
        return {
          highest_speed_limit: props.speed_limit_condition || 0,
          speed_limit_condition: props.speed_limit_condition || 0,
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
          coordinates: [point.longitude, point.latitude],
        },
      }));

      this.supercluster.load(features);

      const clusters = this.supercluster.getClusters(
        [-180, -85, 180, 85],
        zoom,
      ) as ClusterFeature[];

      // Debug: Print children of each cluster and update highest speed limit
      clusters.forEach((cluster, index) => {
        if (cluster.properties.cluster) {
          // Get all leaves (points) in this cluster
          const leaves = this.supercluster.getLeaves(
            cluster.properties.cluster_id,
            Infinity
          );
          
          // Find the highest speed limit among children
          const highestSpeedLimit = Math.max(
            ...leaves.map((leaf: any) => leaf.properties.speed_limit_condition || 0)
          );
          
          // Update the cluster's highest speed limit
          cluster.properties.highest_speed_limit = highestSpeedLimit;
          cluster.properties.speed_limit_condition = highestSpeedLimit;
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
          url: createSVGIcon(d.properties.cluster ? d.properties.highest_speed_limit : d.properties.speed_limit_condition),
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
    ];
  }
}
