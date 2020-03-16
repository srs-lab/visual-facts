import * as React from "react";
import * as styles from "./style.scss";
import { connect } from "react-redux";

import { RelationGraph, Entity, RelationType } from "@root/libs/dataStructures";

const RADIUS = 36;
const FONT_SIZE = 8;

type Props = {
  showDiff: boolean;
  relationGraph: RelationGraph;
  selectedPath: string;
};

type State = {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  entities: Entity[];
  positionMap: any;
};

class VisBoard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      width: 0,
      height: 0,
      scaleX: 1,
      scaleY: 1,
      entities: [],
      positionMap: {},
    };
  }

  componentDidMount() {
    this.getCanvasDimension();
    window.addEventListener("resize", this.getCanvasDimension);
    const { selectedPath, relationGraph } = this.props;
    const entities = relationGraph.getEntitiesByPrefix(selectedPath);
    this.setState({ entities });
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (
      prevProps.selectedPath !== this.props.selectedPath ||
      prevProps.relationGraph !== this.props.relationGraph
    ) {
      // If selectedPath or relationGraph changed
      const { selectedPath, relationGraph } = this.props;
      const entities = relationGraph.getEntitiesByPrefix(selectedPath);
      this.setState({ entities });
    }
    if (prevState.entities !== this.state.entities) {
      // If entities changed
      this.setState(
        { positionMap: this.generatePositionMap(true) },
        this.renderVisualizationFromGraph,
      );
    }
    if (prevProps.showDiff !== this.props.showDiff) {
      // If showDiff changed, re-render
      this.renderVisualizationFromGraph();
    }
    if (
      prevState.scaleX !== this.state.scaleX ||
      prevState.scaleY ||
      this.state.scaleY
    ) {
      // If scale changed, re-render
      this.renderVisualizationFromGraph();
    }
  }

  getCanvasDimension = () => {
    const dom = document.querySelector("#leftPane") as Element;
    const size = dom.getBoundingClientRect();
    this.setState({
      height: size.height,
      width: size.width,
    });
  };

  generatePositionMap(preserveOld: boolean) {
    const canvas = document.querySelector("#vis-board") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;
    const [width, height] = [canvas.width, canvas.height];
    const { entities } = this.state;
    const entityNameSet = new Set(
      entities.map((entity: Entity) => entity.getName()),
    );
    /**
     * Generate XY positions randomly
     */
    function __generateRandomXY() {
      return [
        Math.round(Math.random() * (width - 100) + 50),
        Math.round(Math.random() * (height - 100) + 50),
      ];
    }
    // Bind function
    __generateRandomXY.bind(this);
    // Initialize bitmap
    let positionMap: any;
    const bitmap: Array<Array<number>> = [];
    for (let i = 0; i < width; i++) {
      bitmap[i] = [];
      for (let j = 0; j < height; j++) {
        bitmap[i][j] = 0;
      }
    }
    if (!preserveOld) {
      positionMap = {};
    } else {
      positionMap = this.state.positionMap || {};
      for (const entityName of Object.keys(positionMap)) {
        // If entity in positionMap not present in current entities, discard directly
        if (!entityNameSet.has(entityName)) {
          delete positionMap[entityName];
          continue;
        }
        const [x, y] = positionMap[entityName];
        // If x or y is out of bound, discard directly
        if (
          x + RADIUS > width ||
          x - RADIUS < 0 ||
          y + RADIUS > height ||
          y - RADIUS < 0
        ) {
          delete positionMap[entityName];
          continue;
        }
        // Shed bitmap
        for (
          let m = Math.max(0, x - RADIUS);
          m < Math.min(x + RADIUS, width);
          m++
        ) {
          for (
            let n = Math.max(0, y - RADIUS);
            n < Math.min(y + RADIUS, height);
            n++
          ) {
            bitmap[m][n]++;
          }
        }
      }
    }
    for (const entity of entities) {
      // If already generated, skip
      if (positionMap[entity.getName()]) continue;
      // Generate random x y 10 times and choose the best one
      const candidates: Array<{ x: number; y: number; score: number }> = [];
      for (let i = 0; i < 50; i++) {
        // positionMap[entity.getName()] = __generateRandomXY();
        const [x, y] = __generateRandomXY();
        let score = 0;
        // Calculate score by counting how much bitmap is covered
        for (
          let m = Math.max(0, x - RADIUS);
          m < Math.min(x + RADIUS, width);
          m++
        ) {
          for (
            let n = Math.max(0, y - RADIUS);
            n < Math.min(y + RADIUS, height);
            n++
          ) {
            if (bitmap[m][n]) score += bitmap[m][n];
          }
        }
        candidates.push({ x, y, score });
      }
      // Find the best candidate
      const { x, y } = candidates.sort((a, b) => a.score - b.score)[0];
      // Shed bitmap
      for (
        let m = Math.max(0, x - RADIUS);
        m < Math.min(x + RADIUS, width);
        m++
      ) {
        for (
          let n = Math.max(0, y - RADIUS);
          n < Math.min(y + RADIUS, height);
          n++
        ) {
          bitmap[m][n]++;
        }
      }
      // Add into positionMap
      positionMap[entity.getName()] = [x, y];
    }
    return positionMap;
  }

  renderVisualizationFromGraph() {
    const canvas = document.querySelector("#vis-board") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;
    const { entities, positionMap } = this.state;
    if (!entities || entities.length === 0) return;
    if (!positionMap || Object.keys(positionMap).length === 0) return;
    console.log(entities, positionMap);
    const drawn = new Set<string>();
    // a set of entity names
    const entityNameSet = new Set<string>(
      entities.map((entity: Entity) => entity.getName()),
    );
    const [width, height] = [canvas.width, canvas.height];
    const { selectedPath, relationGraph, showDiff } = this.props;
    ctx.scale(this.state.scaleX, this.state.scaleY);

    function __drawLine(
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      lineType: RelationType,
      color?: string,
    ) {
      const dx = toX - fromX;
      const dy = toY - fromY;
      const angle = Math.atan2(dy, dx);
      if (fromX > toX) {
        fromX -= RADIUS * Math.abs(Math.cos(angle));
        toX += RADIUS * Math.abs(Math.cos(angle));
      } else {
        fromX += RADIUS * Math.abs(Math.cos(angle));
        toX -= RADIUS * Math.abs(Math.cos(angle));
      }
      if (fromY > toY) {
        fromY -= RADIUS * Math.abs(Math.sin(angle));
        toY += RADIUS * Math.abs(Math.sin(angle));
      } else {
        fromY += RADIUS * Math.abs(Math.sin(angle));
        toY -= RADIUS * Math.abs(Math.sin(angle));
      }
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.lineTo(
        toX - 10 * Math.cos(angle - Math.PI / 6),
        toY - 10 * Math.sin(angle - Math.PI / 6),
      );
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - 10 * Math.cos(angle + Math.PI / 6),
        toY - 10 * Math.sin(angle + Math.PI / 6),
      );
      if (lineType === RelationType.CALL) {
        ctx.lineWidth = 3;
      }
      if (color) {
        ctx.strokeStyle = color;
      }
      ctx.stroke();
      ctx.restore();
      console.log("Line drawn", showDiff);
    }

    function __drawCircle(
      entity: Entity,
      x: number,
      y: number,
      showDiff: boolean,
    ) {
      const entityType = entity.getEntityType();
      // TODO: this is buggy
      let label = entity
        .getName()
        .replace(selectedPath ? selectedPath + "." : "", "");
      if (label.length > 14) {
        label = label.slice(0, 14) + "...";
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, RADIUS, 0, 2 * Math.PI);
      // If showDiff is on, color the stroke
      if (showDiff) {
        const flags = entity.getFlags();
        if (flags.deleted) {
          ctx.strokeStyle = "#FF0000";
        }
        if (flags.inserted) {
          ctx.strokeStyle = "#66cc82";
        }
      }
      ctx.stroke();
      // Fill text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${FONT_SIZE}px Arial`;
      if (showDiff) {
        const flags = entity.getFlags();
        if (flags.deleted) {
          ctx.fillStyle = "#FF0000";
        }
        if (flags.inserted) {
          ctx.fillStyle = "#66cc82";
        }
      }
      ctx.fillText("<<".concat(entityType).concat(">>"), x, y - 6);
      ctx.fillText(label, x, y + 6);
      ctx.restore();
    }

    function drawEntity(entity: Entity, x: number, y: number) {
      const name = entity.getName();
      if (drawn.has(name)) return false;
      drawn.add(name);
      // If showDiff is off, hide entities with deleted flags
      if (!showDiff && entity.getFlags().deleted) {
        return false;
      }
      __drawCircle(entity, x, y, showDiff);
      // Continue drawing adjacent entities
      for (const relation of relationGraph.getRelationsByEntity(entity)) {
        // Ignore relation that points to existing entities
        const to = relation.getTo();
        if (!entityNameSet.has(to.getName())) {
          continue;
        }
        if (!positionMap[to.getName()]) {
          console.log(
            "Something went wrong; no position associated with this entity!",
          );
          continue;
        }
        const [toX, toY] = positionMap[to.getName()];
        if (drawEntity(to, toX, toY)) {
          if (showDiff) {
            let color;
            if (entity.getFlags().deleted) {
              color = "#FF0000";
            } else if (entity.getFlags().inserted) {
              color = "#66cc82";
            } else {
              color = "#000000";
            }
            __drawLine(x, y, toX, toY, relation.getType(), color);
          } else {
            __drawLine(x, y, toX, toY, relation.getType(), "#000000");
          }
        }
      }
      return true;
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw entities
    console.log("Entities", entities, typeof entities, Array.isArray(entities));
    for (const entity of entities) {
      if (!positionMap[entity.getName()]) {
        console.log(
          "Something went wrong; no position associated with this entity!",
        );
        continue;
      }
      const [x, y] = positionMap[entity.getName()];
      drawEntity(entity, x, y);
    }

    console.log("Redrawn");
  }

  render() {
    const { height, width } = this.state;
    return (
      <div className={styles.container}>
        <canvas
          id="vis-board"
          className={styles.canvas}
          height={height * this.state.scaleX || 0}
          width={width * this.state.scaleY || 0}
        />
        <button
          className={styles.zoomOut}
          onClick={() => {
            this.setState({
              scaleX: this.state.scaleX + 1,
              scaleY: this.state.scaleY + 1,
            });
          }}
        >
          +
        </button>
        <button
          className={styles.zoomIn}
          onClick={() => {
            this.setState({
              scaleX: this.state.scaleX - 1 || 1,
              scaleY: this.state.scaleY - 1 || 1,
            });
          }}
        >
          -
        </button>
      </div>
    );
  }
}

const mapStateToProps = (state: any) => ({
  relationGraph: state.relationGraph || new RelationGraph(),
  selectedPath: state.selectedPath,
  entityTypeFilter: state.entityTypeFilter,
  showDiff: state.showDiff,
});

export default connect(mapStateToProps)(VisBoard);